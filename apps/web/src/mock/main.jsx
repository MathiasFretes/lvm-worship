import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mockDataSource } from './data'
import { buildService } from '../lvm/serviceAdapter'
import './mock.css'

function MockApp() {
  const [songs, setSongs] = useState([])
  const [selected, setSelected] = useState(null)
  const [plan, setPlan] = useState(null)

  useEffect(() => {
    document.title = 'LVM Worship · modo local'
    mockDataSource.listSongs().then(setSongs)
    mockDataSource.getServicePlan().then(setPlan)
  }, [])

  function downloadService() {
    const service = buildService(plan, songs)
    const url = URL.createObjectURL(new Blob([JSON.stringify(service, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'sunday-service.json'
    link.click()
    URL.revokeObjectURL(url)
  }

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
          <button type="button" onClick={() => setSelected(song)}>{song.title} · {song.originalKey}</button>
        </li>)}
      </ul>
    </section>
    {selected && <section aria-labelledby="song-heading">
      <h2 id="song-heading">{selected.title}</h2>
      <pre>{selected.chordpro_content}</pre>
    </section>}
    {plan && songs.length > 0 && <section aria-labelledby="service-heading">
      <h2 id="service-heading">{plan.title}</h2>
      <p>{plan.setlist.songIds.length} canciones · {plan.scripture.reference} · anuncio · predicación</p>
      <button type="button" onClick={downloadService}>Exportar servicio JSON</button>
    </section>}
  </main>
}

createRoot(document.getElementById('root')).render(<MockApp />)
