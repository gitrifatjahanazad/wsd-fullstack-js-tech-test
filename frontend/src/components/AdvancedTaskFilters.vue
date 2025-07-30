<!--
/**
 * @fileoverview Advanced task filtering component with multiple filter options
 * @component AdvancedTaskFilters
 * @description Comprehensive filtering interface for task data with date ranges, search, and export options
 * @emits {Object} filters-changed - Emitted when filters are updated
 * @emits {Object} export-requested - Emitted when export is requested
 */
-->

<template>
  <v-card class="mb-4">
    <v-card-title>
      <div class="d-flex align-center justify-space-between w-100">
        <span>Filters</span>
        <div class="d-flex gap-2">
          <v-btn
            variant="outlined"
            size="small"
            :disabled="!hasActiveFilters"
            data-testid="clear-filters"
            @click="clearFilters"
          >
            <v-icon left>mdi-filter-remove</v-icon>
            Clear
          </v-btn>
          <v-btn
            variant="outlined"
            size="small"
            @click="showAdvanced = !showAdvanced"
          >
            <v-icon left>{{
              showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down'
            }}</v-icon>
            {{ showAdvanced ? 'Less' : 'More' }}
          </v-btn>
        </div>
      </div>
    </v-card-title>

    <v-card-text>
      <!-- Basic Filters Row -->
      <v-row>
        <v-col cols="12" md="3">
          <v-select
            v-model="localFilters.status"
            :items="statusOptions"
            label="Status"
            clearable
            data-testid="status-filter"
            @update:model-value="emitFiltersChanged"
          >
            <template #selection="{ item }">
              <v-chip
                :color="getStatusColor(item.value)"
                size="small"
                variant="flat"
              >
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="localFilters.priority"
            :items="priorityOptions"
            label="Priority"
            clearable
            data-testid="priority-filter"
            @update:model-value="emitFiltersChanged"
          >
            <template #selection="{ item }">
              <v-chip
                :color="getPriorityColor(item.value)"
                size="small"
                variant="outlined"
              >
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="localFilters.search"
            label="Search tasks..."
            prepend-inner-icon="mdi-magnify"
            clearable
            data-testid="search-input"
            @update:model-value="debounceSearch"
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="2">
          <v-menu>
            <template #activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                color="primary"
                variant="elevated"
                block
                :disabled="!hasData"
                data-testid="export-button"
              >
                <v-icon left>mdi-download</v-icon>
                Export
              </v-btn>
            </template>
            <v-list>
              <v-list-item
                data-testid="export-csv"
                @click="requestExport('csv')"
              >
                <template #prepend>
                  <v-icon>mdi-file-delimited</v-icon>
                </template>
                <v-list-item-title>Export as CSV</v-list-item-title>
              </v-list-item>
              <v-list-item
                data-testid="export-json"
                @click="requestExport('json')"
              >
                <template #prepend>
                  <v-icon>mdi-code-json</v-icon>
                </template>
                <v-list-item-title>Export as JSON</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-col>
      </v-row>

      <!-- Advanced Filters -->
      <v-expand-transition>
        <div v-if="showAdvanced">
          <v-divider class="my-4"></v-divider>

          <v-row>
            <v-col cols="12" md="3">
              <v-select
                v-model="localFilters.sortBy"
                :items="sortOptions"
                label="Sort by"
                @update:model-value="emitFiltersChanged"
              ></v-select>
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="localFilters.sortOrder"
                :items="orderOptions"
                label="Order"
                @update:model-value="emitFiltersChanged"
              ></v-select>
            </v-col>
          </v-row>

          <!-- Date Filters -->
          <v-row>
            <v-col cols="12">
              <h4 class="text-subtitle-1 mb-2">Created Date Range</h4>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.dateFrom"
                label="From Date"
                type="date"
                clearable
                @update:model-value="emitFiltersChanged"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.dateTo"
                label="To Date"
                type="date"
                clearable
                @update:model-value="emitFiltersChanged"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <h4 class="text-subtitle-1 mb-2">Completion Date Range</h4>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.completedDateFrom"
                label="Completed From"
                type="date"
                clearable
                @update:model-value="emitFiltersChanged"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="localFilters.completedDateTo"
                label="Completed To"
                type="date"
                clearable
                @update:model-value="emitFiltersChanged"
              ></v-text-field>
            </v-col>
          </v-row>
        </div>
      </v-expand-transition>

      <!-- Active Filters Display -->
      <div v-if="hasActiveFilters" class="mt-4">
        <v-divider class="mb-3"></v-divider>
        <div class="d-flex align-center flex-wrap gap-2">
          <span class="text-caption font-weight-medium">Active Filters:</span>
          <v-chip
            v-for="filter in activeFilterChips"
            :key="filter.key"
            size="small"
            variant="outlined"
            closable
            @click:close="removeFilter(filter.key)"
          >
            {{ filter.label }}
          </v-chip>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, defineEmits } from 'vue'
import { debounce } from 'lodash-es'

const emit = defineEmits(['filters-changed', 'export-requested'])

const props = defineProps({
  filters: {
    type: Object,
    required: true
  },
  hasData: {
    type: Boolean,
    default: true
  }
})

const showAdvanced = ref(false)
const localFilters = ref({ ...props.filters })

const statusOptions = [
  { title: 'All', value: 'all' },
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' }
]

const priorityOptions = [
  { title: 'All', value: 'all' },
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' }
]

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' }
]

const orderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

const hasActiveFilters = computed(() => {
  return (
    localFilters.value.status ||
    localFilters.value.priority ||
    localFilters.value.search ||
    localFilters.value.dateFrom ||
    localFilters.value.dateTo ||
    localFilters.value.completedDateFrom ||
    localFilters.value.completedDateTo
  )
})

const activeFilterChips = computed(() => {
  const chips = []

  if (localFilters.value.status) {
    const status = statusOptions.find(
      (opt) => opt.value === localFilters.value.status
    )
    chips.push({ key: 'status', label: `Status: ${status?.title}` })
  }

  if (localFilters.value.priority) {
    const priority = priorityOptions.find(
      (opt) => opt.value === localFilters.value.priority
    )
    chips.push({ key: 'priority', label: `Priority: ${priority?.title}` })
  }

  if (localFilters.value.search) {
    chips.push({
      key: 'search',
      label: `Search: "${localFilters.value.search}"`
    })
  }

  if (localFilters.value.dateFrom || localFilters.value.dateTo) {
    const dateRange = []
    if (localFilters.value.dateFrom) {
      dateRange.push(
        `from ${new Date(localFilters.value.dateFrom).toLocaleDateString()}`
      )
    }
    if (localFilters.value.dateTo) {
      dateRange.push(
        `to ${new Date(localFilters.value.dateTo).toLocaleDateString()}`
      )
    }
    chips.push({ key: 'dateRange', label: `Created: ${dateRange.join(' ')}` })
  }

  if (
    localFilters.value.completedDateFrom ||
    localFilters.value.completedDateTo
  ) {
    const completedRange = []
    if (localFilters.value.completedDateFrom) {
      completedRange.push(
        `from ${new Date(localFilters.value.completedDateFrom).toLocaleDateString()}`
      )
    }
    if (localFilters.value.completedDateTo) {
      completedRange.push(
        `to ${new Date(localFilters.value.completedDateTo).toLocaleDateString()}`
      )
    }
    chips.push({
      key: 'completedRange',
      label: `Completed: ${completedRange.join(' ')}`
    })
  }

  return chips
})

// Watch for external filter changes
watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters }
  },
  { deep: true }
)

function emitFiltersChanged() {
  emit('filters-changed', { ...localFilters.value })
}

const debounceSearch = debounce(() => {
  emitFiltersChanged()
}, 500)

function clearFilters() {
  localFilters.value = {
    status: '',
    priority: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    completedDateFrom: '',
    completedDateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
  emitFiltersChanged()
}

function removeFilter(filterKey) {
  switch (filterKey) {
    case 'status':
      localFilters.value.status = ''
      break
    case 'priority':
      localFilters.value.priority = ''
      break
    case 'search':
      localFilters.value.search = ''
      break
    case 'dateRange':
      localFilters.value.dateFrom = ''
      localFilters.value.dateTo = ''
      break
    case 'completedRange':
      localFilters.value.completedDateFrom = ''
      localFilters.value.completedDateTo = ''
      break
  }
  emitFiltersChanged()
}

function requestExport(format) {
  emit('export-requested', {
    format,
    filters: { ...localFilters.value }
  })
}

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'error'
    default:
      return 'grey'
  }
}
</script>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
