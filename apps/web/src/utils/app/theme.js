// src/utils/app/theme.js
const STORAGE_KEY = 'lvm.theme'

export function getStoredTheme() {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'dark' || v === 'light' ? v : null
}

export function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light'
}

/** Apply theme to <html data-theme="...">. Optionally persist. */
export function applyTheme(theme, { persist = false } = {}) {
  const t = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', t)
  if (persist) localStorage.setItem(STORAGE_KEY, t)
}

/** Default to the shared LVM light theme; a stored choice remains authoritative. */
export function initTheme() {
  const stored = getStoredTheme()
  const initial = stored || 'light'
  applyTheme(initial, { persist: false })
}

/** Toggle and persist. Returns new theme. */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next, { persist: true })
  return next
}
