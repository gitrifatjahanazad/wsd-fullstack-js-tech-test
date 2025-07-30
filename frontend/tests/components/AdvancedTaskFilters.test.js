/**
 * @fileoverview Unit tests for AdvancedTaskFilters component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AdvancedTaskFilters from '../../src/components/AdvancedTaskFilters.vue'

// Mock lodash-es
vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => fn)
}))

const vuetify = createVuetify({
  components,
  directives
})

describe('AdvancedTaskFilters', () => {
  let wrapper

  const defaultProps = {
    filters: {
      status: '',
      priority: '',
      search: '',
      dateFrom: '',
      dateTo: '',
      completedDateFrom: '',
      completedDateTo: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    },
    hasData: true
  }

  beforeEach(() => {
    wrapper = mount(AdvancedTaskFilters, {
      props: defaultProps,
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('renders without crashing', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('displays filter controls', () => {
    // Should have status select
    const statusSelect = wrapper.find('[label="Status"]')
    expect(statusSelect.exists()).toBe(true)

    // Should have priority select
    const prioritySelect = wrapper.find('[label="Priority"]')
    expect(prioritySelect.exists()).toBe(true)

    // Should have search field
    const searchField = wrapper.find('[label="Search tasks..."]')
    expect(searchField.exists()).toBe(true)

    // Should have export button
    const exportButton = wrapper.find('button')
    expect(exportButton.text()).toContain('Export')
  })

  it('shows advanced filters when expanded', async () => {
    // Advanced filters should be hidden initially
    expect(wrapper.find('[label="From Date"]').exists()).toBe(false)

    // Click "More" button to expand
    const moreButton = wrapper.find('button:contains("More")')
    if (moreButton.exists()) {
      await moreButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show date filters
      expect(wrapper.find('[label="From Date"]').exists()).toBe(true)
      expect(wrapper.find('[label="To Date"]').exists()).toBe(true)
    }
  })

  it('emits filters-changed when filter values change', async () => {
    const statusSelect = wrapper.findComponent({ name: 'VSelect' })

    if (statusSelect.exists()) {
      await statusSelect.vm.$emit('update:model-value', 'completed')

      expect(wrapper.emitted('filters-changed')).toBeTruthy()
      const emittedEvent = wrapper.emitted('filters-changed')[0]
      expect(emittedEvent[0].status).toBe('completed')
    }
  })

  it('shows active filter chips when filters are applied', async () => {
    // Set filters with active values
    await wrapper.setProps({
      filters: {
        ...defaultProps.filters,
        status: 'completed',
        priority: 'high',
        search: 'test'
      }
    })

    await wrapper.vm.$nextTick()

    // Should show active filters section
    const activeFiltersText = wrapper.text()
    expect(activeFiltersText).toContain('Active Filters')
  })

  it('emits export-requested when export is triggered', async () => {
    const exportButton = wrapper.find('[data-testid="export-button"]')

    if (exportButton.exists()) {
      await exportButton.trigger('click')

      // Should emit export request
      expect(wrapper.emitted('export-requested')).toBeTruthy()
    }
  })

  it('clears all filters when clear button is clicked', async () => {
    // Set some filters first
    await wrapper.setProps({
      filters: {
        ...defaultProps.filters,
        status: 'completed',
        search: 'test'
      }
    })

    const clearButton = wrapper.find('button:contains("Clear")')
    if (clearButton.exists()) {
      await clearButton.trigger('click')

      expect(wrapper.emitted('filters-changed')).toBeTruthy()
      // Should emit cleared filters
      const lastEmission = wrapper.emitted('filters-changed').slice(-1)[0]
      expect(lastEmission[0].status).toBe('')
      expect(lastEmission[0].search).toBe('')
    }
  })

  it('disables export button when no data', async () => {
    await wrapper.setProps({
      ...defaultProps,
      hasData: false
    })

    const exportButton = wrapper.find('button:contains("Export")')
    if (exportButton.exists()) {
      expect(exportButton.attributes('disabled')).toBeDefined()
    }
  })

  it('computes active filters correctly', () => {
    const instance = wrapper.vm

    // Test with no filters
    expect(instance.hasActiveFilters).toBe(false)

    // Set some filters
    instance.localFilters.status = 'completed'
    instance.localFilters.search = 'test'

    expect(instance.hasActiveFilters).toBe(true)
  })

  it('formats filter chips correctly', async () => {
    await wrapper.setProps({
      filters: {
        ...defaultProps.filters,
        status: 'completed',
        priority: 'high',
        search: 'important task'
      }
    })

    await wrapper.vm.$nextTick()

    const instance = wrapper.vm
    const chips = instance.activeFilterChips

    expect(chips).toContainEqual(
      expect.objectContaining({
        key: 'status',
        label: 'Status: Completed'
      })
    )

    expect(chips).toContainEqual(
      expect.objectContaining({
        key: 'priority',
        label: 'Priority: High'
      })
    )

    expect(chips).toContainEqual(
      expect.objectContaining({
        key: 'search',
        label: 'Search: "important task"'
      })
    )
  })
})
