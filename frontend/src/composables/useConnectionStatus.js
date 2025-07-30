/**
 * @fileoverview Composable for handling connection status and offline functionality
 * @module composables/useConnectionStatus
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import socket from '../plugins/socket.js'

/**
 * Provides connection status and offline handling functionality
 * @function useConnectionStatus
 * @returns {Object} Connection status and methods
 */
export function useConnectionStatus() {
  const isOnline = ref(navigator.onLine)
  const isSocketConnected = ref(socket.connected)
  const lastOnlineTime = ref(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  const connectionStatus = computed(() => {
    if (!isOnline.value) return 'offline'
    if (!isSocketConnected.value) return 'socket-disconnected'
    return 'online'
  })

  const canPerformActions = computed(() => {
    return isOnline.value && isSocketConnected.value
  })

  function handleOnline() {
    isOnline.value = true
    reconnectAttempts.value = 0

    // Attempt to reconnect socket if needed
    if (!socket.connected) {
      socket.connect()
    }
  }

  function handleOffline() {
    isOnline.value = false
    lastOnlineTime.value = new Date()
  }

  function handleSocketConnect() {
    isSocketConnected.value = true
    reconnectAttempts.value = 0
  }

  function handleSocketDisconnect() {
    isSocketConnected.value = false

    // Attempt reconnection if online
    if (isOnline.value && reconnectAttempts.value < maxReconnectAttempts) {
      setTimeout(
        () => {
          reconnectAttempts.value++
          socket.connect()
        },
        Math.pow(2, reconnectAttempts.value) * 1000
      ) // Exponential backoff
    }
  }

  function forceReconnect() {
    reconnectAttempts.value = 0
    socket.disconnect()
    socket.connect()
  }

  function getOfflineDuration() {
    if (isOnline.value || !lastOnlineTime.value) return null
    return Date.now() - lastOnlineTime.value.getTime()
  }

  onMounted(() => {
    // Browser online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Socket.IO events
    socket.on('connect', handleSocketConnect)
    socket.on('disconnect', handleSocketDisconnect)

    // Initial state
    isSocketConnected.value = socket.connected
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)

    socket.off('connect', handleSocketConnect)
    socket.off('disconnect', handleSocketDisconnect)
  })

  return {
    isOnline,
    isSocketConnected,
    connectionStatus,
    canPerformActions,
    reconnectAttempts,
    maxReconnectAttempts,
    lastOnlineTime,
    forceReconnect,
    getOfflineDuration
  }
}
