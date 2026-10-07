import { useEffect, useState } from 'react'

const BREAKPOINT = 820

export function useIsMobile(breakpoint = BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth <= breakpoint } catch { return false }
  })

  useEffect(() => {
    function onResize() {
      try { setIsMobile(window.innerWidth <= breakpoint) } catch {}
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
