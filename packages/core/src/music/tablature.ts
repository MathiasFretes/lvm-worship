export const TAB_MAX_LENGTH = 64 * 1024
export const TAB_GRID_MAX_COLUMNS = 128
export const EMPTY_GUITAR_TAB = ['e', 'B', 'G', 'D', 'A', 'E'].map(note => `${note}|----------------|`).join('\n')
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

export type TabCell = { text: string; offset: number; editable: boolean; available: number }

export function getTabSystems(source: string) {
  const systems: { tuning: string; offset: number; measures: string[] }[][] = []
  let group: (typeof systems)[number] = []
  let offset = 0
  for (const line of source.split('\n')) {
    if (stringLine.test(line)) {
      const [tuning, ...measures] = line.split('|')
      if (measures.at(-1) === '') measures.pop()
      group.push({ tuning: tuning.trim(), offset: offset + tuning.length + 1, measures })
    } else if (group.length) {
      systems.push(group)
      group = []
    }
    offset += line.length + 1
  }
  if (group.length) systems.push(group)
  return systems
}

export function getTabMeasure(system: ReturnType<typeof getTabSystems>[number], measureIndex: number) {
  return system.map(({ tuning, offset, measures }) => {
    const measure = measures[measureIndex] ?? ''
    const start = offset + measures.slice(0, measureIndex).reduce((length, part) => length + part.length + 1, 0)
    if (measure.length > TAB_GRID_MAX_COLUMNS || measure.includes('\t')) return { tuning, cells: null }
    const cells = Array.from(measure.matchAll(/\d+|./g), match => {
      const text = match[0]
      const index = match.index ?? 0
      const followingDashes = measure.slice(index + text.length).match(/^-*/)?.[0].length ?? 0
      return {
        text, offset: start + index,
        editable: /^\d{1,2}$|^-$/.test(text),
        available: text.length + followingDashes,
      }
    })
    return { tuning, cells }
  })
}

export function replaceTabFret(source: string, cell: TabCell, fret: string) {
  if (!cell.editable || !/^(?:[0-9]|[12][0-9]|3[0-6])?$/.test(fret)) return null
  const width = Math.max(cell.text.length, fret.length)
  if (width > cell.available || source.slice(cell.offset, cell.offset + width) !== cell.text.padEnd(width, '-')) return null
  // Preserve the character columns and avoid turning adjacent frets into one number.
  const before = source[cell.offset - 1] ?? ''
  const after = source[cell.offset + width] ?? ''
  if (fret && (/\d/.test(before) || (fret.length === width && /\d/.test(after)))) return null
  return source.slice(0, cell.offset) + fret.padEnd(width, '-') + source.slice(cell.offset + width)
}

export function appendTabMeasure(source: string, system: ReturnType<typeof getTabSystems>[number]) {
  const measureCount = system[0].measures.length
  if (system.some(row => row.measures.length !== measureCount)) return null
  let result = source
  for (const { offset, measures } of [...system].reverse()) {
    const end = offset + measures.join('|').length
    const hasClosingBar = source[end] === '|'
    const insertAt = end + Number(hasClosingBar)
    const addition = hasClosingBar ? '----------------|' : '|----------------'
    result = result.slice(0, insertAt) + addition + result.slice(insertAt)
  }
  return result.length <= TAB_MAX_LENGTH ? result : null
}
