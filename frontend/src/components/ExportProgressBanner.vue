<!--
/**
 * @fileoverview Export progress banner component for showing active exports
 * @component ExportProgressBanner
 * @description Shows progress of active exports with real-time updates
 */
-->

<template>
  <div v-if="activeExports.length > 0" class="export-banner-container">
    <v-alert
      v-for="exportJob in activeExports"
      :key="exportJob._id"
      :type="getBannerType(exportJob.status)"
      :icon="getBannerIcon(exportJob.status)"
      variant="tonal"
      closable
      class="mb-2"
      @click:close="dismissExport(exportJob._id)"
    >
      <template #title>
        {{ getBannerTitle(exportJob) }}
      </template>

      <div class="d-flex align-center">
        <div class="flex-grow-1">
          {{ getBannerMessage(exportJob) }}
        </div>

        <v-btn
          v-if="exportJob.status === 'completed'"
          variant="outlined"
          size="small"
          class="ml-2"
          @click="downloadExport(exportJob._id)"
        >
          <v-icon left>mdi-download</v-icon>
          Download
        </v-btn>
      </div>

      <v-progress-linear
        v-if="exportJob.status === 'processing'"
        indeterminate
        color="primary"
        class="mt-2"
      ></v-progress-linear>
    </v-alert>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExportStore } from '../stores/exportStore.js'

const exportStore = useExportStore()

const activeExports = computed(() => exportStore.activeExports)

function getBannerType(status) {
  switch (status) {
    case 'pending':
      return 'info'
    case 'processing':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'info'
  }
}

function getBannerIcon(status) {
  switch (status) {
    case 'pending':
      return 'mdi-clock-outline'
    case 'processing':
      return 'mdi-cog'
    case 'completed':
      return 'mdi-check-circle'
    case 'failed':
      return 'mdi-alert-circle'
    default:
      return 'mdi-information'
  }
}

function getBannerTitle(exportJob) {
  const format = exportJob.format.toUpperCase()
  switch (exportJob.status) {
    case 'pending':
      return `${format} Export Queued`
    case 'processing':
      return `${format} Export Processing...`
    case 'completed':
      return `${format} Export Complete`
    case 'failed':
      return `${format} Export Failed`
    default:
      return `${format} Export`
  }
}

function getBannerMessage(exportJob) {
  switch (exportJob.status) {
    case 'pending':
      return 'Your export is queued and will begin processing shortly.'
    case 'processing':
      return 'Processing your export request. This may take a few moments.'
    case 'completed':
      return `${exportJob.recordCount} records exported successfully. Click to download.`
    case 'failed':
      return exportJob.error || 'Export failed due to an unknown error.'
    default:
      return 'Export status unknown.'
  }
}

function dismissExport(exportId) {
  // Remove from active exports (this is handled by the store automatically after completion)
  console.log('Dismissing export:', exportId)
}

async function downloadExport(exportId) {
  try {
    await exportStore.downloadExport(exportId)
  } catch (error) {
    console.error('Download failed:', error)
  }
}
</script>

<style scoped>
.export-banner-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
}

@media (max-width: 600px) {
  .export-banner-container {
    top: 70px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
</style>
