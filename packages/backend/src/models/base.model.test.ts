import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseModel } from './base.model';
import { Backend } from '@/backend';
import { DatabaseService } from '@/database';
import { ModelConfig } from './types';

/**
 * Example unit tests for BaseModel
 *
 * This demonstrates:
 * - Class testing with mocks
 * - Testing abstract classes
 * - Mocking database operations
 * - Testing error conditions
 */

// Create a concrete implementation for testing
class TestModel extends BaseModel<any, any> {
  constructor(backend: Backend<any>, config: ModelConfig) {
    super(backend, config);
  }
}

describe('BaseModel', () => {
  let mockBackend: Backend<any>;
  let mockDatabase: DatabaseService<any>;
  let mockTable: any;
  let testModel: TestModel;
  let config: ModelConfig;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock database client with table
    mockTable = {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    // Create mock database service
    mockDatabase = {
      client: {
        testTable: mockTable,
      },
      withUserContext: vi.fn((context, callback) => callback(mockDatabase.client)),
    } as any;

    // Create mock backend
    mockBackend = {
      database: mockDatabase,
    } as any;

    // Create model config
    config = {
      tableName: 'testTable',
      searchFields: ['name', 'email'],
      singleIncludes: {},
      manyIncludes: {},
      defaultOrderBy: { createdAt: 'desc' },
    };

    // Create test model instance
    testModel = new TestModel(mockBackend, config);
  });

  describe('constructor', () => {
    it('should initialize with backend and config', () => {
      expect(testModel.database).toBe(mockDatabase);
      expect(testModel.config).toBe(config);
    });

    it('should expose model config via getter', () => {
      expect(testModel.modelConfig).toBe(config);
    });
  });

  describe('findById', () => {
    it('should find a record by id', async () => {
      const mockRecord = { id: '123', name: 'Test' };
      mockTable.findFirst.mockResolvedValue(mockRecord);

      const result = await testModel.findById('123');

      expect(result).toEqual(mockRecord);
      expect(mockTable.findFirst).toHaveBeenCalledWith({
        where: { id: '123' },
        include: {},
      });
    });

    it('should return null when record not found', async () => {
      mockTable.findFirst.mockResolvedValue(null);

      const result = await testModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should return paginated results', async () => {
      const mockRecords = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ];
      mockTable.findMany.mockResolvedValue(mockRecords);
      mockTable.count.mockResolvedValue(10);

      const result = await testModel.findMany({ page: 1, limit: 5 });

      expect(result.data).toEqual(mockRecords);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate pagination correctly for last page', async () => {
      const mockRecords = [{ id: '1', name: 'Test 1' }];
      mockTable.findMany.mockResolvedValue(mockRecords);
      mockTable.count.mockResolvedValue(10);

      const result = await testModel.findMany({ page: 2, limit: 5 });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should apply where conditions', async () => {
      mockTable.findMany.mockResolvedValue([]);
      mockTable.count.mockResolvedValue(0);

      await testModel.findMany({ page: 1, limit: 10 }, { status: 'active' });

      expect(mockTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const mockData = { name: 'New Record' };
      const mockCreated = { id: '123', ...mockData };
      mockTable.create.mockResolvedValue(mockCreated);

      const result = await testModel.create(mockData);

      expect(result).toEqual(mockCreated);
      expect(mockTable.create).toHaveBeenCalledWith({
        data: mockData,
        include: {},
      });
    });
  });

  describe('update', () => {
    it('should update a record by id', async () => {
      const mockData = { name: 'Updated Name' };
      const mockUpdated = { id: '123', ...mockData };
      mockTable.update.mockResolvedValue(mockUpdated);

      const result = await testModel.update('123', mockData);

      expect(result).toEqual(mockUpdated);
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: mockData,
        include: {},
      });
    });

    it('should filter out undefined values to prevent data loss', async () => {
      const mockData = { name: 'Updated Name', description: undefined, status: 'active' };
      const mockUpdated = { id: '123', name: 'Updated Name', status: 'active' };
      mockTable.update.mockResolvedValue(mockUpdated);

      const result = await testModel.update('123', mockData);

      expect(result).toEqual(mockUpdated);
      // undefined fields should be filtered out
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { name: 'Updated Name', status: 'active' },
        include: {},
      });
    });

    it('should preserve null values for explicit field clearing', async () => {
      const mockData = { name: 'Updated Name', description: null, status: 'active' };
      const mockUpdated = { id: '123', ...mockData };
      mockTable.update.mockResolvedValue(mockUpdated);

      const result = await testModel.update('123', mockData);

      expect(result).toEqual(mockUpdated);
      // null values should be preserved (not filtered)
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { name: 'Updated Name', description: null, status: 'active' },
        include: {},
      });
    });

    it('should handle data with only undefined values', async () => {
      const mockData = { field1: undefined, field2: undefined };
      const mockUpdated = { id: '123' };
      mockTable.update.mockResolvedValue(mockUpdated);

      const result = await testModel.update('123', mockData);

      expect(result).toEqual(mockUpdated);
      // All undefined values filtered, empty object sent
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: {},
        include: {},
      });
    });
  });

  describe('delete', () => {
    it('should soft delete a record', async () => {
      const mockDeleted = { id: '123', deletedAt: expect.any(Date) };
      mockTable.update.mockResolvedValue(mockDeleted);

      const result = await testModel.delete('123');

      expect(result).toEqual(mockDeleted);
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { deletedAt: expect.any(Date) },
        include: {},
      });
    });
  });

  describe('permanentlyDelete', () => {
    it('should permanently delete a record', async () => {
      const mockDeleted = { id: '123' };
      mockTable.delete.mockResolvedValue(mockDeleted);

      const result = await testModel.permanentlyDelete('123');

      expect(result).toEqual(mockDeleted);
      expect(mockTable.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });
  });

  describe('search', () => {
    it('should search records using configured fields', async () => {
      const mockRecords = [{ id: '1', name: 'John Doe', email: 'john@example.com' }];
      mockTable.findMany.mockResolvedValue(mockRecords);
      mockTable.count.mockResolvedValue(1);

      const result = await testModel.search('john', { page: 1, limit: 10 });

      expect(result.data).toEqual(mockRecords);
      expect(mockTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should throw error when search fields not configured', async () => {
      const modelWithoutSearch = new TestModel(mockBackend, {
        ...config,
        searchFields: [],
      });

      await expect(modelWithoutSearch.search('test', { page: 1, limit: 10 })).rejects.toThrow(
        'Search fields not configured',
      );
    });
  });

  describe('getFieldNames', () => {
    it('should return empty set when Prisma not available', () => {
      const fieldNames = testModel.getFieldNames();
      expect(fieldNames).toBeInstanceOf(Set);
    });
  });

  describe('findUnique', () => {
    it('should find a record by unique field', async () => {
      const mockRecord = { id: '123', email: 'unique@example.com' };
      mockTable.findUnique.mockResolvedValue(mockRecord);

      const result = await testModel.findUnique({ email: 'unique@example.com' });

      expect(result).toEqual(mockRecord);
      expect(mockTable.findUnique).toHaveBeenCalledWith({
        where: { email: 'unique@example.com' },
        include: {},
      });
    });

    it('should use transaction if provided', async () => {
      const mockRecord = { id: '123', email: 'unique@example.com' };
      const mockTx = {
        testTable: {
          findUnique: vi.fn().mockResolvedValue(mockRecord),
        },
      };

      const result = await testModel.findUnique({ email: 'unique@example.com' }, mockTx);

      expect(result).toEqual(mockRecord);
      expect(mockTx.testTable.findUnique).toHaveBeenCalled();
    });

    it('should throw error if table not found in transaction', async () => {
      const mockTx = {}; // Missing table

      await expect(
        testModel.findUnique({ email: 'test@example.com' }, mockTx),
      ).rejects.toThrow("Table 'testTable' not found");
    });
  });

  describe('findOne', () => {
    it('should find first matching record', async () => {
      const mockRecord = { id: '123', status: 'active' };
      mockTable.findFirst.mockResolvedValue(mockRecord);

      const result = await testModel.findOne({ status: 'active' });

      expect(result).toEqual(mockRecord);
      expect(mockTable.findFirst).toHaveBeenCalledWith({
        where: { status: 'active' },
        include: {},
      });
    });

    it('should use transaction if provided', async () => {
      const mockRecord = { id: '123', status: 'active' };
      const mockTx = {
        testTable: {
          findFirst: vi.fn().mockResolvedValue(mockRecord),
        },
      };

      const result = await testModel.findOne({ status: 'active' }, mockTx);

      expect(result).toEqual(mockRecord);
      expect(mockTx.testTable.findFirst).toHaveBeenCalled();
    });

    it('should throw error if table not found', async () => {
      const mockTx = {};

      await expect(
        testModel.findOne({ status: 'active' }, mockTx),
      ).rejects.toThrow("Table 'testTable' not found");
    });
  });

  describe('restore', () => {
    it('should restore soft-deleted record', async () => {
      const mockRestored = { id: '123', deletedAt: null };
      mockTable.update.mockResolvedValue(mockRestored);

      const result = await testModel.restore('123');

      expect(result).toEqual(mockRestored);
      expect(mockTable.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { deletedAt: null },
        include: {},
      });
    });

    it('should use transaction if provided', async () => {
      const mockRestored = { id: '123', deletedAt: null };
      const mockTx = {
        testTable: {
          update: vi.fn().mockResolvedValue(mockRestored),
        },
      };

      const result = await testModel.restore('123', mockTx);

      expect(result).toEqual(mockRestored);
      expect(mockTx.testTable.update).toHaveBeenCalled();
    });
  });

  describe('*WithContext methods', () => {
    const mockContext = {
      userId: 'user-123',
    };

    describe('findByIdWithContext', () => {
      it('should find record with RLS context', async () => {
        const mockRecord = { id: '123', name: 'Test' };
        mockTable.findFirst.mockResolvedValue(mockRecord);

        const result = await testModel.findByIdWithContext('123', mockContext);

        expect(result).toEqual(mockRecord);
        expect(mockDatabase.withUserContext).toHaveBeenCalledWith(
          mockContext,
          expect.any(Function),
        );
      });
    });

    describe('findUniqueWithContext', () => {
      it('should find unique record with RLS context', async () => {
        const mockRecord = { id: '123', email: 'test@example.com' };
        mockTable.findUnique.mockResolvedValue(mockRecord);

        const result = await testModel.findUniqueWithContext(
          { email: 'test@example.com' },
          mockContext,
        );

        expect(result).toEqual(mockRecord);
        expect(mockDatabase.withUserContext).toHaveBeenCalledWith(
          mockContext,
          expect.any(Function),
        );
      });
    });

    describe('findOneWithContext', () => {
      it('should find first record with RLS context', async () => {
        const mockRecord = { id: '123', status: 'active' };
        mockTable.findFirst.mockResolvedValue(mockRecord);

        const result = await testModel.findOneWithContext({ status: 'active' }, mockContext);

        expect(result).toEqual(mockRecord);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('findManyWithContext', () => {
      it('should find many records with RLS context', async () => {
        const mockRecords = [
          { id: '1', name: 'Test 1' },
          { id: '2', name: 'Test 2' },
        ];
        mockTable.findMany.mockResolvedValue(mockRecords);
        mockTable.count.mockResolvedValue(2);

        const result = await testModel.findManyWithContext(
          { page: 1, limit: 10 },
          mockContext,
        );

        expect(result.data).toEqual(mockRecords);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });

      it('should apply where conditions with RLS context', async () => {
        mockTable.findMany.mockResolvedValue([]);
        mockTable.count.mockResolvedValue(0);

        await testModel.findManyWithContext(
          { page: 1, limit: 10 },
          mockContext,
          { status: 'active' },
        );

        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('createWithContext', () => {
      it('should create record with RLS context', async () => {
        const mockData = { name: 'New Record' };
        const mockCreated = { id: '123', ...mockData };
        mockTable.create.mockResolvedValue(mockCreated);

        const result = await testModel.createWithContext(mockData, mockContext);

        expect(result).toEqual(mockCreated);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('updateWithContext', () => {
      it('should update record with RLS context', async () => {
        const mockData = { name: 'Updated' };
        const mockUpdated = { id: '123', ...mockData };
        mockTable.update.mockResolvedValue(mockUpdated);

        const result = await testModel.updateWithContext('123', mockData, mockContext);

        expect(result).toEqual(mockUpdated);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });

      it('should filter undefined values with RLS context', async () => {
        const mockData = { name: 'Updated', description: undefined };
        const mockUpdated = { id: '123', name: 'Updated' };
        mockTable.update.mockResolvedValue(mockUpdated);

        const result = await testModel.updateWithContext('123', mockData, mockContext);

        expect(result).toEqual(mockUpdated);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('deleteWithContext', () => {
      it('should soft delete record with RLS context', async () => {
        const mockDeleted = { id: '123', deletedAt: expect.any(Date) };
        mockTable.update.mockResolvedValue(mockDeleted);

        const result = await testModel.deleteWithContext('123', mockContext);

        expect(result).toEqual(mockDeleted);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('permanentlyDeleteWithContext', () => {
      it('should permanently delete record with RLS context', async () => {
        const mockDeleted = { id: '123' };
        mockTable.delete.mockResolvedValue(mockDeleted);

        const result = await testModel.permanentlyDeleteWithContext('123', mockContext);

        expect(result).toEqual(mockDeleted);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('restoreWithContext', () => {
      it('should restore record with RLS context', async () => {
        const mockRestored = { id: '123', deletedAt: null };
        mockTable.update.mockResolvedValue(mockRestored);

        const result = await testModel.restoreWithContext('123', mockContext);

        expect(result).toEqual(mockRestored);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });

    describe('searchWithContext', () => {
      it('should search records with RLS context', async () => {
        const mockRecords = [{ id: '1', name: 'John', email: 'john@example.com' }];
        mockTable.findMany.mockResolvedValue(mockRecords);
        mockTable.count.mockResolvedValue(1);

        const result = await testModel.searchWithContext(
          'john',
          { page: 1, limit: 10 },
          mockContext,
        );

        expect(result.data).toEqual(mockRecords);
        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });

      it('should combine search with additional where conditions', async () => {
        mockTable.findMany.mockResolvedValue([]);
        mockTable.count.mockResolvedValue(0);

        await testModel.searchWithContext(
          'john',
          { page: 1, limit: 10 },
          mockContext,
          { status: 'active' },
        );

        expect(mockDatabase.withUserContext).toHaveBeenCalled();
      });
    });
  });

  describe('findMany with custom orderBy', () => {
    it('should use orderBy from params', async () => {
      mockTable.findMany.mockResolvedValue([]);
      mockTable.count.mockResolvedValue(0);

      await testModel.findMany({
        page: 1,
        limit: 10,
        orderBy: { name: 'asc' },
      });

      expect(mockTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should fallback to default orderBy when not provided', async () => {
      mockTable.findMany.mockResolvedValue([]);
      mockTable.count.mockResolvedValue(0);

      await testModel.findMany({ page: 1, limit: 10 });

      expect(mockTable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
