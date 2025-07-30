<!--
/**
 * @fileoverview Export history management component showing past exports with download and status
 * @component ExportHistory
 * @description Comprehensive export history interface with pagination, status tracking, and download functionality
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="page-title">Export History</h2>
      <v-spacer></v-spacer>
      <v-btn
        variant="outlined"
        :loading="exportStore.loading"
        @click="refreshHistory"
      >
        <v-icon left>mdi-refresh</v-icon>
        Refresh
      </v-btn>
    </div>

    <!-- Active Exports -->
    <div v-if="exportStore.activeExports.length > 0" class="mb-6">
      <h3 class="text-h6 mb-3">Active Exports</h3>
      <v-row>
        <v-col
          v-for="exportJob in exportStore.activeExports"
          :key="exportJob._id"
          cols="12"
          md="6"
          lg="4"
        >
          <v-card class="export-progress-card">
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon :color="getStatusColor(exportJob.status)" class="mr-2">
                  {{ getStatusIcon(exportJob.status) }}
                </v-icon>
                <div>
                  <div class="font-weight-medium">
                    {{ formatExportTitle(exportJob) }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ formatExportDate(exportJob.createdAt) }}
                  </div>
                </div>
              </div>

              <v-progress-linear
                :indeterminate="exportJob.status === 'processing'"
                :model-value="exportJob.status === 'processing' ? undefined : 0"
                color="primary"
                height="4"
                class="mb-2"
              ></v-progress-linear>

              <div class="text-caption">
                {{
                  exportStore.exportProgress[exportJob._id]?.message ||
                  getStatusMessage(exportJob.status)
                }}
              </div>

              <div v-if="exportJob.recordCount > 0" class="text-caption mt-1">
                {{ exportJob.recordCount }} records
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Export History Table -->
    <v-card>
      <v-card-title>Export History</v-card-title>

      <div
        v-if="exportStore.loading && exportStore.exports.length === 0"
        class="text-center py-8"
      >
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>

      <div v-else-if="exportStore.error" class="text-center py-8">
        <v-alert type="error">{{ exportStore.error }}</v-alert>
      </div>

      <div
        v-else-if="exportStore.exports.length === 0"
        class="text-center py-8"
      >
        <v-icon size="64" color="grey-lighten-1">mdi-download-off</v-icon>
        <p class="text-grey mt-2">No exports found</p>
      </div>

      <v-data-table
        v-else
        :items="exportStore.exports"
        :headers="headers"
        :loading="exportStore.loading"
        class="export-history-table"
        item-key="_id"
        :height="exportStore.exports.length > 50 ? '400px' : undefined"
        fixed-header
      >
        <template #item.format="{ item }">
          <v-chip
            :color="getFormatColor(item.format)"
            size="small"
            variant="flat"
          >
            <v-icon left>{{ getFormatIcon(item.format) }}</v-icon>
            {{ item.format.toUpperCase() }}
          </v-chip>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
          >
            <v-icon left>{{ getStatusIcon(item.status) }}</v-icon>
            {{ formatStatus(item.status) }}
          </v-chip>
        </template>

        <template #item.filters="{ item }">
          <div class="text-truncate" style="max-width: 200px">
            {{ exportStore.formatFilters(item.filters) }}
          </div>
        </template>

        <template #item.recordCount="{ item }">
          <span v-if="item.recordCount > 0">
            {{ item.recordCount.toLocaleString() }}
          </span>
          <span v-else class="text-grey">-</span>
        </template>

        <template #item.createdAt="{ item }">
          {{ formatExportDate(item.createdAt) }}
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex gap-1">
            <v-btn
              v-if="item.status === 'completed'"
              icon
              size="small"
              variant="text"
              @click="downloadExport(item._id)"
            >
              <v-icon>mdi-download</v-icon>
              <v-tooltip activator="parent">Download</v-tooltip>
            </v-btn>

            <v-btn
              icon
              size="small"
              variant="text"
              @click="showExportDetails(item)"
            >
              <v-icon>mdi-eye</v-icon>
              <v-tooltip activator="parent">View Details</v-tooltip>
            </v-btn>
          </div>
        </template>
      </v-data-table>

      <!-- Pagination -->
      <div v-if="exportStore.pagination.pages > 1" class="text-center pa-4">
        <v-pagination
          v-model="exportStore.pagination.page"
          :length="exportStore.pagination.pages"
          @update:model-value="exportStore.setPage"
        ></v-pagination>
      </div>
    </v-card>

    <!-- Export Details Dialog -->
    <v-dialog v-model="showDetailsDialog" max-width="600">
      <v-card v-if="selectedExport">
        <v-card-title>Export Details</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <strong>Format:</strong> {{ selectedExport.format.toUpperCase() }}
            </v-col>
            <v-col cols="6">
              <strong>Status:</strong>
              <v-chip
                :color="getStatusColor(selectedExport.status)"
                size="small"
                variant="flat"
                class="ml-2"
              >
                {{ formatStatus(selectedExport.status) }}
              </v-chip>
            </v-col>
            <v-col cols="6">
              <strong>Records:</strong>
              {{ selectedExport.recordCount.toLocaleString() }}
            </v-col>
            <v-col cols="6">
              <strong>Created:</strong>
              {{ formatExportDate(selectedExport.createdAt) }}
            </v-col>
            <v-col v-if="selectedExport.completedAt" cols="6">
              <strong>Completed:</strong>
              {{ formatExportDate(selectedExport.completedAt) }}
            </v-col>
            <v-col v-if="selectedExport.error" cols="12">
              <strong>Error:</strong>
              <v-alert type="error" variant="tonal" class="mt-2">
                {{ selectedExport.error }}
              </v-alert>
            </v-col>
            <v-col cols="12">
              <strong>Filters Applied:</strong>
              <div class="mt-2">
                {{ exportStore.formatFilters(selectedExport.filters) }}
              </div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            v-if="selectedExport.status === 'completed'"
            color="primary"
            @click="downloadExport(selectedExport._id)"
          >
            <v-icon left>mdi-download</v-icon>
            Download
          </v-btn>
          <v-btn @click="showDetailsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useExportStore } from '../stores/exportStore.js'

const exportStore = useExportStore()

const showDetailsDialog = ref(false)
const selectedExport = ref(null)

const headers = [
  { title: 'Format', key: 'format', width: '100px' },
  { title: 'Status', key: 'status', width: '120px' },
  { title: 'Filters', key: 'filters', sortable: false },
  { title: 'Records', key: 'recordCount', width: '100px' },
  { title: 'Created', key: 'createdAt', width: '150px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '100px' }
]

async function refreshHistory() {
  await exportStore.fetchExports()
}

async function downloadExport(exportId) {
  try {
    await exportStore.downloadExport(exportId)
  } catch (error) {
    console.error('Download failed:', error)
  }
}

function showExportDetails(exportJob) {
  selectedExport.value = exportJob
  showDetailsDialog.value = true
}

function formatExportTitle(exportJob) {
  return `${exportJob.format.toUpperCase()} Export`
}

function formatExportDate(date) {
  return new Date(date).toLocaleString()
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'processing':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending':
      return 'mdi-clock-outline'
    case 'processing':
      return 'mdi-loading'
    case 'completed':
      return 'mdi-check'
    case 'failed':
      return 'mdi-alert'
    default:
      return 'mdi-help'
  }
}

function getStatusMessage(status) {
  switch (status) {
    case 'pending':
      return 'Waiting to start...'
    case 'processing':
      return 'Processing export...'
    case 'completed':
      return 'Export completed'
    case 'failed':
      return 'Export failed'
    default:
      return 'Unknown status'
  }
}

function getFormatColor(format) {
  switch (format) {
    case 'csv':
      return 'green'
    case 'json':
      return 'blue'
    default:
      return 'grey'
  }
}

function getFormatIcon(format) {
  switch (format) {
    case 'csv':
      return 'mdi-file-delimited'
    case 'json':
      return 'mdi-code-json'
    default:
      return 'mdi-file'
  }
}

onMounted(() => {
  exportStore.fetchExports()
  exportStore.initializeSocketListeners()
})

onUnmounted(() => {
  exportStore.cleanup()
})
</script>

<style scoped>
.export-progress-card {
  border-left: 4px solid var(--v-theme-primary);
}

.export-history-table .v-data-table__tr:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.gap-1 {
  gap: 0.25rem;
}
</style>
