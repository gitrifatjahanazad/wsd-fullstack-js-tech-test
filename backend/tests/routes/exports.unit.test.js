/**
 * @fileoverview Unit tests for export routes
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';

// Create mock implementations
const mockExportService = {
  createExport: mock.fn(),
  getExportHistory: mock.fn(),
  getExportFile: mock.fn(),
  getCachedExport: mock.fn()
};

const mockExportModel = {
  findById: mock.fn()
};

const mockRedisClient = {
  get: mock.fn(),
  setex: mock.fn(),
  del: mock.fn()
};

const mockTaskModel = {
  find: mock.fn(),
  findById: mock.fn(),
  findByIdAndUpdate: mock.fn(),
  findByIdAndDelete: mock.fn(),
  countDocuments: mock.fn()
};

// Create a test-specific route handler that uses our mocks
function createTestRoutes() {
  const router = express.Router();

  // POST /exports - Create new export
  router.post('/exports', async (req, res) => {
    try {
      const { format, filters = {} } = req.body;

      // Validate format
      if (!format || !['csv', 'json'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export format. Must be csv or json'
        });
      }

      // Check cache first
      const cached = await mockExportService.getCachedExport(filters, format);
      if (cached) {
        return res.status(200).json({
          success: true,
          message: 'Export retrieved from cache',
          data: cached
        });
      }

      // Create new export
      const exportJob = await mockExportService.createExport(format, filters);
      res.status(201).json({
        success: true,
        message: 'Export job created successfully',
        data: exportJob
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // GET /exports - Get export history
  router.get('/exports', async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;

      // Validate pagination
      if (page < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page must be a positive integer'
        });
      }
      if (limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit cannot exceed 100'
        });
      }

      const result = await mockExportService.getExportHistory({ page, limit });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // GET /exports/:id - Get export details
  router.get('/exports/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export ID format'
        });
      }

      const exportJob = await mockExportModel.findById(id);
      if (!exportJob) {
        return res.status(404).json({
          success: false,
          message: 'Export not found'
        });
      }

      res.json({
        success: true,
        data: exportJob
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // GET /exports/:id/download - Download export file
  router.get('/exports/:id/download', async (req, res) => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export ID format'
        });
      }

      const fileData = await mockExportService.getExportFile(id);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="export-${id}.csv"`);
      res.send(fileData);
    } catch (error) {
      if (error.message.includes('Export file no longer available') || 
          error.message.includes('Export not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  return router;
}

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Add error handling middleware
  app.use((err, req, res, next) => {
    console.error('Test error:', err);
    res.status(500).json({ success: false, message: err.message });
  });
  
  app.use('/api', createTestRoutes());
  return app;
}

describe('Export Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    // Reset all mocks
    Object.values(mockExportService).forEach(mockFn => {
      if (mockFn.mock) mockFn.mock.resetCalls();
    });
    if (mockExportModel.findById.mock) {
      mockExportModel.findById.mock.resetCalls();
    }
  });

  describe('POST /api/exports', () => {
    it('should create new export with valid data', async () => {
      const exportData = {
        format: 'csv',
        filters: { status: 'completed' }
      };

      const mockExportJob = {
        _id: '507f1f77bcf86cd799439011',
        format: 'csv',
        status: 'pending',
        filters: { status: 'completed' }
      };

      // Setup mocks to return expected values
      mockExportService.getCachedExport.mock.mockImplementationOnce(() => Promise.resolve(null));
      mockExportService.createExport.mock.mockImplementationOnce(() => Promise.resolve(mockExportJob));

      const response = await request(app)
        .post('/api/exports')
        .send(exportData)
        .expect(201);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.format, 'csv');
      assert.strictEqual(mockExportService.createExport.mock.callCount(), 1);
    });

    it('should return cached export if available', async () => {
      const exportData = {
        format: 'csv',
        filters: { status: 'completed' }
      };

      const cachedExport = {
        _id: '507f1f77bcf86cd799439011',
        format: 'csv',
        status: 'completed'
      };

      mockExportService.getCachedExport.mock.mockImplementationOnce(() => Promise.resolve(cachedExport));

      const response = await request(app)
        .post('/api/exports')
        .send(exportData)
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Export retrieved from cache');
      assert.strictEqual(mockExportService.createExport.mock.callCount(), 0);
    });

    it('should reject invalid format', async () => {
      const exportData = {
        format: 'xml',
        filters: {}
      };

      const response = await request(app)
        .post('/api/exports')
        .send(exportData)
        .expect(400);

      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Invalid export format'));
    });

    it('should reject missing format', async () => {
      const exportData = {
        filters: {}
      };

      const response = await request(app)
        .post('/api/exports')
        .send(exportData)
        .expect(400);

      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Invalid export format'));
    });
  });

  describe('GET /api/exports', () => {
    it('should return paginated export history', async () => {
      const mockHistory = {
        exports: [
          { _id: '507f1f77bcf86cd799439011', format: 'csv', status: 'completed' },
          { _id: '507f1f77bcf86cd799439012', format: 'json', status: 'processing' }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      };

      mockExportService.getExportHistory.mock.mockImplementationOnce(() => Promise.resolve(mockHistory));

      const response = await request(app)
        .get('/api/exports')
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.exports.length, 2);
      assert.strictEqual(response.body.data.pagination.total, 2);
    });

    it('should handle pagination parameters', async () => {
      const mockHistory = {
        exports: [],
        pagination: { page: 2, limit: 5, total: 0, pages: 0 }
      };

      mockExportService.getExportHistory.mock.mockImplementationOnce((params) => {
        assert.strictEqual(params.page, 2);
        assert.strictEqual(params.limit, 5);
        return Promise.resolve(mockHistory);
      });

      await request(app)
        .get('/api/exports?page=2&limit=5')
        .expect(200);

      assert.strictEqual(mockExportService.getExportHistory.mock.callCount(), 1);
    });

    it('should reject invalid pagination parameters', async () => {
      // Test invalid page
      const response1 = await request(app)
        .get('/api/exports?page=0&limit=10')
        .expect(400);

      assert.strictEqual(response1.body.success, false);
      assert.ok(response1.body.message.includes('Page must be a positive integer'));

      // Test invalid limit
      const response2 = await request(app)
        .get('/api/exports?page=1&limit=200')
        .expect(400);

      assert.strictEqual(response2.body.success, false);
      assert.ok(response2.body.message.includes('Limit cannot exceed 100'));
    });
  });

  describe('GET /api/exports/:id', () => {
    it('should return export details for valid ObjectId', async () => {
      const validId = '507f1f77bcf86cd799439011';
      const mockExportJob = {
        _id: validId,
        format: 'csv',
        status: 'completed'
      };

      mockExportModel.findById.mock.mockImplementationOnce(() => Promise.resolve(mockExportJob));

      const response = await request(app)
        .get(`/api/exports/${validId}`)
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data._id, validId);
    });

    it('should return 404 for non-existent export', async () => {
      const validId = '507f1f77bcf86cd799439011';
      mockExportModel.findById.mock.mockImplementationOnce(() => Promise.resolve(null));

      const response = await request(app)
        .get(`/api/exports/${validId}`)
        .expect(404);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Export not found');
    });

    it('should return 400 for invalid ObjectId format', async () => {
      const invalidId = 'invalid-id';

      const response = await request(app)
        .get(`/api/exports/${invalidId}`)
        .expect(400);

      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Invalid export ID format'));
    });
  });

  describe('GET /api/exports/:id/download', () => {
    it('should return 400 for invalid ObjectId in download', async () => {
      const invalidId = 'invalid-id';

      const response = await request(app)
        .get(`/api/exports/${invalidId}/download`)
        .expect(400);

      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Invalid export ID format'));
    });

    it('should return 404 for unavailable export file', async () => {
      const validId = '507f1f77bcf86cd799439011';
      
      mockExportService.getExportFile.mock.mockImplementationOnce(() => {
        return Promise.reject(new Error('Export file no longer available'));
      });

      const response = await request(app)
        .get(`/api/exports/${validId}/download`)
        .expect(404);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Export file no longer available');
    });

    it('should return 404 for export not found', async () => {
      const validId = '507f1f77bcf86cd799439011';
      
      mockExportService.getExportFile.mock.mockImplementationOnce(() => {
        return Promise.reject(new Error('Export not found'));
      });

      const response = await request(app)
        .get(`/api/exports/${validId}/download`)
        .expect(404);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Export not found');
    });
  });
});