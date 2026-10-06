const disclaimerText = 'All lyrics and music are the property of their respective owners. La Voz Misionera provides tools for personal worship and educational use only. Do not repost or redistribute copyrighted lyrics/charts. Rights holder, email us for takedown requests.'

export const DISCLAIMER_EMAIL = 'dev@lavozmisionera.com'

export function isDisclaimerEnabled(): boolean {
  return import.meta.env?.VITE_ENABLE_DISCLAIMER !== '0'
}

export function getChordproCommentBlock(): string {
  return [
    '# --- DISCLAIMER (La Voz Misionera) ---',
    `# ${disclaimerText}`,
    '# --- END DISCLAIMER ---',
    '',
  ].join('\n')
}

export function getPdfFooterDisclaimer(): string {
  return 'All lyrics and music are the property of their respective owners. For personal worship and educational use only.'
}
