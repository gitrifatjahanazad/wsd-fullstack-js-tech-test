/**
 * @fileoverview Integration tests for complete export workflow
 */

import { describe, it, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';

// Import app components
import app from '../../src/index.js';
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import { redisClient } from '../../src/config/redis.js';

describe('Export Integration Tests', () => {
  let server;
  let clientSocket;
  let serverSocket;
  let testTasks = [];

  before(async () => {
    // Setup test server
    server = createServer(app);
    const io = new SocketIOServer(server);
    
    server.listen(0); // Random port
    const port = server.address().port;

    // Setup Socket.IO client
    clientSocket = SocketIOClient(`http://localhost:${port}`);
    
    // Wait for client connection
    await new Promise((resolve) => {
      io.on('connection', (socket) => {
        serverSocket = socket;
        resolve();
      });
      clientSocket.connect();
    });

    // Create test data
    await createTestTasks();
  });

  after(async () => {
    // Cleanup
    await cleanupTestData();
    clientSocket.close();
    server.close();
    await redisClient.quit();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear exports between tests
    await Export.deleteMany({});
    await redisClient.flushall();
  });

  async function createTestTasks() {
    const tasks = [
      {
        title: 'Test Task 1',
        description: 'First test task',
        status: 'completed',
        priority: 'high',
        createdAt: new Date('2023-01-01'),
        completedAt: new Date('2023-01-02')
      },
      {
        title: 'Test Task 2',
        description: 'Second test task',
        status: 'in-progress',
        priority: 'medium',
        createdAt: new Date('2023-01-03')
      },
      {
        title: 'Important Task',
        description: 'Very important task',
        status: 'pending',
        priority: 'high',
        createdAt: new Date('2023-01-05')
      }
    ];

    for (const taskData of tasks) {
      const task = new Task(taskData);
      await task.save();
      testTasks.push(task);
    }
  }

  async function cleanupTestData() {
    await Task.deleteMany({});
    await Export.deleteMany({});
    
    // Clean up any test export files
    try {
      const exportDir = path.join(process.cwd(), 'exports');
      const files = await fs.readdir(exportDir).catch(() => []);
      for (const file of files) {
        if (file.includes('test-export')) {
          await fs.unlink(path.join(exportDir, file)).catch(() => {});
        }
      }
    } catch (error) {
      // Directory might not exist, ignore
    }
  }

  describe('Complete Export Workflow', () => {
    it('should handle full CSV export workflow with real-time updates', async () => {
      let exportUpdates = [];
      
      // Listen for real-time updates
      clientSocket.on('export-update', (data) => {
        exportUpdates.push(data);
      });

      clientSocket.emit('join-exports');

      // 1. Create export
      const exportResponse = await request(app)
        .post('/api/exports')
        .send({
          format: 'csv',
          filters: { status: 'completed' }
        })
        .expect(201);

      assert.strictEqual(exportResponse.body.success, true);
      const exportId = exportResponse.body.data._id;

      // 2. Wait for processing to complete
      await new Promise((resolve) => {
        const checkCompletion = () => {
          const completedUpdate = exportUpdates.find(u => 
            u.exportId === exportId && u.status === 'completed'
          );
          if (completedUpdate) {
            resolve();
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      // 3. Verify export status
      const statusResponse = await request(app)
        .get(`/api/exports/${exportId}`)
        .expect(200);

      assert.strictEqual(statusResponse.body.data.status, 'completed');
      assert.strictEqual(statusResponse.body.data.recordCount, 1); // Only completed tasks

      // 4. Download and verify file content
      const downloadResponse = await request(app)
        .get(`/api/exports/${exportId}/download`)
        .expect(200);

      assert.strictEqual(downloadResponse.headers['content-type'], 'text/csv');
      
      const csvContent = downloadResponse.text;
      assert.ok(csvContent.includes('Test Task 1')); // Should contain completed task
      assert.ok(!csvContent.includes('Test Task 2')); // Should not contain in-progress task

      // 5. Verify real-time updates were sent
      assert.ok(exportUpdates.length >= 2); // At least processing and completed
      assert.ok(exportUpdates.some(u => u.status === 'processing'));
      assert.ok(exportUpdates.some(u => u.status === 'completed'));
    });

    it('should handle JSON export with complex filters', async () => {
      const exportResponse = await request(app)
        .post('/api/exports')
        .send({
          format: 'json',
          filters: {
            priority: 'high',
            search: 'important',
            dateFrom: '2023-01-01',
            dateTo: '2023-12-31'
          }
        })
        .expect(201);

      const exportId = exportResponse.body.data._id;

      // Wait for completion
      let attempts = 0;
      while (attempts < 50) { // 5 second timeout
        const statusResponse = await request(app)
          .get(`/api/exports/${exportId}`)
          .expect(200);

        if (statusResponse.body.data.status === 'completed') {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Download and verify JSON structure
      const downloadResponse = await request(app)
        .get(`/api/exports/${exportId}/download`)
        .expect(200);

      assert.strictEqual(downloadResponse.headers['content-type'], 'application/json');
      
      const jsonData = JSON.parse(downloadResponse.text);
      assert.ok(jsonData.metadata);
      assert.ok(jsonData.tasks);
      assert.strictEqual(jsonData.metadata.format, 'json');
      assert.ok(jsonData.tasks.some(t => t.title.includes('Important')));
    });

    it('should use Redis cache for identical export requests', async () => {
      const filters = { status: 'completed' };
      
      // First export
      const firstResponse = await request(app)
        .post('/api/exports')
        .send({ format: 'csv', filters })
        .expect(201);

      const firstExportId = firstResponse.body.data._id;

      // Wait for completion
      let attempts = 0;
      while (attempts < 50) {
        const statusResponse = await request(app)
          .get(`/api/exports/${firstExportId}`)
          .expect(200);

        if (statusResponse.body.data.status === 'completed') {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Second identical export should use cache
      const secondResponse = await request(app)
        .post('/api/exports')
        .send({ format: 'csv', filters })
        .expect(200); // 200 for cached response

      assert.strictEqual(secondResponse.body.message, 'Export retrieved from cache');
      assert.strictEqual(secondResponse.body.data._id, firstExportId);
    });

    it('should handle export history pagination', async () => {
      // Create multiple exports
      const exports = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/exports')
          .send({
            format: i % 2 === 0 ? 'csv' : 'json',
            filters: { priority: i % 2 === 0 ? 'high' : 'low' }
          });
        exports.push(response.body.data);
      }

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test pagination
      const historyResponse = await request(app)
        .get('/api/exports?page=1&limit=3')
        .expect(200);

      assert.strictEqual(historyResponse.body.success, true);
      assert.ok(historyResponse.body.data.exports.length <= 3);
      assert.ok(historyResponse.body.data.pagination.total >= 5);
    });

    it('should handle export errors gracefully', async () => {
      // Mock a database error during export
      const originalFind = Task.find;
      Task.find = () => {
        throw new Error('Database connection failed');
      };

      let exportUpdates = [];
      clientSocket.on('export-update', (data) => {
        exportUpdates.push(data);
      });

      const exportResponse = await request(app)
        .post('/api/exports')
        .send({
          format: 'csv',
          filters: {}
        })
        .expect(201);

      const exportId = exportResponse.body.data._id;

      // Wait for failure
      await new Promise((resolve) => {
        const checkFailure = () => {
          const failedUpdate = exportUpdates.find(u => 
            u.exportId === exportId && u.status === 'failed'
          );
          if (failedUpdate) {
            resolve();
          } else {
            setTimeout(checkFailure, 100);
          }
        };
        checkFailure();
      });

      // Verify error state
      const statusResponse = await request(app)
        .get(`/api/exports/${exportId}`)
        .expect(200);

      assert.strictEqual(statusResponse.body.data.status, 'failed');
      assert.ok(statusResponse.body.data.error);

      // Restore original function
      Task.find = originalFind;
    });

    it('should validate export file downloads', async () => {
      // Test download of non-existent export
      await request(app)
        .get('/api/exports/nonexistent/download')
        .expect(404);

      // Test download of pending export
      const exportResponse = await request(app)
        .post('/api/exports')
        .send({
          format: 'csv',
          filters: {}
        })
        .expect(201);

      const exportId = exportResponse.body.data._id;

      // Try to download before completion
      const immediateDownload = await request(app)
        .get(`/api/exports/${exportId}/download`)
        .expect(404);

      assert.ok(immediateDownload.body.message.includes('not completed'));
    });
  });

  describe('Advanced Filtering Integration', () => {
    it('should filter tasks correctly with all filter combinations', async () => {
      // Test with multiple filters
      const response = await request(app)
        .get('/api/tasks')
        .query({
          status: 'completed',
          priority: 'high',
          search: 'test',
          dateFrom: '2023-01-01',
          dateTo: '2023-01-03'
        })
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.data.tasks.length, 1); // Only one matches all criteria
      assert.strictEqual(response.body.data.tasks[0].title, 'Test Task 1');
      
      // Verify filters are returned in response
      assert.deepStrictEqual(response.body.data.filters.status, 'completed');
      assert.deepStrictEqual(response.body.data.filters.priority, 'high');
    });

    it('should handle date range filtering correctly', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .query({
          completedDateFrom: '2023-01-01',
          completedDateTo: '2023-01-05'
        })
        .expect(200);

      // Should only return completed tasks within date range
      const completedTasks = response.body.data.tasks.filter(t => t.completedAt);
      assert.ok(completedTasks.length > 0);
      assert.ok(completedTasks.every(t => 
        new Date(t.completedAt) >= new Date('2023-01-01') &&
        new Date(t.completedAt) <= new Date('2023-01-05')
      ));
    });

    it('should handle text search across title and description', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .query({ search: 'important' })
        .expect(200);

      assert.ok(response.body.data.tasks.length > 0);
      assert.ok(response.body.data.tasks.some(t => 
        t.title.toLowerCase().includes('important') || 
        t.description.toLowerCase().includes('important')
      ));
    });
  });
});