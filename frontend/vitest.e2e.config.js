import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Separate config for e2e tests with CSS handling
export default defineConfig({
  plugins: [
    vue(),
    // Custom plugin to handle CSS imports
    {
      name: 'css-mock',
      load(id) {
        if (id.endsWith('.css')) {
          return 'export default {}'
        }
      }
    }
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    css: false, // Disable CSS processing
    setupFiles: ['./tests/e2e-setup.js'],
    include: ['tests/e2e/**/*.e2e.test.js'],
    exclude: ['**/node_modules/**'],
    testTimeout: 10000, // Longer timeout for e2e tests
    coverage: {
      exclude: ['tests/**']
    }
  },
  // Handle CSS and asset imports by mocking them
  define: {
    global: 'globalThis'
  }
})
