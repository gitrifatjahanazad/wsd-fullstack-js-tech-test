/**
 * Complex e2e test setup with CSS-free Vuetify mocking
 */
import { vi } from 'vitest'

// Mock Vuetify completely to avoid CSS imports
const createMockVuetify = () => ({
  install: vi.fn(),
  theme: {
    global: {
      name: { value: 'light' }
    }
  },
  display: {
    xs: { value: false },
    sm: { value: false },
    md: { value: true },
    lg: { value: false },
    xl: { value: false },
    xxl: { value: false },
    smAndUp: { value: true },
    mdAndUp: { value: true },
    lgAndUp: { value: false }
  }
})

// Create mock Vuetify instance
export const vuetify = createMockVuetify()

// Mock all Vuetify components as simple divs
const mockVuetifyComponent = (name) => ({
  name,
  template: `<div class="v-${name.toLowerCase()}"><slot /></div>`,
  props: {
    modelValue: {},
    items: { default: () => [] },
    loading: { default: false },
    disabled: { default: false },
    variant: { default: 'default' },
    color: { default: 'primary' },
    size: { default: 'default' },
    label: { default: '' },
    clearable: { default: false },
    block: { default: false }
  },
  emits: ['update:modelValue', 'click', 'change']
})

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'mocked-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock common Vuetify components
global.VApp = mockVuetifyComponent('VApp')
global.VMain = mockVuetifyComponent('VMain')
global.VBtn = mockVuetifyComponent('VBtn')
global.VCard = mockVuetifyComponent('VCard')
global.VCardTitle = mockVuetifyComponent('VCardTitle')
global.VCardText = mockVuetifyComponent('VCardText')
global.VSelect = mockVuetifyComponent('VSelect')
global.VTextField = mockVuetifyComponent('VTextField')
global.VChip = mockVuetifyComponent('VChip')
global.VIcon = mockVuetifyComponent('VIcon')
global.VMenu = mockVuetifyComponent('VMenu')
global.VList = mockVuetifyComponent('VList')
global.VListItem = mockVuetifyComponent('VListItem')
global.VDataTable = mockVuetifyComponent('VDataTable')
global.VPagination = mockVuetifyComponent('VPagination')
global.VDialog = mockVuetifyComponent('VDialog')
global.VProgressLinear = mockVuetifyComponent('VProgressLinear')
global.VProgressCircular = mockVuetifyComponent('VProgressCircular')
global.VAlert = mockVuetifyComponent('VAlert')
global.VSpacer = mockVuetifyComponent('VSpacer')
global.VRow = mockVuetifyComponent('VRow')
global.VCol = mockVuetifyComponent('VCol')

// Suppress console warnings in tests
console.warn = vi.fn()
console.error = vi.fn()
