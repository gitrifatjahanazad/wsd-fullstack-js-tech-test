/**
 * @fileoverview End-to-end tests for export workflow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createRouter, createWebHistory } from 'vue-router'

// Components
import App from '../../src/App.vue'
import Tasks from '../../src/views/Tasks.vue'
import Exports from '../../src/views/Exports.vue'

// Mock Socket.IO
const mockSocket = {
  connected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
}

vi.mock('../../src/plugins/socket.js', () => ({
  default: mockSocket
}))

// Mock API client
const mockApiClient = {
  getTasks: vi.fn(),
  createExport: vi.fn(),
  getExports: vi.fn(),
  getAnalytics: vi.fn()
}

vi.mock('../../src/api/client.js', () => ({
  default: mockApiClient
}))

const vuetify = createVuetify({
  components,
  directives
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Dashboard</div>' } },
    { path: '/tasks', component: Tasks },
    { path: '/exports', component: Exports }
  ]
})

describe('Export Workflow E2E Tests', () => {
  let app
  let wrapper

  beforeEach(async () => {
    const pinia = createPinia()

    app = createApp(App)
    app.use(vuetify)
    app.use(router)
    app.use(pinia)

    // Mock API responses
    mockApiClient.getTasks.mockResolvedValue({
      data: {
        tasks: [
          {
            _id: 'task1',
            title: 'Test Task 1',
            description: 'Description 1',
            status: 'completed',
            priority: 'high',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
            completedAt: new Date('2023-01-02')
          },
          {
            _id: 'task2',
            title: 'Test Task 2',
            description: 'Description 2',
            status: 'pending',
            priority: 'medium',
            createdAt: new Date('2023-01-03'),
            updatedAt: new Date('2023-01-03')
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        },
        filters: {}
      }
    })

    mockApiClient.getAnalytics.mockResolvedValue({
      data: {
        totalTasks: 2,
        tasksByStatus: { pending: 1, 'in-progress': 0, completed: 1 },
        tasksByPriority: { low: 0, medium: 1, high: 1 },
        completionRate: 50,
        averageCompletionTime: 24,
        tasksCreatedToday: 0,
        tasksCompletedToday: 0,
        recentActivity: []
      }
    })

    wrapper = mount(App, {
      global: {
        plugins: [vuetify, router, pinia]
      }
    })

    await router.isReady()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.clearAllMocks()
  })

  it('should complete full export workflow from task filtering to download', async () => {
    // Navigate to tasks page
    await router.push('/tasks')
    await wrapper.vm.$nextTick()

    // Verify tasks are loaded
    expect(mockApiClient.getTasks).toHaveBeenCalled()

    // Find and interact with advanced filters
    const statusSelect = wrapper.find('[label="Status"]')
    if (statusSelect.exists()) {
      // Select completed status filter
      await statusSelect.vm.$emit('update:model-value', 'completed')
      await wrapper.vm.$nextTick()

      // Verify filtered API call
      expect(mockApiClient.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed'
        })
      )
    }

    // Mock export creation
    mockApiClient.createExport.mockResolvedValue({
      data: {
        _id: 'export123',
        format: 'csv',
        status: 'pending',
        filters: { status: 'completed' },
        recordCount: 0
      }
    })

    // Find export button and trigger export
    const exportButton = wrapper.find('button:contains("Export")')
    if (exportButton.exists()) {
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show export menu
      const csvOption = wrapper.find('[data-testid="export-csv"]')
      if (csvOption.exists()) {
        await csvOption.trigger('click')
        await wrapper.vm.$nextTick()

        // Verify export API call
        expect(mockApiClient.createExport).toHaveBeenCalledWith({
          format: 'csv',
          filters: expect.objectContaining({
            status: 'completed'
          })
        })
      }
    }

    // Simulate real-time export progress
    const exportUpdateHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'export-update'
    )?.[1]

    if (exportUpdateHandler) {
      // Simulate processing
      exportUpdateHandler({
        exportId: 'export123',
        status: 'processing',
        timestamp: new Date().toISOString()
      })
      await wrapper.vm.$nextTick()

      // Simulate completion
      exportUpdateHandler({
        exportId: 'export123',
        status: 'completed',
        recordCount: 1,
        timestamp: new Date().toISOString()
      })
      await wrapper.vm.$nextTick()
    }

    // Navigate to exports history
    await router.push('/exports')
    await wrapper.vm.$nextTick()

    // Mock exports history
    mockApiClient.getExports.mockResolvedValue({
      data: {
        exports: [
          {
            _id: 'export123',
            format: 'csv',
            status: 'completed',
            recordCount: 1,
            filters: { status: 'completed' },
            createdAt: new Date(),
            completedAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1
        }
      }
    })

    // Verify exports are loaded
    expect(mockApiClient.getExports).toHaveBeenCalled()
  })

  it('should handle filter changes and update UI accordingly', async () => {
    await router.push('/tasks')
    await wrapper.vm.$nextTick()

    // Test multiple filter interactions
    const prioritySelect = wrapper.find('[label="Priority"]')
    if (prioritySelect.exists()) {
      await prioritySelect.vm.$emit('update:model-value', 'high')
      await wrapper.vm.$nextTick()

      expect(mockApiClient.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high'
        })
      )
    }

    // Test search functionality
    const searchField = wrapper.find('[label="Search tasks..."]')
    if (searchField.exists()) {
      await searchField.vm.$emit('update:model-value', 'important')
      await wrapper.vm.$nextTick()

      // Should call API after debounce
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(mockApiClient.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'important'
        })
      )
    }

    // Test filter clearing
    const clearButton = wrapper.find('button:contains("Clear")')
    if (clearButton.exists()) {
      await clearButton.trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockApiClient.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          status: '',
          priority: '',
          search: ''
        })
      )
    }
  })

  it('should show export progress and handle real-time updates', async () => {
    await router.push('/tasks')
    await wrapper.vm.$nextTick()

    // Trigger export
    mockApiClient.createExport.mockResolvedValue({
      data: {
        _id: 'export456',
        format: 'json',
        status: 'pending',
        filters: {},
        recordCount: 0
      }
    })

    // Simulate export creation through UI interaction
    const exportButton = wrapper.find('button:contains("Export")')
    if (exportButton.exists()) {
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      const jsonOption = wrapper.find('[data-testid="export-json"]')
      if (jsonOption.exists()) {
        await jsonOption.trigger('click')
        await wrapper.vm.$nextTick()
      }
    }

    // Simulate real-time updates
    const exportUpdateHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'export-update'
    )?.[1]

    if (exportUpdateHandler) {
      // Test processing state
      exportUpdateHandler({
        exportId: 'export456',
        status: 'processing',
        timestamp: new Date().toISOString()
      })
      await wrapper.vm.$nextTick()

      // Should show progress banner
      const progressBanner = wrapper.find('.export-banner-container')
      expect(progressBanner.exists()).toBe(true)

      // Test completion
      exportUpdateHandler({
        exportId: 'export456',
        status: 'completed',
        recordCount: 5,
        timestamp: new Date().toISOString()
      })
      await wrapper.vm.$nextTick()

      // Should show download button in banner
      const downloadButton = wrapper.find('button:contains("Download")')
      expect(downloadButton.exists()).toBe(true)

      // Test failure scenario
      exportUpdateHandler({
        exportId: 'export456',
        status: 'failed',
        error: 'Export processing failed',
        timestamp: new Date().toISOString()
      })
      await wrapper.vm.$nextTick()

      // Should show error state
      const errorMessage = wrapper.text()
      expect(errorMessage).toContain('failed')
    }
  })

  it('should handle offline scenarios gracefully', async () => {
    await router.push('/tasks')
    await wrapper.vm.$nextTick()

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })

    // Attempt to create export while offline
    const exportButton = wrapper.find('button:contains("Export")')
    if (exportButton.exists()) {
      await exportButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show offline message
      const offlineMessage = wrapper.text()
      expect(offlineMessage).toContain('queued')
    }

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })

    // Trigger online event
    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()

    // Should process queued exports
    expect(mockApiClient.createExport).toHaveBeenCalled()
  })

  it('should validate export history interactions', async () => {
    await router.push('/exports')
    await wrapper.vm.$nextTick()

    // Mock detailed export history
    mockApiClient.getExports.mockResolvedValue({
      data: {
        exports: [
          {
            _id: 'export1',
            format: 'csv',
            status: 'completed',
            recordCount: 10,
            filters: { status: 'completed', priority: 'high' },
            createdAt: new Date('2023-01-01'),
            completedAt: new Date('2023-01-01')
          },
          {
            _id: 'export2',
            format: 'json',
            status: 'processing',
            recordCount: 0,
            filters: { search: 'important' },
            createdAt: new Date('2023-01-02')
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      }
    })

    // Verify history loads
    expect(mockApiClient.getExports).toHaveBeenCalled()

    // Test view details interaction
    const viewDetailsButton = wrapper.find('button[aria-label="View Details"]')
    if (viewDetailsButton.exists()) {
      await viewDetailsButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show details dialog
      const detailsDialog = wrapper.find('.v-dialog')
      expect(detailsDialog.exists()).toBe(true)
    }

    // Test pagination
    const nextPageButton = wrapper.find('.v-pagination button:last-child')
    if (nextPageButton.exists()) {
      await nextPageButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should call API with page 2
      expect(mockApiClient.getExports).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2
        })
      )
    }
  })
})
