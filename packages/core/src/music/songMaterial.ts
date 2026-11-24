/** Keep existing tool drafts intact; song material has an independent local record. */
export function songMaterialKey(kind: 'tablature' | 'score', songId?: string | null) {
  const key = kind === 'tablature' ? 'lvm.worship.tablature.draft' : 'lvm.worship.score.v1'
  return songId ? `${key}.song:${encodeURIComponent(songId)}` : key
}
