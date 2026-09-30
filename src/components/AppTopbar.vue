<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useLocalized } from '@/composables/useLocalized'
import AppIcon from './AppIcon.vue'
import AppModal from './AppModal.vue'

const { t } = useI18n()
const route = useRoute()
const store = useAppStore()
const { pick } = useLocalized()

const title = computed(() => t(`screen.${(route.name as string) || 'drafting'}`))

const healthLabel = computed(() => {
  const health = store.health
  if (!health) return t('system.notReady')
  return health.ready ? t('system.healthy') : t('system.degraded')
})

/* ------------------------------------------------------------ 项目工作区：新建 / 重命名 / 删除（FR-P-01/02/03） */
type ProjectDialogMode = 'create' | 'rename' | 'delete' | null
const projectDialog = ref<ProjectDialogMode>(null)
const projectNameInput = ref('')
const projectContractInput = ref('')
const projectBusy = ref(false)

const activeProjectName = computed(() =>
  store.activeProject ? pick(store.activeProject.name) : ''
)

function openCreate() {
  projectNameInput.value = ''
  projectContractInput.value = ''
  projectDialog.value = 'create'
}

function openRename() {
  projectNameInput.value = activeProjectName.value
  projectContractInput.value = store.activeProject?.contractNo ?? ''
  projectDialog.value = 'rename'
}

function openDelete() {
  projectDialog.value = 'delete'
}

async function submitProjectDialog() {
  const name = projectNameInput.value.trim()
  if (projectDialog.value === 'create' || projectDialog.value === 'rename') {
    if (!name) return
  }
  projectBusy.value = true
  try {
    if (projectDialog.value === 'create') {
      await store.createProject(name, projectContractInput.value.trim())
      store.notify(t('topbar.projectCreated'))
    } else if (projectDialog.value === 'rename' && store.activeProjectId) {
      await store.renameProject(store.activeProjectId, name)
      store.notify(t('common.saved'))
    } else if (projectDialog.value === 'delete' && store.activeProjectId) {
      await store.deleteProject(store.activeProjectId)
      store.notify(t('topbar.projectDeleted'))
    }
    projectDialog.value = null
  } finally {
    projectBusy.value = false
  }
}

function onProjectChange(event: Event) {
  store.switchProject((event.target as HTMLSelectElement).value)
}

function onLocaleChange(event: Event) {
  store.changeLocale((event.target as HTMLSelectElement).value as AppLocale)
}
</script>

<template>
  <header class="topbar">
    <div class="top-title">
      <h2>{{ title }}</h2>
    </div>
    <div class="top-actions">
      <span class="row" :title="healthLabel">
        <span class="health-dot" :class="{ ok: store.health?.ready, bad: store.health && !store.health.ready }" />
        <span class="muted small">{{ t('topbar.offline') }}</span>
      </span>

      <label class="project-switcher">
        <span class="switcher-label">{{ t('topbar.project') }}</span>
        <select :value="store.activeProjectId" @change="onProjectChange">
          <option v-for="project in store.projects" :key="project.id" :value="project.id">
            {{ pick(project.name) }}
          </option>
        </select>
        <button class="btn icon-only" type="button" :title="t('topbar.newProject')" @click="openCreate">
          <AppIcon name="plus" :size="14" />
        </button>
        <button
          class="btn icon-only"
          type="button"
          :disabled="!store.activeProject"
          :title="t('topbar.renameProject')"
          @click="openRename"
        >
          <AppIcon name="edit" :size="14" />
        </button>
        <button
          class="btn icon-only"
          type="button"
          :disabled="store.projects.length <= 1 || !store.activeProject"
          :title="store.projects.length <= 1 ? t('topbar.deleteGuard') : t('topbar.deleteProject')"
          @click="openDelete"
        >
          <AppIcon name="trash" :size="14" />
        </button>
      </label>

      <label class="lang-switcher">
        <AppIcon name="globe" :size="16" />
        <span class="switcher-label" style="margin-left: 6px">{{ t('topbar.language') }}</span>
        <select :value="store.locale" @change="onLocaleChange">
          <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
            {{ LOCALE_LABELS[code] }}
          </option>
        </select>
      </label>
    </div>

    <!-- 新建 / 重命名项目 -->
    <AppModal
      :open="projectDialog === 'create' || projectDialog === 'rename'"
      :title="projectDialog === 'create' ? t('topbar.newProject') : t('topbar.renameProject')"
      @close="projectDialog = null"
    >
      <div class="form-grid">
        <label>
          <span>{{ t('topbar.projectName') }}</span>
          <input
            v-model="projectNameInput"
            type="text"
            maxlength="120"
            :placeholder="t('topbar.projectNamePlaceholder')"
          />
        </label>
        <label>
          <span>{{ t('topbar.projectContract') }}</span>
          <input v-model="projectContractInput" type="text" maxlength="60" placeholder="e.g. 20230196" />
        </label>
        <p v-if="projectDialog === 'create'" class="muted small">{{ t('topbar.createHint') }}</p>
        <p v-else class="muted small">{{ t('topbar.renameHint') }}</p>
      </div>
      <template #footer>
        <button class="btn" type="button" @click="projectDialog = null">{{ t('common.cancel') }}</button>
        <button
          class="btn primary"
          type="button"
          :disabled="projectBusy || !projectNameInput.trim()"
          @click="submitProjectDialog"
        >
          {{ projectBusy ? t('common.loading') : t('common.save') }}
        </button>
      </template>
    </AppModal>

    <!-- 删除项目（二次确认，FR-P-03） -->
    <AppModal :open="projectDialog === 'delete'" :title="t('topbar.deleteProject')" @close="projectDialog = null">
      <p>{{ t('topbar.deleteConfirm').replace('@NAME@', activeProjectName) }}</p>
      <p class="muted small">{{ t('topbar.deleteHint') }}</p>
      <template #footer>
        <button class="btn" type="button" @click="projectDialog = null">{{ t('common.cancel') }}</button>
        <button class="btn danger" type="button" :disabled="projectBusy" @click="submitProjectDialog">
          {{ projectBusy ? t('common.loading') : t('common.delete') }}
        </button>
      </template>
    </AppModal>
  </header>
</template>

<style scoped>
.form-grid {
  display: grid;
  gap: 12px;
}
.form-grid label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.form-grid input {
  width: 100%;
}
</style>
