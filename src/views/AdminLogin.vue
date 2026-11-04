<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminMasuk } from '../lib/api'

const router = useRouter()
const user = ref('')
const pass = ref('')
const lihat = ref(false)
const memuat = ref(false)
const galat = ref('')

async function masuk() {
  galat.value = ''
  if (!user.value || !pass.value) { galat.value = 'Isi username dan password.'; return }
  memuat.value = true
  try {
    await adminMasuk(user.value, pass.value)
    router.replace({ name: 'admin' })
  } catch (e) { galat.value = e.message } finally { memuat.value = false }
}
</script>

<template>
  <main class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-4">
        <div class="kartu p-4">
          <div class="text-center mb-3">
            <img src="/logo.png" alt="" style="width:64px" class="mb-2" />
            <h1 class="h5 fw-bold mb-0">Panel Data Pusat Sekolah</h1>
            <div class="small text-secondary">Khusus Admin / Operator</div>
          </div>
          <form @submit.prevent="masuk">
            <div class="mb-3">
              <label for="u" class="form-label fw-semibold">Username</label>
              <input id="u" v-model="user" class="form-control" autocomplete="username" />
            </div>
            <div class="mb-3">
              <label for="p" class="form-label fw-semibold">Password</label>
              <div class="input-group">
                <input id="p" v-model="pass" :type="lihat ? 'text' : 'password'" class="form-control" autocomplete="current-password" />
                <button type="button" class="btn btn-outline-secondary" @click="lihat = !lihat" :aria-label="lihat ? 'Sembunyikan' : 'Tampilkan'"><i class="bi" :class="lihat ? 'bi-eye-slash' : 'bi-eye'"></i></button>
              </div>
            </div>
            <div v-if="galat" class="alert alert-danger small py-2">{{ galat }}</div>
            <button class="btn btn-primary w-100" :disabled="memuat"><span v-if="memuat" class="spinner-border spinner-border-sm me-2"></span>Masuk</button>
          </form>
        </div>
        <div class="text-center mt-3"><RouterLink to="/" class="small text-secondary"><i class="bi bi-arrow-left"></i> Kembali ke halaman murid</RouterLink></div>
      </div>
    </div>
  </main>
</template>
