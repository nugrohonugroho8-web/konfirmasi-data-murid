import { createRouter, createWebHistory } from 'vue-router'
import { sesiAdmin } from './lib/api'
import { sesiMurid } from './lib/store'

const routes = [
  { path: '/', name: 'beranda', component: () => import('./views/Beranda.vue') },
  { path: '/panduan', name: 'panduan', component: () => import('./views/Panduan.vue') },
  { path: '/konfirmasi', name: 'konfirmasi', component: () => import('./views/Konfirmasi.vue'), meta: { murid: true } },
  { path: '/admin/login', name: 'admin-login', component: () => import('./views/AdminLogin.vue') },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminPanel.vue'), meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  if (to.meta.admin && !sesiAdmin()) return { name: 'admin-login' }
  if (to.name === 'admin-login' && sesiAdmin()) return { name: 'admin' }
  if (to.meta.murid && !sesiMurid.data) return { name: 'beranda' }
})

export default router
