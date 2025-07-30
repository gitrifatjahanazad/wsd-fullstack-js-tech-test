/**
 * @fileoverview Simplified test setup to avoid circular reference issues
 */

import { config } from '@vue/test-utils'
import { vi } from 'vitest'

// Simple mock Vuetify instance
const vuetify = {
  install: () => {},
  global: {
    $vuetify: {
      theme: { current: { dark: false } },
      display: { mobile: false }
    }
  }
}

// Simplified mock components to avoid circular references
const mockComponents = {
  VApp: { template: '<div class="v-app"><slot /></div>' },
  VMain: { template: '<main class="v-main"><slot /></main>' },
  VContainer: { template: '<div class="v-container"><slot /></div>' },
  VRow: { template: '<div class="v-row"><slot /></div>' },
  VCol: { template: '<div class="v-col"><slot /></div>' },
  VCard: { template: '<div class="v-card"><slot /></div>' },
  VCardText: { template: '<div class="v-card-text"><slot /></div>' },
  VCardTitle: { template: '<div class="v-card-title"><slot /></div>' },
  VCardActions: { template: '<div class="v-card-actions"><slot /></div>' },
  VBtn: {
    template: '<button class="v-btn"><slot /></button>',
    props: ['color', 'variant', 'size', 'disabled', 'loading', 'block', 'icon']
  },
  VIcon: {
    template: '<i class="v-icon"><slot /></i>',
    props: ['color', 'size', 'left']
  },
  VChip: {
    template: '<span class="v-chip"><slot /></span>',
    props: ['color', 'size', 'variant']
  },
  VTextField: {
    template: '<input class="v-text-field" />',
    props: [
      'modelValue',
      'label',
      'placeholder',
      'clearable',
      'prependInnerIcon'
    ]
  },
  VSelect: {
    template: '<select class="v-select"><option>Mock Option</option></select>',
    props: ['modelValue', 'items', 'itemTitle', 'itemValue', 'placeholder']
  },
  VProgressCircular: {
    template: '<div class="v-progress-circular"></div>',
    props: ['indeterminate', 'size']
  },
  VAlert: {
    template: '<div class="v-alert"><slot /></div>',
    props: ['type']
  },
  VList: { template: '<div class="v-list"><slot /></div>' },
  VListItem: {
    template: '<div class="v-list-item"><slot /></div>',
    props: ['title', 'subtitle']
  },
  VListItemTitle: { template: '<div class="v-list-item-title"><slot /></div>' },
  VMenu: {
    template: '<div class="v-menu"><slot /></div>',
    props: ['modelValue']
  },
  VDataTable: {
    template:
      '<div class="v-data-table"><table><tbody><tr><td>Mock Data</td></tr></tbody></table></div>',
    props: ['headers', 'items', 'loading', 'itemKey', 'height', 'fixedHeader']
  },
  VSpacer: { template: '<div class="v-spacer"></div>' },
  VPagination: {
    template: '<div class="v-pagination">Page 1 of 1</div>',
    props: ['modelValue', 'length']
  },
  VDivider: { template: '<hr class="v-divider" />' },
  VExpandTransition: {
    template: '<div class="v-expand-transition"><slot /></div>'
  },
  VDialog: {
    template: '<div class="v-dialog"><slot /></div>',
    props: ['modelValue', 'maxWidth']
  }
}

// Configure Vue Test Utils globally
config.global.plugins = [vuetify]
config.global.components = mockComponents
config.global.stubs = {
  transition: false,
  'transition-group': false,
  ...mockComponents
}

// Mock global APIs
globalThis.CSS = { supports: () => false }
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Simple mock task store for tests
const mockTaskStore = {
  tasks: [
    {
      _id: '1',
      title: 'Task 1',
      status: 'pending',
      priority: 'low',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      _id: '2',
      title: 'Task 2',
      status: 'in-progress',
      priority: 'medium',
      createdAt: '2024-01-02T00:00:00.000Z'
    },
    {
      _id: '3',
      title: 'Task 3',
      status: 'completed',
      priority: 'high',
      createdAt: '2024-01-03T00:00:00.000Z'
    }
  ],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 1 },
  updateFilters: vi.fn(),
  setPage: vi.fn()
}

export { vuetify, mockTaskStore }
