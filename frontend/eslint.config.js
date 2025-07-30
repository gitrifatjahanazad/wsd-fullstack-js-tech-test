import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import prettier from '@vue/eslint-config-prettier'

export default [
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  {
    // Exclude build and dist directories
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**']
  },
  {
    // Main application files
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Event: 'readonly'
      }
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      indent: 'off',
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error'
    }
  },
  {
    // Test files configuration
    files: ['tests/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser globals
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Event: 'readonly',
        // Test globals
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
        // Node.js/Vitest globals
        global: 'readonly',
        globalThis: 'readonly'
      }
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      indent: 'off',
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'off' // More lenient for test files
    }
  },
  {
    // Mock files (CommonJS)
    files: ['tests/**/*mock*.js', 'tests/__mocks__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script', // CommonJS
      globals: {
        module: 'writable',
        exports: 'writable',
        require: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'no-unused-vars': 'off'
    }
  }
]
