const listeners = new Set()

export function showToast(message){
  // Dispatch from a snapshot: a subscriber may unsubscribe itself (or mount a
  // replacement) while handling a toast without changing this delivery pass.
  for (const listener of [...listeners]) {
    try {
      listener(message)
    } catch {
      // A presentation subscriber must never break the action that emitted it.
    }
  }
}

export function onToast(fn){
  if (typeof fn !== 'function') {
    throw new TypeError('Toast listener must be a function')
  }
  listeners.add(fn)
  let active = true
  return () => {
    if (!active) return false
    active = false
    return listeners.delete(fn)
  }
}
