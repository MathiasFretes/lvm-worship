import { useEffect, useState } from 'react'

export function useAutoScroll(rootRef, speed, songId) {
  const [running, setRunning] = useState(false)
  useEffect(() => { setRunning(false) }, [songId])
  useEffect(() => {
    if (!running) return
    let frame
    let last
    const columns = rootRef.current?.querySelector('.songpage__sheet--two')
    const horizontal = columns && Number(getComputedStyle(columns).columnCount) > 1 && columns.scrollWidth > columns.clientWidth
    const target = horizontal ? columns : document.fullscreenElement === rootRef.current ? rootRef.current : null
    let position = horizontal ? target.scrollLeft : target ? target.scrollTop : window.scrollY
    function tick(now) {
      if (document.hidden) { setRunning(false); return }
      if (last !== undefined) {
        position += Math.min(now - last, 100) / 1000 * speed
        const maximum = horizontal ? target.scrollWidth - target.clientWidth : target ? target.scrollHeight - target.clientHeight : document.documentElement.scrollHeight - window.innerHeight
        if (position >= maximum) { setRunning(false); return }
        if (horizontal) target.scrollLeft = position
        else if (target) target.scrollTop = position
        else window.scrollTo({ top: position, behavior: 'instant' })
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    const pause = () => setRunning(false)
    const key = event => { if (['Escape', ' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'].includes(event.key) && !/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName)) pause() }
    window.addEventListener('wheel', pause, { passive: true })
    window.addEventListener('touchstart', pause, { passive: true })
    window.addEventListener('keydown', key)
    document.addEventListener('fullscreenchange', pause)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('wheel', pause)
      window.removeEventListener('touchstart', pause)
      window.removeEventListener('keydown', key)
      document.removeEventListener('fullscreenchange', pause)
    }
  }, [running, speed, rootRef])
  return [running, setRunning]
}
