<script setup>
// Pemilih tanggal 3 kolom (tgl / bulan / tahun) — lebih mudah di HP daripada kalender bawaan.
// v-model berformat "DD-MM-YYYY".
import { computed } from 'vue'
const props = defineProps({ modelValue: { type: String, default: '' }, tahunAwal: { type: Number, default: 2007 }, tahunAkhir: { type: Number, default: 2016 }, id: String })
const emit = defineEmits(['update:modelValue'])
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const bagian = computed(() => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(props.modelValue || '')
  return m ? { d: m[1], m: m[2], y: m[3] } : { d: '', m: '', y: '' }
})
function ubah(k, v) {
  const b = { ...bagian.value, [k]: v }
  emit('update:modelValue', b.d && b.m && b.y ? `${b.d}-${b.m}-${b.y}` : `${b.d || '00'}-${b.m || '00'}-${b.y || '0000'}`)
}
const tahun = computed(() => {
  const arr = []
  for (let y = props.tahunAkhir; y >= props.tahunAwal; y--) arr.push(String(y))
  const y0 = bagian.value.y
  if (y0 && y0 !== '0000' && !arr.includes(y0)) arr.push(y0)
  return arr
})
</script>

<template>
  <div class="row g-2">
    <div class="col-3">
      <select :id="id" class="form-select" :value="bagian.d === '00' ? '' : bagian.d" @change="ubah('d', $event.target.value)" aria-label="Tanggal">
        <option value="">Tgl</option>
        <option v-for="d in 31" :key="d" :value="String(d).padStart(2, '0')">{{ d }}</option>
      </select>
    </div>
    <div class="col-5">
      <select class="form-select" :value="bagian.m === '00' ? '' : bagian.m" @change="ubah('m', $event.target.value)" aria-label="Bulan">
        <option value="">Bulan</option>
        <option v-for="(b, i) in BULAN" :key="b" :value="String(i + 1).padStart(2, '0')">{{ b }}</option>
      </select>
    </div>
    <div class="col-4">
      <select class="form-select" :value="bagian.y === '0000' ? '' : bagian.y" @change="ubah('y', $event.target.value)" aria-label="Tahun">
        <option value="">Tahun</option>
        <option v-for="y in tahun" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>
  </div>
</template>
