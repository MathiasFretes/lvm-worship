import { serializeChordPro } from '../chordpro/serialize'
import { toSong } from './worshipPlan'

// A proposal contains the performed sections, including repetitions, rather
// than the complete catalog chart. Restore that snapshot, never a newer chart.
export function draftFromWorshipPlan(plan, context) {
  if (plan?.schemaVersion !== '0.1' || plan.serviceId !== context?.serviceId || plan.setlistId !== context?.setlistId || !Array.isArray(plan.songs)) throw new Error('Invalid musical proposal')
  return {
    name: plan.name,
    serviceDate: context.startsAt,
    entries: plan.songs.map(song => {
      const sourceSong = {
        id: song.songId, title: song.title, originalKey: song.key, authors: [],
        chordpro_content: serializeChordPro({
          meta: { title: song.title, key: song.key },
          sections: song.sections.map(section => ({
            kind: section.kind, label: section.label,
            lines: section.lines.map(line => ({ lyrics: line.text, chords: line.chords.map(chord => ({ sym: chord.symbol, index: chord.index })) })),
          })),
        }),
      }
      // Literal ChordPro delimiters cannot always be represented losslessly.
      // Refuse that conversion instead of silently changing the server copy.
      const expected = song.sections.map(section => ({ kind: section.kind, label: section.label, lines: section.lines.map(line => ({ text: line.text, chords: line.chords.map(chord => ({ symbol: chord.symbol, index: chord.index })) })) }))
      if (JSON.stringify(toSong(sourceSong).sections) !== JSON.stringify(expected)) throw new Error(`Cannot restore ${song.title} without changing its musical content`)
      return { songId: song.songId, toKey: song.key || null, sourceSong }
    }),
  }
}
