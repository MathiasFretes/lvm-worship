import { describe, it, expect, afterEach } from 'vitest'
import { isAndroid, isIOS, isIOSSafari, isNativeAppBannerActive } from '../platform'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
const IPHONE_FACEBOOK_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0]'
// iPadOS 13+ ships "Request Desktop Website" on by default.
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const MAC_SAFARI = IPAD_DESKTOP_UA
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const original = {}

function stubClient({ ua, touchPoints = 0, touchEvents = false, standalone = undefined }) {
  original.ua = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  original.mtp = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
  original.standalone = Object.getOwnPropertyDescriptor(navigator, 'standalone')
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
  if (standalone !== undefined) {
    Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true })
  }
  if (touchEvents) document.ontouchend = null
}

afterEach(() => {
  for (const [prop, key] of [['userAgent', 'ua'], ['maxTouchPoints', 'mtp'], ['standalone', 'standalone']]) {
    if (original[key]) Object.defineProperty(navigator, prop, original[key])
    else delete navigator[prop]
  }
  delete document.ontouchend
})

describe('LVM web platform behavior', () => {
  it.each([
    ['iPhone Safari', { ua: IPHONE_SAFARI }, true, false],
    ['iPad desktop mode', { ua: IPAD_DESKTOP_UA, touchPoints: 5, touchEvents: true }, true, false],
    ['macOS Safari', { ua: MAC_SAFARI, touchPoints: 0, touchEvents: true }, false, false],
    ['Android Chrome', { ua: ANDROID_CHROME }, false, true],
    ['desktop Chrome', { ua: DESKTOP_CHROME }, false, false],
  ])('classifies %s for mobile handoff', (_name, client, ios, android) => {
    stubClient(client)
    expect({ ios: isIOS(), android: isAndroid() }).toEqual({ ios, android })
  })

  it.each([
    ['Safari', IPHONE_SAFARI, true],
    ['Chrome', IPHONE_CHROME, false],
    ['Firefox', IPHONE_FIREFOX, false],
    ['Facebook webview', IPHONE_FACEBOOK_WEBVIEW, false],
    ['desktop Chrome', DESKTOP_CHROME, false],
  ])('identifies %s as iOS Safari: %s', (_name, ua, expected) => {
    stubClient({ ua })
    expect(isIOSSafari()).toBe(expected)
  })

  it.each([
    ['browser Safari', IPHONE_SAFARI, undefined, true],
    ['installed LVM PWA', IPHONE_SAFARI, true, false],
    ['iOS Chrome', IPHONE_CHROME, undefined, false],
  ])('shows the native-app banner for %s: %s', (_name, ua, standalone, expected) => {
    stubClient({ ua, standalone })
    expect(isNativeAppBannerActive()).toBe(expected)
  })
})
