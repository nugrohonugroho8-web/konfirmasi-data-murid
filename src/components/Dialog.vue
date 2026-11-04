<script setup>
// Dialog modal sederhana (tanpa JS Bootstrap)
defineProps({ judul: String, lebar: { type: String, default: '520px' } })
const emit = defineEmits(['tutup'])
</script>

<template>
  <Teleport to="body">
    <div class="modal-latar" @click.self="emit('tutup')" @keydown.esc="emit('tutup')" role="dialog" aria-modal="true">
      <div class="modal-isi" :style="{ maxWidth: lebar }">
        <div class="kartu">
          <div class="d-flex justify-content-between align-items-center border-bottom px-4 py-3">
            <h2 class="h6 fw-bold mb-0">{{ judul }}</h2>
            <button class="btn-close" aria-label="Tutup" @click="emit('tutup')"></button>
          </div>
          <div class="p-4"><slot /></div>
          <div v-if="$slots.kaki" class="border-top px-4 py-3 d-flex justify-content-end gap-2"><slot name="kaki" /></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
