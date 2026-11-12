export const TAB_MAX_LENGTH = 64 * 1024
export const TAB_EXAMPLE = [
  'e|----------------|',
  'B|----------------|',
  'G|--------0-------|',
  'D|----0h2---2-----|',
  'A|--2---------2---|',
  'E|0-------------0-|',
].join('\n')

// Keep the original notation and annotations, including whitespace and technique symbols.
const stringLine = /^[ \t]*[A-Ga-g](?:[#b♯♭])?[0-9]?[ \t]*\|[-–—\d xXhHpPbBrRsStTvV~^\\/()<>.=:+*|\t]+$/

export function parseTablature(input: string) {
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (source.length > TAB_MAX_LENGTH) return { ok: false, reason: 'tooLarge' } as const
  if (/[\u0000-\u0008\u000B-\u001F\u007F\uFFFD]/.test(source)) return { ok: false, reason: 'invalid' } as const

  const groups: number[] = []
  let consecutiveStrings = 0
  for (const line of [...source.split('\n'), '']) {
    if (stringLine.test(line)) {
      consecutiveStrings++
    } else if (consecutiveStrings) {
      groups.push(consecutiveStrings)
      consecutiveStrings = 0
    }
  }

  const stringCount = groups[0]
  if (!stringCount || stringCount < 4 || stringCount > 8 || groups.some(count => count !== stringCount)) {
    return { ok: false, reason: 'invalid' } as const
  }
  return { ok: true, source, stringCount, systems: groups.length } as const
}
