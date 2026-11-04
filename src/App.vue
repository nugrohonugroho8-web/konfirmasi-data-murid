<template>
  <nav class="topbar sticky-top no-print">
    <div class="container d-flex align-items-center justify-content-between py-2">
      <RouterLink to="/" class="d-flex align-items-center gap-2 text-decoration-none text-reset">
        <img src="/logo.png" alt="Logo SMP Negeri 2 Tulangan" class="brand-logo" />
        <div class="brand-teks">
          <div class="fw-bold">SMP Negeri 2 Tulangan</div>
          <small class="text-secondary d-none d-sm-block">Konfirmasi Data Murid 2026/2027</small>
        </div>
      </RouterLink>
      <div class="d-flex gap-1">
        <RouterLink to="/panduan" class="btn btn-sm btn-light"><i class="bi bi-book"></i><span class="d-none d-md-inline ms-1">Panduan</span></RouterLink>
        <RouterLink to="/admin" class="btn btn-sm btn-light" title="Panel Data Pusat Sekolah (Admin)"><i class="bi bi-shield-lock"></i><span class="d-none d-md-inline ms-1">Admin</span></RouterLink>
      </div>
    </div>
  </nav>
  <RouterView />
  <footer class="container text-center footer-kecil py-4 no-print">
    &copy; 2026 SMP Negeri 2 Tulangan, Sidoarjo · Data dijaga kerahasiaannya dan hanya dipakai untuk keperluan administrasi sekolah.
  </footer>
</template>
