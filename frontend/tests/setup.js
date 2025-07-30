/**
 * @fileoverview Test setup configuration
 */

import { config } from '@vue/test-utils'

// Create simplified mock Vuetify instance
const vuetify = {
  install: () => {},
  global: {
    $vuetify: {
      theme: { current: { dark: false } },
      display: { mobile: false }
    }
  }
}

// Mock Vuetify components with simple templates
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
    props: ['color', 'variant', 'size', 'disabled']
  },
  VIcon: {
    template: '<i class="v-icon"><slot /></i>',
    props: ['color', 'size']
  },
  VChip: {
    template: '<span class="v-chip"><slot /></span>',
    props: ['color', 'size', 'variant']
  },
  VTextField: {
    template: '<input class="v-text-field" />',
    props: ['modelValue', 'label', 'placeholder']
  },
  VSelect: {
    template: '<select class="v-select"></select>',
    props: ['modelValue', 'items', 'itemTitle', 'itemValue']
  },
  VProgressCircular: {
    template: '<div class="v-progress-circular"></div>',
    props: ['indeterminate', 'size']
  },
  VAlert: { template: '<div class="v-alert"><slot /></div>', props: ['type'] },
  VList: { template: '<div class="v-list"><slot /></div>' },
  VListItem: {
    template: '<div class="v-list-item"><slot /></div>',
    props: ['title', 'subtitle']
  },
  VMenu: { template: '<div class="v-menu"><slot /></div>' },
  VDataTable: {
    template: '<div class="v-data-table"><slot /></div>',
    props: ['headers', 'items', 'loading']
  },
  VSpacer: { template: '<div class="v-spacer"></div>' },
  VPagination: {
    template: '<div class="v-pagination"></div>',
    props: ['modelValue', 'length']
  }
}

config.global.plugins = [vuetify]
config.global.components = mockComponents
config.global.stubs = {
  transition: false,
  'transition-group': false,
  ...mockComponents
}

// Mock global objects
globalThis.CSS = { supports: () => false }
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export { vuetify }
