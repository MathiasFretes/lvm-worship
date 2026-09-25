# Auditoría inicial de LVM Worship

Base: GraceChords, commit `6a2907874` del 2026-09-24. Esta clasificación es preliminar; no autoriza borrar componentes antes de medir sus dependencias.

| Decisión | Área | Evidencia y razón |
| --- | --- | --- |
| Conservar | Núcleo musical | `packages/core/src/chordpro/`, `packages/core/src/songs/`, `packages/core/src/setlists/`: parser, transposición y lógica de canciones/repertorios compartida. |
| Conservar | Experiencia musical web | `apps/web/src/pages/SongsPage.jsx`, `SongViewPage.jsx`, `SetlistWorkspacePage.jsx`, `WorshipModePage.jsx`: flujos para evaluar en la prueba de culto. |
| Adaptar | Modelo de servicio | El fork tiene repertorios y sesiones, pero el contrato común de culto aún no existe. Diseñarlo después de la auditoría de Presenter. |
| Adaptar | Datos y Auth | La web usa `apps/web/src/lib/supabase.js`; el modo mock mantiene una entrada separada para validar desarrollo local sin credenciales. El reemplazo o integración definitiva requiere una decisión de arquitectura posterior. |
| Adaptar | Identidad | El repositorio se llama `lvm-worship`; el branding y los paquetes internos conservan nombres GraceChords por ahora para minimizar el cambio inicial. |
| Posponer | App Expo | `apps/mobile/` existe y comparte `packages/core`, pero el primer flujo integrado será local en web/escritorio. |
| Investigar | Funciones ajenas al flujo inicial | Posts, lecturas y Cloudflare Workers existen; medir dependencias y licencias antes de retirar o reemplazar. |

## Baseline verificable

- `npm ci`, 390 tests y lint pasaron antes de personalizar el fork.
- La web original requiere credenciales Supabase para abrirse y para completar los scripts SEO de `npm run build`.
- `npm run dev:mock` respondió HTTP 200 y una comprobación Chromium abrió la pantalla, seleccionó una canción y mostró su ChordPro; `npm run build:mock` compiló. Son el baseline sin servicios externos, todavía limitado a canciones de ejemplo; no sustituyen la aplicación completa.
- Tras añadir la entrada mock, `npm run test:run` volvió a pasar 390 tests, `npm run lint` pasó y Vite compiló la aplicación original con 2427 módulos.

## Próximo examen

Probar navegación de canciones y repertorios con datos de ejemplo; mapear qué consultas requieren adapter de datos y qué partes del core pueden ejecutarse sin Supabase. No marcar una función como conservada para el MVP hasta verla operar en el flujo integrado.
