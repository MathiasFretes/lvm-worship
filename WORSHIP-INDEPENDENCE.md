# M7.7 — Independencia de LVM Worship

Estado: en curso. Esta rama no acredita todavía una implementación totalmente original.

## Evidencia verificada

- `MathiasFretes/lvm-worship` está separado como repositorio de GitHub. Eso no describe por sí solo el origen de cada archivo.
- La comparación de blobs documentada en `1ec78cf` encontró, sobre 1.180 archivos rastreados entonces, 690 archivos idénticos a `rwm6857/GraceChords` en la misma ruta, 400 distintos en rutas compartidas y 90 rutas nuevas. La comparación precede al commit WIP `2e64202`; debe repetirse tras las migraciones. Una ruta nueva o un hash distinto no prueban autoría original.
- `apps/web/src/lvm/localSong.js`, `serviceAdapter.js` y `worshipPlan.js`, junto con sus pruebas y fixtures, no tenían equivalente en la misma ruta del origen. Forman el puente específico de LVM con Service.
- Hay coincidencias en componentes activos de web y móvil, `packages/core`, iconos, splash y sprites. Los nombres de paquetes LVM y la eliminación de la etiqueta *fork* no cambian la procedencia del código o los gráficos.
- El repositorio de origen publica una licencia Apache-2.0 y un `NOTICE`. Este repositorio no contiene actualmente archivos `LICENSE` ni `NOTICE` en la raíz. Las atribuciones de dependencias, textos bíblicos, canciones y assets requieren inventario separado. Antes de distribuir código derivado, revisar las obligaciones aplicables y conservar los avisos pertinentes.

## Estado de la rama actual

`2e64202` retiró el inventario anterior, documentos legales, el listado y generador de licencias de terceros, algunos assets y varios módulos aún importados. La reparación mínima de esta rama restablece build, tests y licencias de dependencias; los puntos siguientes siguen abiertos:

- `npm run build` de vista previa, `npm run lint` y las 396 pruebas web vuelven a pasar. `/licenses` usa un inventario regenerable de dependencias. Este listado no sustituye los avisos del código de origen ni de los assets.
- `/privacy`, `/terms` y `/delete-account` quedan fuera del enrutador y de la generación SEO por decisión del responsable del proyecto, hasta definir operador y contacto. No se restauraron las declaraciones legales falsas. La app móvil todavía enlaza a esas URLs; ninguna release web/móvil debe salir con esa incoherencia.
- `SongViewPage` ya no muestra el enlace de pistas roto. El modelo todavía conserva `gracetracks_url`; su migración requiere una decisión explícita y compatibilidad de datos.
- `apps/mobile/app.json` aún señala `assets/icon.png`, eliminado por el WIP. Los splash y sprites restantes siguen pendientes de reemplazo con procedencia LVM.
- Las pantallas de acceso siguen cargando `gc-brand-wide-*.svg`. Los tokens `--gc-*`, `createGcSupabase` y las claves persistidas `gc.*` siguen en rutas activas. Deben migrarse con compatibilidad para no perder datos.
- Las páginas legales eliminadas afirmaban que Ryan Moore operaba La Voz Misionera. No deben restaurarse con esa atribución. El operador, contacto y prácticas de datos reales deben confirmarse antes de publicar nuevos textos.

## Decisiones por área

| Área | Dueño futuro | Decisión | Condición de cierre |
| --- | --- | --- | --- |
| Contratos WorshipPlan 0.1 y Service 0.1 | LVM Worship / LVM Service | Conservar comportamiento y frontera | E2E offline Service → Worship → Service |
| Catálogo, editor, setlists, lector y componentes compartidos | LVM Worship | Inventariar rutas activas y reimplementar por verticales | Código y pruebas de cada vertical revisados; web y móvil compilan |
| Assets de marca, iconos, splash y sprites | Identidad LVM | Sustituir con archivos de procedencia documentada | Web, móvil y Studio usan assets LVM verificados |
| Licencias y avisos | Ingeniería / responsable del producto | Restituir avisos necesarios mientras exista material derivado | Inventario de código y assets revisado antes de distribución |
| Privacidad, términos y eliminación de cuenta | Responsable del servicio | Redactar con operador y datos reales; conservar rutas públicas | Contenido aprobado y URLs con HTTP 200 |
| Identificadores `gc.*`, `--gc-*`, `createGcSupabase`, `gracetracks_url` | LVM Worship | Migración gradual y compatible | Sin pérdida de datos ni enlaces inválidos |

## Orden de ejecución

1. Confirmar operador y contacto, redactar los textos legales y volver a habilitar las rutas públicas y los enlaces móviles solo cuando el contenido esté aprobado.
2. Completar el inventario de licencias y avisos del material derivado y los assets; el listado actual solo cubre paquetes instalados.
3. Sustituir los assets heredados con procedencia propia; comprobar web, Android, iOS y Studio.
4. Reimplementar una vertical funcional por vez, conservando contratos y pruebas de comportamiento.
5. Migrar identificadores técnicos con lectura de claves antiguas y escritura de nuevas; retirar el camino viejo solo después de verificar datos existentes.
6. Repetir comparación de procedencia, pruebas, builds y revisión de avisos. Recién entonces evaluar el objetivo de implementación propia.

No declarar M7.7 cerrado ni publicar una release desde esta rama mientras fallen los gates anteriores.

## Referencias

- [Código de origen](https://github.com/rwm6857/GraceChords)
- [Licencia del origen](https://github.com/rwm6857/GraceChords/blob/main/LICENSE)
- [Aviso del origen](https://github.com/rwm6857/GraceChords/blob/main/NOTICE)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
