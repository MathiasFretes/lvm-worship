import { describe, it, expect } from 'vitest'
import { symToSolfege, formatChord, formatKeyDisplay, rootToSolfege } from '../solfege'

describe('LVM chord notation preferences', () => {
  it.each([
    ['C', 'Do'], ['D', 'Re'], ['E', 'Mi'], ['F', 'Fa'],
    ['G', 'Sol'], ['A', 'La'], ['B', 'Si'],
    ['C#', 'Do#'], ['Bb', 'Sib'], ['F#', 'Fa#'], ['Eb', 'Mib'],
  ])('maps root %s to %s without losing accidentals', (root, display) => {
    expect(rootToSolfege(root)).toBe(display)
  })

  it.each([
    ['Am', 'Lam'], ['Dsus4', 'Resus4'], ['Gmaj7', 'Solmaj7'],
    ['F#m7', 'Fa#m7'], ['Ebmaj7', 'Mibmaj7'], ['C7', 'Do7'],
    ['G/B', 'Sol/Si'], ['C/E', 'Do/Mi'], ['Bb/D', 'Sib/Re'], ['F#m/A', 'Fa#m/La'],
    ['', ''], ['N.C.', 'N.C.'],
  ])('renders chart symbol %j as %j', (symbol, display) => {
    expect(symToSolfege(symbol)).toBe(display)
  })

  it.each([
    ['Em', undefined, 'Em'],
    ['C/G', { style: 'letters' }, 'C/G'],
    ['Em', { style: 'solfege' }, 'Mim'],
    ['G/B', { style: 'solfege' }, 'Sol/Si'],
    ['Bb', { style: 'solfege' }, 'Sib'],
  ])('honors the musician preference for %s', (symbol, options, display) => {
    expect(formatChord(symbol, options)).toBe(display)
  })

  it.each([
    ['G', 'solfege', 'Sol'],
    ['Em', 'solfege', 'Mim'],
    ['Bb', 'solfege', 'Sib'],
    ['G', 'letters', 'G'],
  ])('formats song key %s in %s notation', (key, style, display) => {
    expect(formatKeyDisplay(key, style)).toBe(display)
  })
})
