import { Backend } from '@/backend';
import { DatabaseService, PrismaLikeClient } from '@/database';
import { UserContext } from '@/utils';
import {
  ModelConfig,
  PaginatedResponse,
  PaginationParams,
  PrismaFieldSchema,
  PrismaModel,
} from './types';

export abstract class BaseModel<T extends PrismaLikeClient, M extends PrismaModel> {
  protected backend: Backend<T>;
  public database: DatabaseService<T>;
  public config: ModelConfig;

  constructor(backend: Backend<T>, config: ModelConfig) {
    this.backend = backend;
    this.database = backend.database;
    this.config = config;
  }

  /**
   * Get the database table accessor
   * @throws Error if database client is not initialized
   */
  protected get table(): M {
    if (!this.database.client) {
      throw new Error(
        `Database client not initialized. Ensure Backend.start() has been called before using ${this.config.tableName} model.`,
      );
    }
    return this.database.client[this.config.tableName];
  }

  /**
   * Get the model configuration
   */
  get modelConfig() {
    return this.config;
  }

  /**
   * Get model fields from Prisma DMMF (Data Model Meta Format)
   * Returns the full field objects with all metadata
   */
  getFields(): readonly PrismaFieldSchema[] {
    try {
      // Dynamically import Prisma to avoid build-time errors when client isn't generated
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the generated client may be absent at build time
      const { Prisma } = require('@prisma/client');

      // Access Prisma DMMF directly (works with Prisma v5+)
      const model = Prisma.dmmf.datamodel.models.find(
        (m: any) => m.name.toLowerCase() === this.config.tableName.toLowerCase(),
      );

      return (model?.fields as readonly PrismaFieldSchema[]) || [];
    } catch {
      // If we can't introspect or Prisma isn't generated, return empty array
      return [];
    }
  }

  /**
   * Get model field names from Prisma DMMF (Data Model Meta Format)
   * Returns a Set of field names that exist on the model
   */
  getFieldNames(): Set<string> {
    try {
      const fields = this.getFields();
      return new Set<string>(fields.map(f => f.name));
    } catch {
      // If we can't introspect, return empty set
      return new Set();
    }
  }

  /**
   * Check if soft delete filtering should be applied
   * Uses config.softDelete if set, otherwise tries DMMF introspection
   */
  protected shouldFilterSoftDeletes(): boolean {
    // If explicitly configured, use that
    if (this.config.softDelete !== undefined) {
      return this.config.softDelete;
    }
    // Fall back to DMMF introspection
    return this.getFieldNames().has('deletedAt');
  }

  /**
   * Check if a model has a deletedAt field using Prisma DMMF
   * @param modelName - The name of the model to check
   * @returns True if the model has a deletedAt field
   */
  protected modelHasDeletedAt(modelName: string): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the generated client may be absent at build time
      const { Prisma } = require('@prisma/client');
      const model = Prisma.dmmf.datamodel.models.find(
        (m: any) => m.name.toLowerCase() === modelName.toLowerCase(),
      );
      if (!model) return false;
      return model.fields.some((f: any) => f.name === 'deletedAt');
    } catch {
      return false;
    }
  }

  /**
   * Get the related model name for a field using Prisma DMMF
   * @param fieldName - The name of the relation field
   * @returns The related model name or null if not found
   */
  protected getRelatedModelName(fieldName: string): string | null {
    try {
      const fields = this.getFields();
      const field = fields.find(f => f.name === fieldName);
      if (field && field.kind === 'object' && field.type) {
        return field.type;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get related model name for a field from a specific model using Prisma DMMF
   * @param fieldName - The name of the relation field
   * @param modelName - The model name to look up (defaults to current model)
   * @returns The related model name or null if not found
   */
  protected getRelatedModelNameFromModel(fieldName: string, modelName?: string): string | null {
    if (!modelName) {
      return this.getRelatedModelName(fieldName);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the generated client may be absent at build time
      const { Prisma } = require('@prisma/client');
      const model = Prisma.dmmf.datamodel.models.find(
        (m: any) => m.name.toLowerCase() === modelName.toLowerCase(),
      );
      if (!model) return null;

      const field = model.fields.find((f: any) => f.name === fieldName);
      if (field && field.kind === 'object' && field.type) {
        return field.type;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a relation field is a to-many (list) relation
   * Only to-many relations support `where` in Prisma includes
   * @param fieldName - The name of the relation field
   * @param modelName - The model name to look up (defaults to current model)
   * @returns True if the relation is a list (to-many), false otherwise
   */
  protected isListRelation(fieldName: string, modelName?: string): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the generated client may be absent at build time
      const { Prisma } = require('@prisma/client');
      const targetModelName = modelName || this.config.tableName;
      const model = Prisma.dmmf.datamodel.models.find(
        (m: any) => m.name.toLowerCase() === targetModelName.toLowerCase(),
      );
      if (!model) return false;

      const field = model.fields.find((f: any) => f.name === fieldName);
      return field?.isList === true;
    } catch {
      return false;
    }
  }

  /**
   * Process a single include entry, adding deletedAt filter if needed
   * Only adds `where` clause for to-many relations (Prisma doesn't allow `where` on to-one relations)
   * @param key - The relation field name
   * @param value - The include value (true or object)
   * @param modelName - The parent model name to look up relations from
   * @returns Processed include value
   */
  private processIncludeEntry(
    key: string,
    value: any,
    modelName?: string,
  ): any {
    const relatedModel = this.getRelatedModelNameFromModel(key, modelName);
    const isList = this.isListRelation(key, modelName);

    // Only add where clause for to-many (list) relations
    // Prisma doesn't support `where` on to-one relations in includes
    if (value === true) {
      if (isList && relatedModel && this.modelHasDeletedAt(relatedModel)) {
        return { where: { deletedAt: null } };
      }
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      const newValue = { ...value };

      // Only add deletedAt filter for to-many relations
      if (isList && relatedModel && this.modelHasDeletedAt(relatedModel)) {
        if (!newValue.where) {
          newValue.where = { deletedAt: null };
        } else if (!('deletedAt' in newValue.where)) {
          newValue.where = { deletedAt: null, ...newValue.where };
        }
      }

      if (newValue.include) {
        newValue.include = this.processIncludes(newValue.include, relatedModel);
      }

      return newValue;
    }

    return value;
  }

  /**
   * Process includes object, adding deletedAt filters to all relations that support soft delete
   * @param includes - The includes object to process
   * @param modelName - The model name to look up relations from (defaults to current model)
   * @returns Processed includes with deletedAt filters added
   */
  private processIncludes(
    includes: Record<string, any>,
    modelName?: string | null,
  ): Record<string, any> {
    if (!includes || typeof includes !== 'object') return includes;

    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(includes)) {
      processed[key] = this.processIncludeEntry(key, value, modelName ?? undefined);
    }
    return processed;
  }

  /**
   * Recursively add deletedAt: null filter to includes for models that support soft delete
   * @param includes - The includes object to process
   * @returns Processed includes with deletedAt filters added
   */
  protected addDeletedAtToIncludes(includes: Record<string, any>): Record<string, any> {
    return this.processIncludes(includes);
  }

  /**
   * Add deletedAt filter to includes for a specific model's relations
   * @param includes - The includes object to process
   * @param modelName - The model name to get relation info from
   * @returns Processed includes with deletedAt filters added
   */
  protected addDeletedAtToIncludesForModel(
    includes: Record<string, any>,
    modelName: string | null,
  ): Record<string, any> {
    if (!modelName) return includes;
    return this.processIncludes(includes, modelName);
  }

  // ============================================================================
  // BASIC MODEL FUNCTIONS (WITHOUT RLS CONTEXT)
  // ============================================================================

  /**
   * Finds a record by ID
   * @param id - Record ID to find
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to record or null
   */
  async findById(id: string, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    if (!table) {
      throw new Error(
        `Table '${this.config.tableName}' not found. tx=${!!tx}, client=${!!this.database.client}`,
      );
    }
    // Auto-filter soft deleted records if enabled
    const where = this.shouldFilterSoftDeletes()
      ? { id, deletedAt: null }
      : { id };
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.findFirst({
      where,
      include: processedIncludes,
    });
  }

  /**
   * Finds a record by unique field
   * @param where - Unique where clause
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to record or null
   */
  async findUnique(where: Record<string, any>, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    if (!table) {
      throw new Error(
        `Table '${this.config.tableName}' not found. tx=${!!tx}, client=${!!this.database.client}`,
      );
    }
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.findUnique({
      where,
      include: processedIncludes,
    });
  }

  /**
   * Finds the first record matching the where clause
   * @param where - Where conditions
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to record or null
   */
  async findOne(where: Record<string, any>, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    if (!table) {
      throw new Error(
        `Table '${this.config.tableName}' not found. tx=${!!tx}, client=${!!this.database.client}, tableName=${this.config.tableName}`,
      );
    }
    // Auto-filter soft deleted records if enabled
    const finalWhere = this.shouldFilterSoftDeletes()
      ? { deletedAt: null, ...where }
      : where;
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.findFirst({
      where: finalWhere,
      include: processedIncludes,
    });
  }

  /**
   * Finds multiple records with pagination
   * @param params - Pagination parameters
   * @param where - Where conditions
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to paginated response
   */
  async findMany(
    params: PaginationParams,
    where?: Record<string, any>,
    tx?: any,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, orderBy } = params;
    const skip = (page - 1) * limit;

    const table = tx ? tx[this.config.tableName] : this.table;

    // Use orderBy from params or fall back to default
    const finalOrderBy = orderBy || this.config.defaultOrderBy || { createdAt: 'desc' };

    // Auto-filter soft deleted records if enabled
    const finalWhere = this.shouldFilterSoftDeletes()
      ? { deletedAt: null, ...where }
      : where;

    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.manyIncludes || {});

    const [records, total] = await Promise.all([
      table.findMany({
        where: finalWhere,
        skip,
        take: limit,
        orderBy: finalOrderBy,
        include: processedIncludes,
      }),
      table.count({ where: finalWhere }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Creates a new record
   * @param data - Record data to create
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to created record
   */
  async create(data: Record<string, any>, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.create({
      data,
      include: processedIncludes,
    });
  }

  /**
   * Updates a record by ID
   * @param id - Record ID to update
   * @param data - Record data to update
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to updated record
   */
  async update(id: string, data: Record<string, any>, tx?: any) {
    // Filter out undefined values to prevent accidental data wiping
    // - undefined = field not included in request, should be ignored (no update)
    // - null = explicit intent to clear/remove a value (should be applied)
    // This allows users to clear optional fields (null) while protecting against
    // unintentional updates from fields not included in the request (undefined)
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    const table = tx ? tx[this.config.tableName] : this.table;
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.update({
      where: { id },
      data: filteredData,
      include: processedIncludes,
    });
  }

  /**
   * Soft deletes a record by setting deletedAt timestamp
   * @param id - Record ID to soft delete
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to soft deleted record
   */
  async delete(id: string, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: processedIncludes,
    });
  }

  /**
   * Permanently deletes a record (hard delete)
   * @param id - Record ID to permanently delete
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to deleted record
   */
  async permanentlyDelete(id: string, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    return await table.delete({
      where: { id },
    });
  }

  /**
   * Restores a soft deleted record
   * @param id - Record ID to restore
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to restored record
   */
  async restore(id: string, tx?: any) {
    const table = tx ? tx[this.config.tableName] : this.table;
    // Process includes to add deletedAt filters to relations
    const processedIncludes = this.addDeletedAtToIncludes(this.config.singleIncludes || {});
    return await table.update({
      where: { id },
      data: { deletedAt: null },
      include: processedIncludes,
    });
  }

  /**
   * Searches records by configured search fields
   * @param query - Search query
   * @param params - Pagination parameters
   * @param where - Additional where conditions
   * @param tx - Optional transaction instance for RLS context
   * @returns Promise resolving to paginated response
   */
  async search(
    query: string,
    params: PaginationParams,
    where?: Record<string, any>,
    tx?: any,
  ): Promise<PaginatedResponse<any>> {
    if (!this.config.searchFields?.length) {
      throw new Error(`Search fields not configured for ${this.config.tableName}`);
    }

    const searchConditions = this.config.searchFields.map((field: string) => ({
      [field]: { contains: query, mode: 'insensitive' as const },
    }));

    return this.findMany(
      params,
      {
        ...where,
        OR: searchConditions,
      },
      tx,
    );
  }

  // ============================================================================
  // CONTEXT-AWARE WRAPPER FUNCTIONS FOR ROW LEVEL SECURITY
  // ============================================================================

  /**
   * Finds a record by ID with user context for RLS
   * @param id - Record ID to find
   * @param context - User context for RLS
   * @returns Promise resolving to record or null
   */
  async findByIdWithContext(id: string, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.findById(id, tx);
    });
  }

  /**
   * Finds a record by unique field with user context for RLS
   * @param where - Unique where clause
   * @param context - User context for RLS
   * @returns Promise resolving to record or null
   */
  async findUniqueWithContext(where: Record<string, any>, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.findUnique(where, tx);
    });
  }

  /**
   * Finds the first record matching the where clause with user context for RLS
   * @param where - Where conditions
   * @param context - User context for RLS
   * @returns Promise resolving to record or null
   */
  async findOneWithContext(where: Record<string, any>, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.findOne(where, tx);
    });
  }

  /**
   * Finds multiple records with pagination and user context for RLS
   * @param params - Pagination parameters
   * @param where - Where conditions
   * @param context - User context for RLS
   * @returns Promise resolving to paginated response
   */
  async findManyWithContext(
    params: PaginationParams,
    where: Record<string, any> = {},
    context: UserContext,
  ): Promise<PaginatedResponse<any>> {
    return this.database.withUserContext(context, async tx => {
      return this.findMany(params, where, tx);
    });
  }

  /**
   * Creates a record with user context for RLS
   * @param data - Record data to create
   * @param context - User context for RLS
   * @returns Promise resolving to created record
   */
  async createWithContext(data: Record<string, any>, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.create(data, tx);
    });
  }

  /**
   * Updates a record by ID with user context for RLS
   * @param id - Record ID to update
   * @param data - Record data to update
   * @param context - User context for RLS
   * @returns Promise resolving to updated record
   */
  async updateWithContext(id: string, data: Record<string, any>, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.update(id, data, tx);
    });
  }

  /**
   * Soft deletes a record with user context for RLS
   * @param id - Record ID to soft delete
   * @param context - User context for RLS
   * @returns Promise resolving to soft deleted record
   */
  async deleteWithContext(id: string, context: UserContext) {
    context.showDeleted = true;
    return this.database.withUserContext(context, async tx => {
      return this.delete(id, tx);
    });
  }

  /**
   * Permanently deletes a record with user context for RLS
   * @param id - Record ID to permanently delete
   * @param context - User context for RLS
   * @returns Promise resolving to deleted record
   */
  async permanentlyDeleteWithContext(id: string, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.permanentlyDelete(id, tx);
    });
  }

  /**
   * Restores a soft deleted record with user context for RLS
   * @param id - Record ID to restore
   * @param context - User context for RLS
   * @returns Promise resolving to restored record
   */
  async restoreWithContext(id: string, context: UserContext) {
    return this.database.withUserContext(context, async tx => {
      return this.restore(id, tx);
    });
  }

  /**
   * Searches records with user context for RLS
   * @param query - Search query
   * @param params - Pagination parameters
   * @param where - Additional where conditions
   * @param context - User context for RLS
   * @returns Promise resolving to paginated response
   */
  async searchWithContext(
    query: string,
    params: PaginationParams,
    where: Record<string, any>,
    context: UserContext,
  ): Promise<PaginatedResponse<any>> {
    return this.database.withUserContext(context, async tx => {
      return this.search(query, params, where, tx);
    });
  }
}
