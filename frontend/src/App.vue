<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app temporary :width="280">
      <v-list>
        <v-list-item
          prepend-avatar="https://randomuser.me/api/portraits/men/85.jpg"
          title="Task Analytics"
          subtitle="Dashboard"
        ></v-list-item>
      </v-list>

      <v-divider></v-divider>

      <v-list nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          color="primary"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Task Analytics Dashboard</v-toolbar-title>
      <v-spacer></v-spacer>

      <v-btn icon @click="toggleTheme">
        <v-icon>{{ themeIcon }}</v-icon>
      </v-btn>

      <v-badge
        :content="unreadNotifications"
        :model-value="unreadNotifications > 0"
        color="error"
      >
        <v-btn icon @click="showNotifications = !showNotifications">
          <v-icon>mdi-bell</v-icon>
        </v-btn>
      </v-badge>
    </v-app-bar>

    <v-main class="app-container">
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>

    <connection-status />
    <export-progress-banner />

    <notification-drawer
      v-model="showNotifications"
      :notifications="notifications"
      @clear-all="clearAllNotifications"
      @remove="removeNotification"
    />
  </v-app>
</template>

<!--
/**
 * @fileoverview Main application component with navigation, theme control, and notifications
 * @component App
 * @description Root Vue component providing layout structure, navigation drawer, app bar,
 * theme toggle, notification management, and Socket.IO connection handling
 */
-->

<script setup>
/**
 * @module App
 * @description Main application component with navigation and real-time features
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useAnalyticsStore } from './stores/analyticsStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { useExportStore } from './stores/exportStore.js'
import ConnectionStatus from './components/ConnectionStatus.vue'
import NotificationDrawer from './components/NotificationDrawer.vue'
import ExportProgressBanner from './components/ExportProgressBanner.vue'

const theme = useTheme()
const analyticsStore = useAnalyticsStore()
const taskStore = useTaskStore()
const exportStore = useExportStore()

const drawer = ref(false)
const showNotifications = ref(false)

const menuItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
  { title: 'Tasks', icon: 'mdi-format-list-checks', to: '/tasks' },
  { title: 'Analytics', icon: 'mdi-chart-line', to: '/analytics' },
  { title: 'Exports', icon: 'mdi-download', to: '/exports' }
]

const themeIcon = computed(() =>
  theme.global.name.value === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'
)

const notifications = computed(() => analyticsStore.notifications)

const unreadNotifications = computed(() =>
  notifications.value.length > 10
    ? '10+'
    : notifications.value.length.toString()
)

function toggleTheme() {
  theme.global.name.value =
    theme.global.name.value === 'light' ? 'dark' : 'light'
}

function clearAllNotifications() {
  analyticsStore.clearNotifications()
  showNotifications.value = false
}

function removeNotification(id) {
  analyticsStore.removeNotification(id)
}

onMounted(() => {
  analyticsStore.initializeSocketListeners()
  taskStore.initializeSocketListeners()
  exportStore.initializeSocketListeners()
  analyticsStore.connect()
  analyticsStore.fetchAnalytics()
})

onUnmounted(() => {
  analyticsStore.cleanup()
  taskStore.cleanup()
  exportStore.cleanup()
  analyticsStore.disconnect()
})
</script>

<style lang="scss">
// Global styles are imported in main.js
</style>
