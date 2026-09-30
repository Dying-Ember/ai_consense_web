<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{ open: boolean; title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="modal-backdrop" :class="{ show: open }" @click.self="emit('close')">
    <div class="modal" :class="{ wide }" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h4>{{ title }}</h4>
        <button class="btn icon-only" type="button" @click="emit('close')">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div class="modal-foot" v-if="$slots.footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
