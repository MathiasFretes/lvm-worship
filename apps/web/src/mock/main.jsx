import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mockDataSource } from './data'
import './mock.css'

function MockApp() {
  const [songs, setSongs] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    document.title = 'LVM Worship · modo local'
    mockDataSource.listSongs().then(setSongs)
  }, [])

  return <main className="mock-app">
    <header>
      <p className="mock-eyebrow">La Voz Misionera</p>
      <h1>LVM Worship</h1>
      <p>Modo local de desarrollo · datos de ejemplo · sin servicios externos</p>
    </header>
    <section aria-labelledby="songs-heading">
      <h2 id="songs-heading">Canciones</h2>
      <ul>
        {songs.map(song => <li key={song.id}>
          <button type="button" onClick={() => setSelected(song)}>{song.title} · {song.key}</button>
        </li>)}
      </ul>
    </section>
    {selected && <section aria-labelledby="song-heading">
      <h2 id="song-heading">{selected.title}</h2>
      <pre>{selected.chordpro}</pre>
    </section>}
  </main>
}

createRoot(document.getElementById('root')).render(<MockApp />)
