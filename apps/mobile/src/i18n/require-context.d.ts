// Metro exposes Webpack-compatible contexts at runtime, but @types/node does
// not describe them. Keep the declaration local to i18n and model the context
// as read-only: catalog discovery may inspect modules, never mutate the list.
type MetroContextMode = 'sync' | 'eager' | 'weak' | 'lazy' | 'lazy-once'

interface MetroRequireContext {
  (modulePath: string): unknown
  keys(): readonly string[]
}

declare namespace NodeJS {
  interface Require {
    context(
      directory: string,
      includeSubdirectories?: boolean,
      filter?: RegExp,
      mode?: MetroContextMode
    ): MetroRequireContext
  }
}
