import { apiBase } from './api'
import {
  buildSetlistSharePath,
  type ShareableSetlistItem,
} from './setlistSharePath'

export { buildSetlistSharePath } from './setlistSharePath'

export function buildSetlistShareUrl(items: readonly ShareableSetlistItem[]): string {
  return `${apiBase()}${buildSetlistSharePath(items)}`
}

// Build the live-session follower link shared when a leader starts a session.
// A fresh session code lives at /s/{code}; the path is deliberately NOT in the
// universal-link config, so it opens the web follower (never the app) in phase 1.
export function buildSessionShareUrl(code: string): string {
  return `${apiBase()}/s/${encodeURIComponent(code)}`
}
