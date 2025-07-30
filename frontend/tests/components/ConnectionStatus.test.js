import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConnectionStatus from '../../src/components/ConnectionStatus.vue'
import { useAnalyticsStore } from '../../src/stores/analyticsStore.js'

// Mock Vuetify components
const VIcon = {
  template: '<i class="v-icon" :class="$attrs.class"><slot /></i>',
  props: ['color', 'size']
}

const vuetify = {
  install(app) {
    app.component('VIcon', VIcon)
  }
}

describe('ConnectionStatus', () => {
  let analyticsStore

  beforeEach(() => {
    setActivePinia(createPinia())
    analyticsStore = useAnalyticsStore()
  })

  it('renders connected state correctly', () => {
    analyticsStore.connected = true

    const wrapper = mount(ConnectionStatus, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.find('.connection-status').classes()).toContain('connected')
    expect(wrapper.find('.connection-status').classes()).not.toContain(
      'disconnected'
    )
  })

  it('renders disconnected state correctly', () => {
    analyticsStore.connected = false

    const wrapper = mount(ConnectionStatus, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Disconnected')
    expect(wrapper.find('.connection-status').classes()).toContain(
      'disconnected'
    )
    expect(wrapper.find('.connection-status').classes()).not.toContain(
      'connected'
    )
  })

  it('shows correct icon for connected state', () => {
    analyticsStore.connected = true

    const wrapper = mount(ConnectionStatus, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('mdi-wifi')
  })

  it('shows correct icon for disconnected state', () => {
    analyticsStore.connected = false

    const wrapper = mount(ConnectionStatus, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('mdi-wifi-off')
  })

  it('updates when connection status changes', async () => {
    analyticsStore.connected = false

    const wrapper = mount(ConnectionStatus, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Disconnected')

    analyticsStore.connected = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Connected')
  })
})
