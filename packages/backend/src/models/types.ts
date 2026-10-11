export interface PaginationParams {
  page: number;
  limit: number;
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
}

/**
 * Standard paginated response structure
 * Generic type for any paginated database response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PrismaModel<T = any> {
  findUnique(args: any): Promise<T | null>;
  findFirst(args: any): Promise<T | null>;
  findMany(args: any): Promise<T[]>;
  create(args: any): Promise<T>;
  update(args: any): Promise<T>;
  delete(args: any): Promise<T>;
  count(args: any): Promise<number>;
  aggregate(args: any): Promise<any>;
  groupBy(args: any): Promise<any[]>;
}

export interface ModelConfig {
  tableName: string;
  singleIncludes?: Record<string, any>;
  manyIncludes?: Record<string, any>;
  searchFields?: string[];
  defaultOrderBy?: Record<string, any>;
  /** Enable soft delete filtering - automatically adds deletedAt: null to queries */
  softDelete?: boolean;
}

/**
 * Prisma DMMF Field type
 * Represents a field from Prisma's Data Model Meta Format
 */
export interface PrismaFieldSchema {
  kind: 'scalar' | 'object' | 'enum' | 'unsupported';
  name: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  isReadOnly: boolean;
  hasDefaultValue: boolean;
  type: string;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
  relationOnDelete?: string;
  isGenerated?: boolean;
  isUpdatedAt?: boolean;
  documentation?: string;
}
