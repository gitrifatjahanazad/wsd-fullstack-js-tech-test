import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuickTaskList from '../../src/components/QuickTaskList.vue'
import { useTaskStore } from '../../src/stores/taskStore.js'

// Mock Vuetify components
const VCard = { template: '<div class="v-card"><slot /></div>' }
const VCardTitle = { template: '<div class="v-card-title"><slot /></div>' }
const VCardText = { template: '<div class="v-card-text"><slot /></div>' }
const VSpacer = { template: '<div class="v-spacer"></div>' }
const VBtn = {
  template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
  props: ['size', 'color', 'variant', 'to']
}
const VProgressCircular = {
  template: '<div class="v-progress-circular"></div>',
  props: ['indeterminate', 'size']
}
const VIcon = {
  template: '<i class="v-icon" :class="$attrs.class"><slot /></i>',
  props: ['color', 'size']
}
const VList = { template: '<div class="v-list"><slot /></div>' }
const VListItem = {
  template: '<div class="v-list-item"><slot name="prepend" /><div><div>{{ title }}</div><div>{{ subtitle }}</div></div><slot name="append" /></div>',
  props: ['title', 'subtitle']
}
const VChip = {
  template: '<span class="v-chip"><slot /></span>',
  props: ['color', 'size', 'variant']
}

const vuetify = {
  install(app) {
    app.component('VCard', VCard)
    app.component('VCardTitle', VCardTitle)
    app.component('VCardText', VCardText)
    app.component('VSpacer', VSpacer)
    app.component('VBtn', VBtn)
    app.component('VProgressCircular', VProgressCircular)
    app.component('VIcon', VIcon)
    app.component('VList', VList)
    app.component('VListItem', VListItem)
    app.component('VChip', VChip)
  }
}

describe('QuickTaskList', () => {
  let taskStore

  beforeEach(() => {
    setActivePinia(createPinia())
    taskStore = useTaskStore()
  })

  it('renders loading state', () => {
    taskStore.loading = true

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
    expect(wrapper.text()).toContain('Recent Tasks')
  })

  it('renders empty state when no tasks', () => {
    taskStore.loading = false
    taskStore.tasks = []

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('No tasks yet')
    expect(wrapper.text()).toContain('mdi-format-list-checks')
  })

  it('renders recent tasks correctly', () => {
    taskStore.loading = false
    taskStore.tasks = [
      {
        _id: '1',
        title: 'Task 1',
        description: 'Description 1',
        status: 'pending',
        priority: 'high'
      },
      {
        _id: '2',
        title: 'Task 2',
        description: 'Description 2',
        status: 'completed',
        priority: 'low'
      }
    ]

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Task 1')
    expect(wrapper.text()).toContain('Task 2')
    expect(wrapper.text()).toContain('Description 1')
    expect(wrapper.text()).toContain('Description 2')
    expect(wrapper.text()).toContain('high')
    expect(wrapper.text()).toContain('low')
  })

  it('limits tasks to 5 items', () => {
    taskStore.loading = false
    taskStore.tasks = Array.from({ length: 10 }, (_, i) => ({
      _id: `${i + 1}`,
      title: `Task ${i + 1}`,
      description: `Description ${i + 1}`,
      status: 'pending',
      priority: 'medium'
    }))

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    const listItems = wrapper.findAll('.v-list-item')
    expect(listItems.length).toBe(5)
    expect(wrapper.text()).toContain('Task 1')
    expect(wrapper.text()).toContain('Task 5')
    expect(wrapper.text()).not.toContain('Task 6')
  })

  it('displays View All button', () => {
    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    const viewAllBtn = wrapper.find('.v-btn')
    expect(viewAllBtn.exists()).toBe(true)
    expect(viewAllBtn.text()).toContain('View All')
  })

  it('applies correct status colors and icons', () => {
    taskStore.loading = false
    taskStore.tasks = [
      {
        _id: '1',
        title: 'Pending Task',
        description: 'Description',
        status: 'pending',
        priority: 'medium'
      },
      {
        _id: '2',
        title: 'In Progress Task',
        description: 'Description',
        status: 'in-progress',
        priority: 'medium'
      },
      {
        _id: '3',
        title: 'Completed Task',
        description: 'Description',
        status: 'completed',
        priority: 'medium'
      }
    ]

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('mdi-clock-outline')
    expect(wrapper.text()).toContain('mdi-progress-clock')
    expect(wrapper.text()).toContain('mdi-check-circle')
  })

  it('applies correct priority colors', () => {
    taskStore.loading = false
    taskStore.tasks = [
      {
        _id: '1',
        title: 'Low Priority',
        description: 'Description',
        status: 'pending',
        priority: 'low'
      },
      {
        _id: '2',
        title: 'Medium Priority',
        description: 'Description',
        status: 'pending',
        priority: 'medium'
      },
      {
        _id: '3',
        title: 'High Priority',
        description: 'Description',
        status: 'pending',
        priority: 'high'
      }
    ]

    const wrapper = mount(QuickTaskList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('low')
    expect(wrapper.text()).toContain('medium')
    expect(wrapper.text()).toContain('high')
  })
})