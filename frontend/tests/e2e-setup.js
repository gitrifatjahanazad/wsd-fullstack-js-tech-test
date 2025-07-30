/**
 * End-to-end test setup for core functionality testing
 */
import { vi } from 'vitest'

// Simple setup without Vuetify to avoid CSS import issues

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

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock fetch for API calls
global.fetch = vi.fn()

// Suppress console warnings in tests
console.warn = vi.fn()
console.error = vi.fn()
