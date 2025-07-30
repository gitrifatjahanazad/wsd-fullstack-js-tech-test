/**
 * @fileoverview Export store for managing task export operations and history
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for export management with real-time updates
 * @function useExportStore
 * @returns {Object} Export store with reactive state and methods
 */
export const useExportStore = defineStore('exports', () => {
  const exports = ref([])
  const loading = ref(false)
  const error = ref(null)
  const exportProgress = ref({})
  const offlineQueue = ref([])
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  const activeExports = computed(() =>
    exports.value.filter((exp) =>
      ['pending', 'processing'].includes(exp.status)
    )
  )

  const completedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'completed')
  )

  const failedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'failed')
  )

  /**
   * Creates a new export job with offline support
   * @async
   * @function createExport
   * @param {Object} exportOptions - Export options
   * @param {string} exportOptions.format - Export format ('csv' or 'json')
   * @param {Object} exportOptions.filters - Filters to apply
   * @returns {Promise<Object>} Created export job
   */
  async function createExport(exportOptions) {
    // Check if offline
    if (!navigator.onLine) {
      // Queue for when back online
      const queuedExport = {
        id: Date.now().toString(),
        ...exportOptions,
        queuedAt: new Date(),
        status: 'queued-offline'
      }

      offlineQueue.value.push(queuedExport)
      error.value =
        'Export queued - will be processed when connection is restored'
      return queuedExport
    }

    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createExport(exportOptions)

      // Add to exports list if it's a new export (not cached)
      if (response.data.status === 'pending') {
        exports.value.unshift(response.data)
        exportProgress.value[response.data._id] = {
          status: 'pending',
          message: 'Export queued for processing...'
        }
      }

      return response.data
    } catch (err) {
      // Handle network errors gracefully
      if (err.message.includes('fetch') || err.message.includes('network')) {
        error.value =
          'Network error - please check your connection and try again'
      } else {
        error.value = err.message
      }
      console.error('Error creating export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches export history with pagination
   * @async
   * @function fetchExports
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchExports(params = {}) {
    loading.value = true
    error.value = null

    try {
      const queryParams = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...params
      }

      const response = await apiClient.getExports(queryParams)

      exports.value = response.data.exports
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error fetching exports:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Downloads an export file
   * @async
   * @function downloadExport
   * @param {string} exportId - Export ID
   * @returns {Promise<void>}
   */
  async function downloadExport(exportId) {
    try {
      // First check if export is completed
      const exportJob = exports.value.find((exp) => exp._id === exportId)
      if (!exportJob) {
        throw new Error('Export not found')
      }

      if (exportJob.status !== 'completed') {
        throw new Error('Export is not ready for download')
      }

      // Create download link
      const url = `/api/exports/${exportId}/download`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Download failed' }))
        throw new Error(
          errorData.message || `Download failed: ${response.statusText}`
        )
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `export.${exportJob.format}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      error.value = err.message
      console.error('Error downloading export:', err)

      // Show user-friendly error message
      if (err.message.includes('not found')) {
        error.value = 'Export file not found. It may have been deleted.'
      } else if (err.message.includes('not ready')) {
        error.value = 'Export is still processing. Please wait for completion.'
      } else {
        error.value = 'Failed to download export. Please try again.'
      }

      throw err
    }
  }

  /**
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchExports()
  }

  /**
   * Handles real-time export updates from Socket.IO
   * @function handleExportUpdate
   * @param {Object} data - Export update data
   */
  function handleExportUpdate(data) {
    const { exportId, status } = data

    // Update progress tracking
    exportProgress.value[exportId] = {
      status,
      message: getStatusMessage(status),
      timestamp: data.timestamp
    }

    // Update export in list
    const index = exports.value.findIndex((exp) => exp._id === exportId)
    if (index !== -1) {
      exports.value[index] = {
        ...exports.value[index],
        status,
        recordCount: data.recordCount,
        completedAt:
          status === 'completed' || status === 'failed' ? new Date() : null
      }
    }

    // Clean up progress tracking for completed/failed exports
    if (['completed', 'failed'].includes(status)) {
      setTimeout(() => {
        delete exportProgress.value[exportId]
      }, 5000) // Keep status for 5 seconds
    }
  }

  /**
   * Gets status message for export progress
   * @function getStatusMessage
   * @param {string} status - Export status
   * @returns {string} Status message
   */
  function getStatusMessage(status) {
    switch (status) {
      case 'pending':
        return 'Export queued for processing...'
      case 'processing':
        return 'Processing export...'
      case 'completed':
        return 'Export completed successfully!'
      case 'failed':
        return 'Export failed. Please try again.'
      default:
        return 'Unknown status'
    }
  }

  /**
   * Sets up Socket.IO event listeners
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.emit('join-exports')
    socket.on('export-update', handleExportUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('export-update', handleExportUpdate)
  }

  /**
   * Formats export filters for display
   * @function formatFilters
   * @param {Object} filters - Export filters
   * @returns {string} Formatted filter description
   */
  function formatFilters(filters) {
    // Handle undefined or null filters
    if (!filters || typeof filters !== 'object') {
      return 'No filters applied'
    }

    const parts = []

    if (filters.status && filters.status !== 'all') {
      parts.push(`Status: ${filters.status}`)
    }

    if (filters.priority && filters.priority !== 'all') {
      parts.push(`Priority: ${filters.priority}`)
    }

    if (filters.search) {
      parts.push(`Search: "${filters.search}"`)
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateRange = []
      if (filters.dateFrom) {
        dateRange.push(
          `from ${new Date(filters.dateFrom).toLocaleDateString()}`
        )
      }
      if (filters.dateTo) {
        dateRange.push(`to ${new Date(filters.dateTo).toLocaleDateString()}`)
      }
      parts.push(`Created: ${dateRange.join(' ')}`)
    }

    return parts.length > 0 ? parts.join(', ') : 'No filters applied'
  }

  /**
   * Processes offline queue when connection is restored
   * @async
   * @function processOfflineQueue
   * @returns {Promise<void>}
   */
  async function processOfflineQueue() {
    if (offlineQueue.value.length === 0) return

    const queuedExports = [...offlineQueue.value]
    offlineQueue.value = []

    for (const queuedExport of queuedExports) {
      try {
        await createExport({
          format: queuedExport.format,
          filters: queuedExport.filters
        })
      } catch (error) {
        console.error('Failed to process queued export:', error)
        // Re-queue failed exports
        offlineQueue.value.push(queuedExport)
      }
    }
  }

  return {
    exports,
    loading,
    error,
    exportProgress,
    offlineQueue,
    pagination,
    activeExports,
    completedExports,
    failedExports,
    createExport,
    fetchExports,
    downloadExport,
    setPage,
    handleExportUpdate,
    initializeSocketListeners,
    cleanup,
    formatFilters,
    processOfflineQueue
  }
})
