/**
 * @fileoverview Vue Router configuration for application navigation
 * @module router/index
 */

import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Tasks from '../views/Tasks.vue'
import Analytics from '../views/Analytics.vue'
import Exports from '../views/Exports.vue'

/**
 * Application route definitions
 * @type {Array<Object>}
 * @description Defines all available routes in the application
 */
const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: Tasks
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: Analytics
  },
  {
    path: '/exports',
    name: 'Exports',
    component: Exports
  }
]

/**
 * Vue Router instance configured with HTML5 history mode
 * @type {Router}
 * @description Main application router for navigation between views
 */
const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
