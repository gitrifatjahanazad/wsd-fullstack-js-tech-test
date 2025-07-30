/**
 * @fileoverview HTTP API client for task management backend
 * @module api/client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * HTTP client for communicating with the task management API
 * @class ApiClient
 */
class ApiClient {
  /**
   * Creates ApiClient instance with base URL configuration
   */
  constructor() {
    this.baseURL = `${API_BASE_URL}/api`
  }

  /**
   * Makes HTTP request to API endpoint with error handling
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options={}] - Fetch options
   * @returns {Promise<Object>} API response data
   * @throws {Error} Network or API errors
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        )
      }

      return data
    } catch (error) {
      console.error('API Request failed:', error)
      throw error
    }
  }

  /**
   * Makes GET request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [params={}] - URL query parameters
   * @returns {Promise<Object>} API response data
   */
  async get(endpoint, params = {}) {
    const query = new window.URLSearchParams(params).toString()
    const url = query ? `${endpoint}?${query}` : endpoint
    return this.request(url, { method: 'GET' })
  }

  /**
   * Makes POST request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    })
  }

  /**
   * Makes PUT request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    })
  }

  /**
   * Makes DELETE request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<Object>} API response data
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }

  /**
   * Retrieves tasks with optional filtering and pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, priority, etc.)
   * @returns {Promise<Object>} Paginated tasks response
   */
  async getTasks(params = {}) {
    return this.get('/tasks', params)
  }

  /**
   * Retrieves a specific task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async getTask(id) {
    return this.get(`/tasks/${id}`)
  }

  /**
   * Creates a new task
   * @async
   * @param {Object} task - Task data
   * @returns {Promise<Object>} Created task response
   */
  async createTask(task) {
    return this.post('/tasks', task)
  }

  /**
   * Updates an existing task
   * @async
   * @param {string} id - Task ID
   * @param {Object} updates - Task update data
   * @returns {Promise<Object>} Updated task response
   */
  async updateTask(id, updates) {
    return this.put(`/tasks/${id}`, updates)
  }

  /**
   * Deletes a task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Deletion confirmation response
   */
  async deleteTask(id) {
    return this.delete(`/tasks/${id}`)
  }

  /**
   * Retrieves analytics and metrics data
   * @async
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalytics() {
    return this.get('/analytics')
  }

  /**
   * Creates a new export job
   * @async
   * @param {Object} exportOptions - Export options
   * @param {string} exportOptions.format - Export format ('csv' or 'json')
   * @param {Object} exportOptions.filters - Filters to apply
   * @returns {Promise<Object>} Export job response
   */
  async createExport(exportOptions) {
    return this.post('/exports', exportOptions)
  }

  /**
   * Retrieves export history with pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit)
   * @returns {Promise<Object>} Paginated exports response
   */
  async getExports(params = {}) {
    return this.get('/exports', params)
  }

  /**
   * Retrieves a specific export by ID
   * @async
   * @param {string} id - Export ID
   * @returns {Promise<Object>} Export data
   */
  async getExport(id) {
    return this.get(`/exports/${id}`)
  }

  /**
   * Downloads an export file
   * @async
   * @param {string} id - Export ID
   * @returns {Promise<Blob>} Export file blob
   */
  async downloadExport(id) {
    const url = `${this.baseURL}/exports/${id}/download`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    return response.blob()
  }

  /**
   * Checks API health status
   * @async
   * @returns {Promise<Object>} Health check response
   */
  async getHealth() {
    return this.get('/health')
  }
}

export default new ApiClient()
