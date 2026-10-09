import { isAndroid, isIOS } from '../utils/app/platform'

type Platform = 'ios' | 'android' | 'desktop'

type Announcement = {
  id: string
  platforms: Platform[]
  messageKey: string
  cta: { labelKey: string; href: string }
  startsAt: string
  endsAt: string
}

export const announcements: Announcement[] = [{
  id: 'ios-launch-2026-08',
  platforms: ['desktop', 'android', 'ios'],
  messageKey: 'announcement.iosLaunch.message',
  cta: { labelKey: 'announcement.iosLaunch.cta', href: '/download' },
  startsAt: '2026-08-07T00:00:00Z',
  endsAt: '2026-09-30T23:59:59Z',
}]

export function dismissKey(id: string): string {
  return `announce:dismissed:${id}`
}

function activePlatform(): Platform {
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  return 'desktop'
}

export function resolveAnnouncement(now = Date.now(), platform = activePlatform()): Announcement | null {
  for (const announcement of announcements) {
    if (!announcement.platforms.includes(platform)) continue
    const start = Date.parse(announcement.startsAt)
    const end = Date.parse(announcement.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now > end) continue
    try {
      if (localStorage.getItem(dismissKey(announcement.id)) === '1') continue
    } catch { /* Storage may be disabled. */ }
    return announcement
  }
  return null
}
