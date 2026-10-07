import { requireOptionalNativeModule } from 'expo'

// JS wrapper over the local `DifferentiateWithoutColor` native module
// (apps/mobile/modules/differentiate-without-color) which reads iOS's
// `UIAccessibility.shouldDifferentiateWithoutColor` and emits `onChange` from
// `differentiateWithoutColorDidChangeNotification`. React Native does not expose
// this flag, so the native module is the only way to read it.
//
// The module is iOS-only and only present after `expo prebuild` + a native
// rebuild. `requireOptionalNativeModule` returns null when it isn't linked
// (Android, or a Metro-only `expo export` bundle), so everything degrades
// cleanly to "off" — never a crash.

type NativeDifferentiate = {
  getShouldDifferentiateWithoutColor: () => Promise<boolean>
  addListener: (
    event: 'onChange',
    listener: (payload: { value: boolean }) => void,
  ) => { remove: () => void }
}

const Native = requireOptionalNativeModule<NativeDifferentiate>('DifferentiateWithoutColor')
const NOOP_SUBSCRIPTION = { remove() {} }

export type DifferentiateSubscription = { remove: () => void }

/** Current OS "Differentiate Without Color" state (false when unavailable). */
export async function getShouldDifferentiateWithoutColor(): Promise<boolean> {
  const module = Native
  if (!module) return false
  try {
    return Boolean(await module.getShouldDifferentiateWithoutColor())
  } catch {
    return false
  }
}

/** Subscribe to OS changes. No-op subscription when the module is unavailable. */
export function addDifferentiateWithoutColorListener(
  cb: (value: boolean) => void,
): DifferentiateSubscription {
  const module = Native
  if (!module) return NOOP_SUBSCRIPTION
  try {
    const subscription = module.addListener('onChange', ({ value }) => cb(Boolean(value)))
    return { remove: () => subscription.remove() }
  } catch {
    return NOOP_SUBSCRIPTION
  }
}
