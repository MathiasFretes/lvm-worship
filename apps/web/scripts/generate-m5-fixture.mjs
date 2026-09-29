import { writeFile } from 'node:fs/promises'
import { buildService } from '../src/lvm/serviceAdapter.js'

export const hostileSong = {
  id: 'senor-aqui',
  title: 'Señor, aquí estás 😀',
  originalKey: 'D',
  chordpro_content: [
    '{title: Señor, aquí estás 😀}',
    '{key: D}',
    '{start_of_verse: Verso 1}',
    '[D]Se[G]ñor, tú 😀 [A]estás aquí',
    '[D]Tu paz me [A]sostiene',
    '{end_of_verse}',
    '{start_of_chorus: Coro}',
    '[G]Cantaré con fe',
    '[D]Jesús, mi luz',
    '{end_of_chorus}',
    '{start_of_verse: Verso 2}',
    '[D]En la noche [A]seguiré',
    '{end_of_verse}',
    '{start_of_bridge: Puente}',
    '[Bm]Aquí me [G]quedaré',
    '{end_of_bridge}',
  ].join('\n'),
}

export const hostilePlan = {
  id: 'culto-hostil-2026-09-27',
  title: 'Culto de prueba — ñ, á, 😀',
  startsAt: '2026-09-27T19:00:00-03:00',
  setlist: {
    id: 'repertorio-hostil',
    name: 'Repertorio de prueba',
    entries: [{ songId: hostileSong.id, sectionOrder: [1, 2, 3, 2, 4, 2, 2] }],
  },
  scriptures: [
    { reference: 'Salmo 23:1', version: 'RV1909', text: 'JEHOVÁ es mi pastor; nada me faltará.', source: 'https://ebible.org/details.php?id=spaRV1909' },
    { reference: 'Salmo 23:2', version: 'RV1909', text: 'En lugares de delicados pastos me hará yacer: junto á aguas de reposo me pastoreará.', source: 'https://ebible.org/details.php?id=spaRV1909' },
  ],
  announcement: { title: 'Reunión de jóvenes', body: 'Sábado a las 18:00, salón Ñandutí' },
  sermon: { title: 'El buen pastor', body: 'Lectura: Salmo 23:1–2' },
}

const fixture = buildService(hostilePlan, [hostileSong])
await writeFile(new URL('../../../fixtures/hostile-service.json', import.meta.url), `${JSON.stringify(fixture, null, 2)}\n`)
