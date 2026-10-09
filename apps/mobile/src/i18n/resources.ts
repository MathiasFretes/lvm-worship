// Bundled i18next resources, built from the locale folders via Metro's
// require.context so the folders are the source of truth: adding
// src/i18n/locales/<code>/ with the same JSON files as en/ is all it takes to
// add a language (plus a label in config.ts). Keep this module out of vitest
// imports — require.context only exists under Metro.

type NamespaceResources = Record<string, Record<string, unknown>>
type ResourceAddress = { locale: string; namespace: string }

const ctx = require.context('./locales', true, /\.json$/)
const LOCALE_RESOURCE_PATH = /^\.\/([\w-]+)\/([\w-]+)\.json$/

function resourceAddress(path: string): ResourceAddress | null {
  const match = LOCALE_RESOURCE_PATH.exec(path)
  if (!match) return null
  return { locale: match[1], namespace: match[2] }
}

const resources: Record<string, NamespaceResources> = {}
for (const path of [...ctx.keys()].sort()) {
  const address = resourceAddress(path)
  if (!address) continue
  const localeResources = (resources[address.locale] ??= {})
  localeResources[address.namespace] = ctx(path) as Record<string, unknown>
}

export const RESOURCES = resources
export const SUPPORTED_LOCALES = Object.keys(resources).sort()
export const I18N_NAMESPACES = Object.keys(resources.en ?? {}).sort()
