// Minimal client-side platform detection (user-agent based). Used by the
// announcement strip (src/components/AnnouncementStrip.jsx) to pick the right
// audience and to stand down where iOS Safari already paints Apple's native
// Smart App Banner. Kept intentionally small — UA sniffing is best-effort, not
// authoritative.

function navigatorValue(key, fallback) {
  try {
    return typeof navigator === 'undefined' ? fallback : navigator[key] ?? fallback
  } catch {
    return fallback
  }
}

function ua() {
  return String(navigatorValue('userAgent', ''))
}

function maxTouchPoints() {
  return Number(navigatorValue('maxTouchPoints', 0)) || 0
}

export function isIOS() {
  const s = ua()
  if (/iPad|iPhone|iPod/.test(s)) return true
  // iPadOS 13+ ships "Request Desktop Website" on by default and reports as
  // Macintosh. maxTouchPoints is what separates it from a real Mac — desktop
  // Safari also exposes ontouchend, so that check alone false-positives.
  return /Macintosh/.test(s) && maxTouchPoints() > 1
}

export function isAndroid() {
  return /Android/.test(ua())
}

export function isMobile() {
  return isIOS() || isAndroid()
}

// Every iOS browser is WebKit, so "is this really Safari" is a UA question, not
// an engine one. Chrome/Firefox/Edge/Opera/DuckDuckGo each add their own token,
// and most in-app webviews (Instagram, Facebook, …) drop the trailing Safari
// token altogether — so requiring Safari and rejecting the known tokens covers
// both cases.
const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/

export function isIOSSafari() {
  if (!isIOS()) return false
  const s = ua()
  return /Safari/.test(s) && !IOS_NON_SAFARI.test(s)
}

// True when Apple's Smart App Banner (the apple-itunes-app meta tag in
// index.html) is the thing the user is already looking at, so in-app promos
// must stand down rather than stack a second banner on top of it. Safari
// suppresses the native banner in an installed home-screen PWA, which is why
// standalone mode does not count.
export function isNativeAppBannerActive() {
  if (!isIOSSafari()) return false
  if (navigatorValue('standalone', false) === true) return false
  try {
    return !window.matchMedia?.('(display-mode: standalone)').matches
  } catch {
    return true
  }
}
