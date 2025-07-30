/**
 * @fileoverview Unit tests for export routes
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/routes/api.js';

// Mock dependencies
const mockExportService = {
  createExport: mock.fn(),
  getExportHistory: mock.fn(),
  getExportFile: mock.fn(),
  getCachedExport: mock.fn()
};

const mockExport = {
  findById: mock.fn()
};

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  return app;
}

describe('Export Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    // Reset mocks
    Object.values(mockExportService).forEach(mockFn => mockFn.mock.resetCalls());
    mockExport.findById.mock.resetCalls();
  });

  describe('POST /api/exports', () => {
    it('should create new export with valid data', async () => {
      const exportData = {
        format: 'csv',
        filters: { status: 'completed' }
      };

      const mockExportJob = {
        _id: 'export123',
        format: 'csv',
        status: 'pending',
        filters: { status: 'completed' }
      };

      mockExportService.getCachedExport.mock.mockImplementationOnce(() => null);
      mockExportService.createExport.mock.mockImplementationOnce(() => mockExportJob);

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
        _id: 'cached123',
        format: 'csv',
        status: 'completed'
      };

      mockExportService.getCachedExport.mock.mockImplementationOnce(() => cachedExport);

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
          { _id: 'export1', format: 'csv', status: 'completed' },
          { _id: 'export2', format: 'json', status: 'processing' }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      };

      mockExportService.getExportHistory.mock.mockImplementationOnce(() => mockHistory);

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
        assert.strictEqual(params.page, '2');
        assert.strictEqual(params.limit, '5');
        return mockHistory;
      });

      await request(app)
        .get('/api/exports?page=2&limit=5')
        .expect(200);

      assert.strictEqual(mockExportService.getExportHistory.mock.callCount(), 1);
    });
  });

  describe('GET /api/exports/:id', () => {
    it('should return export details', async () => {
      const mockExportJob = {
        _id: 'export123',
        format: 'csv',
        status: 'completed'
      };

      mockExport.findById.mock.mockImplementationOnce(() => mockExportJob);

      const response = await request(app)
        .get('/api/exports/export123')
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data._id, 'export123');
    });

    it('should return 404 for non-existent export', async () => {
      mockExport.findById.mock.mockImplementationOnce(() => null);

      const response = await request(app)
        .get('/api/exports/nonexistent')
        .expect(404);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Export not found');
    });
  });

  describe('GET /api/exports/:id/download', () => {
    it('should handle successful download', async () => {
      const mockFileInfo = {
        filePath: '/tmp/export.csv',
        fileName: 'tasks-export.csv',
        format: 'csv',
        recordCount: 100
      };

      mockExportService.getExportFile.mock.mockImplementationOnce(() => mockFileInfo);

      // Note: This test would need additional setup to fully test file sending
      // For now, we just verify the service is called correctly
      const response = await request(app)
        .get('/api/exports/export123/download');

      assert.strictEqual(mockExportService.getExportFile.mock.callCount(), 1);
    });

    it('should return 404 for unavailable export file', async () => {
      mockExportService.getExportFile.mock.mockImplementationOnce(() => {
        throw new Error('Export file no longer available');
      });

      const response = await request(app)
        .get('/api/exports/export123/download')
        .expect(404);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Export file no longer available');
    });
  });
});