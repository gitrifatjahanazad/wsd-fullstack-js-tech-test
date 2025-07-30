/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for task management with pagination, filtering, and real-time updates
 * @function useTaskStore
 * @returns {Object} Task store with reactive state and methods
 */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  const filters = ref({
    status: '',
    priority: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    completedDateFrom: '',
    completedDateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  const pendingTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'pending')
  )

  const inProgressTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'in-progress')
  )

  const completedTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'completed')
  )

  const highPriorityTasks = computed(() =>
    tasks.value.filter((task) => task.priority === 'high')
  )

  const tasksByStatus = computed(() => ({
    pending: pendingTasks.value.length,
    'in-progress': inProgressTasks.value.length,
    completed: completedTasks.value.length
  }))

  const tasksByPriority = computed(() => ({
    low: tasks.value.filter((task) => task.priority === 'low').length,
    medium: tasks.value.filter((task) => task.priority === 'medium').length,
    high: tasks.value.filter((task) => task.priority === 'high').length
  }))

  /**
   * Fetches tasks with pagination and filtering
   * @async
   * @function fetchTasks
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchTasks(params = {}) {
    loading.value = true
    error.value = null

    try {
      const queryParams = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...filters.value,
        ...params
      }

      Object.keys(queryParams).forEach((key) => {
        if (!queryParams[key]) delete queryParams[key]
      })

      const response = await apiClient.getTasks(queryParams)

      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error fetching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches a single task by ID
   * @async
   * @function getTask
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async function getTask(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getTask(id)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new task
   * @async
   * @function createTask
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async function createTask(taskData) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createTask(taskData)

      tasks.value.unshift(response.data)
      pagination.value.total++

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates an existing task
   * @async
   * @function updateTask
   * @param {string} id - Task ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated task
   */
  async function updateTask(id, updates) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.updateTask(id, updates)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error updating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Deletes a task by ID
   * @async
   * @function deleteTask
   * @param {string} id - Task ID
   * @returns {Promise<void>}
   */
  async function deleteTask(id) {
    loading.value = true
    error.value = null

    try {
      await apiClient.deleteTask(id)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value.splice(index, 1)
        pagination.value.total--
      }
    } catch (err) {
      error.value = err.message
      console.error('Error deleting task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates task filters and refetches data
   * @function updateFilters
   * @param {Object} newFilters - New filter values
   */
  function updateFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchTasks()
  }

  /**
   * Handles real-time task updates from Socket.IO
   * @function handleTaskUpdate
   * @param {Object} data - Task update data
   */
  function handleTaskUpdate(data) {
    const { action, task } = data

    switch (action) {
      case 'created':
        if (!tasks.value.find((t) => t._id === task._id)) {
          tasks.value.unshift(task)
          pagination.value.total++
        }
        break
      case 'updated': {
        const index = tasks.value.findIndex((t) => t._id === task._id)
        if (index !== -1) {
          tasks.value[index] = task
        }
        break
      }
      case 'deleted': {
        const deleteIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (deleteIndex !== -1) {
          tasks.value.splice(deleteIndex, 1)
          pagination.value.total--
        }
        break
      }
    }
  }

  /**
   * Sets up Socket.IO event listeners
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('task-update', handleTaskUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('task-update', handleTaskUpdate)
  }

  return {
    tasks,
    loading,
    error,
    pagination,
    filters,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    setPage,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup
  }
})
