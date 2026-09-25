const songs = [
  {
    id: 'song-1',
    title: 'Canto de ejemplo',
    key: 'G',
    chordpro: '{title: Canto de ejemplo}\n{key: G}\n{start_of_verse}\n[G]Texto de muestra para ensayo\n{end_of_verse}',
  },
  {
    id: 'song-2',
    title: 'Segundo canto de ejemplo',
    key: 'D',
    chordpro: '{title: Segundo canto de ejemplo}\n{key: D}\n{start_of_chorus}\n[D]Otra letra de muestra\n{end_of_chorus}',
  },
]

export const mockDataSource = {
  async listSongs() { return songs },
  async getSong(id) { return songs.find(song => song.id === id) ?? null },
}
