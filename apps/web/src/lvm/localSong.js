import { toSong } from './serviceAdapter'

export function localSongFromChordPro(filename, content, id) {
  if (typeof content !== 'string' || !content.trim()) throw new Error(`${filename}: archivo vacío`)
  const title = content.match(/^\s*\{(?:title|t)\s*:\s*(.+?)\s*\}\s*$/im)?.[1]?.trim() || filename.replace(/\.(chordpro|cho|pro|txt)$/i, '')
  const key = content.match(/^\s*\{key\s*:\s*(.+?)\s*\}\s*$/im)?.[1]?.trim() || ''
  const song = { id, title, originalKey: key, chordpro_content: content, authors: [] }
  toSong(song)
  return song
}
