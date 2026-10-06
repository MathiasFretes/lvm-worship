const songs = [
  {
    id: 'song-1',
    title: 'Canto de ejemplo',
    originalKey: 'G',
    chordpro_content: '{title: Canto de ejemplo}\n{key: G}\n{start_of_verse}\n[G]Texto de muestra para ensayo\n{end_of_verse}\n{start_of_chorus}\n[C]Cantamos juntos\n{end_of_chorus}',
  },
  {
    id: 'song-2',
    title: 'Segundo canto de ejemplo',
    originalKey: 'D',
    chordpro_content: '{title: Segundo canto de ejemplo}\n{key: D}\n{start_of_verse}\n[D]Otra letra de muestra\n{end_of_verse}',
  },
  {
    id: 'song-3',
    title: 'Tercer canto de ejemplo',
    originalKey: 'A',
    chordpro_content: '{title: Tercer canto de ejemplo}\n{key: A}\n{start_of_verse}\n[A]Una tercera canción de muestra\n{end_of_verse}',
  },
]

const servicePlan = {
  id: 'culto-2026-09-27',
  title: 'Culto General',
  startsAt: '2026-09-27T19:00:00-03:00',
  setlist: { id: 'repertorio-domingo', name: 'Alabanza del domingo', songIds: ['song-1', 'song-2', 'song-3'] },
  scripture: {
    reference: 'Salmo 23:1',
    version: 'RV1909',
    text: 'JEHOVÁ es mi pastor; nada me faltará.',
    source: 'https://ebible.org/details.php?id=spaRV1909',
  },
  announcement: { title: 'Encuentro de jóvenes', body: 'Sábado, 18:00 · Sede Central' },
  sermon: { title: 'El buen pastor', body: 'Lectura: Salmo 23' },
}

export const fixtureDataSource = {
  async listSongs() { return songs },
  async getSong(id) { return songs.find(song => song.id === id) ?? null },
  async getServicePlan() { return servicePlan },
}
