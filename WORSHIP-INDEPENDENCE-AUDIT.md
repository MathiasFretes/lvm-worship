# M7.7 — Auditoría de independencia de LVM Worship

Estado: auditoría inicial completada; independencia de implementación pendiente.

## Alcance y método

Se comparó el árbol local de `claude/m77-worship-independence-audit` (base `0de2e72`) con el árbol público de `rwm6857/GraceChords` en `main`, obtenido el 6 de octubre de 2026. La comparación usa SHA de blobs Git **en la misma ruta**. Una coincidencia demuestra contenido idéntico; una diferencia de SHA o de ruta **no demuestra** autoría original ni descarta derivación. No se modificó código de producto durante esta auditoría.

| Categoría | Archivos |
| --- | ---: |
| Rastreados en LVM Worship | 1.180 |
| Idénticos al origen en la misma ruta | 690 |
| Distintos en una ruta presente en el origen | 400 |
| Rutas ausentes del árbol de origen | 90 |

Coincidencias idénticas por área: `apps/mobile` 300, `apps/web` 283, `packages/core` 49, `apps/studio` 2 y otras áreas 56. Hay coincidencias en componentes ejecutados, no solamente en documentación: `apps/mobile/src/components/Button.tsx`, `Card.tsx`, `BottomSheet.tsx`, `LoadingSkeleton.tsx` y otros. También coinciden el icono móvil, las imágenes de splash, quince sprites y gráficos públicos de web. El repositorio actual tiene historia local condensada; esa historia no sirve para atribuir por sí sola los archivos diferentes.

Entre las rutas que no existen en el origen están `apps/web/src/lvm/localSong.js`, `serviceAdapter.js`, `worshipPlan.js`, sus pruebas y las fixtures del contrato. Son evidencia concreta de trabajo específico de LVM para el puente con Service. La mayoría de las otras rutas nuevas están bajo el proyecto Swift de Studio; varias podrían ser renombres de archivos preexistentes, por lo que requieren comparación de contenido antes de atribuirles autoría nueva.

## Hallazgos que afectan al producto

1. **Independencia de GitHub ≠ independencia de código.** `MathiasFretes/lvm-worship` no figura como fork, pero las 690 coincidencias directas impiden presentarlo hoy como implementación íntegramente original.
2. **Atribución y licencia.** El origen publica `LICENSE` Apache-2.0 y `NOTICE` con `Copyright 2026 Ryan W. Moore`. En LVM Worship no hay `LICENSE` ni `NOTICE` raíz rastreados. Mientras se distribuyan partes derivadas, revisar las condiciones de redistribución de Apache-2.0, incluidas copia de licencia, avisos pertinentes y cambios señalados. La ausencia del distintivo de fork no elimina esas condiciones. La revisión final de licencias debe incluir también fuentes e imágenes de terceros.
3. **Identidad legal visible incorrecta.** `apps/web/src/config/copyright.ts` y las traducciones web/móvil muestran `Ryan Moore`. `apps/web/src/content/privacy-policy.md`, `terms-of-use.md` y `delete-account.md` lo presentan como operador de La Voz Misionera, incluso con ubicación en Georgia, EE. UU. Son declaraciones de producto activas o potencialmente publicables y requieren contenido aprobado por el titular real. No sustituirlas automáticamente por otra persona sin validar el operador, contacto y tratamiento de datos.
4. **Marca y assets heredados.** `apps/mobile/assets/README.md` describe el icono como una marca «GC». El icono, splash y sprites móviles, así como `apps/web/public/gc-brand-wide-*.svg`, coinciden con el origen. Su reemplazo necesita diseño y procedencia propios; renombrar archivos no basta.
5. **Dependencias funcionales heredadas.** `--gc-*` sigue siendo el namespace de tokens y `createGcSupabase` es una API compartida. `GraceTracks` aún aparece en `apps/web/src/pages/SongViewPage.jsx` y en campos `gracetracks_url`; un enlace de `HomeDashboardPage.jsx` apunta a `rwm6857/LaVozMisionera`. Estos caminos deben clasificarse por uso real antes de retirarlos. Un cambio masivo de nombres rompería web, móvil, Studio y datos persistidos.
6. **Documentación desactualizada.** El README raíz menciona `dev:mock` y `build:mock`, pero `package.json` no define esos scripts. El modo de ejemplo ya fue retirado; la documentación debe reflejar el producto real.

## Decisiones de migración

| Área | Decisión | Gate |
| --- | --- | --- |
| Contratos `WorshipPlan 0.1` y `Service 0.1` | Conservar el comportamiento y las fronteras entre productos | Prueba offline Service → Worship → Service |
| Componentes web/móvil idénticos al origen | Reimplementar por verticales, conservando UX útil y pruebas de comportamiento | Sin código idéntico o derivado no atribuido en la vertical; pruebas y build verdes |
| Branding, iconos, splash, sprites | Reemplazar por assets LVM con procedencia documentada | Web, Android, iOS y Studio muestran marca LVM coherente |
| Textos legales y copyright visible | Corregir con datos aprobados del operador real, separando autoría de código heredado de titularidad del servicio | Privacidad, términos, eliminación de cuenta y About coherentes |
| `--gc-*`, `createGcSupabase`, claves `gc.*` | Migrar gradualmente; preservar compatibilidad de datos hasta definir transición | Ningún dato de usuario perdido; web/móvil/Studio funcionan |
| `GraceTracks` y enlaces a `rwm6857` | Clasificar como función activa, dato heredado o referencia obsoleta; retirar o reemplazar según el caso | Sin CTA roto ni dependencia externa accidental |
| Licencias y avisos | Restaurar cumplimiento mientras permanezca código derivado; inventariar atribuciones de terceros | Revisión de `LICENSE`, `NOTICE` y licencias de assets antes de publicar |

## Orden propuesto de M7.7

1. Resolver primero los textos que afirman quién opera el servicio y documentar la procedencia/licencia del estado actual.
2. Inventariar rutas activas por web, móvil, Studio, core y assets; asignar `conservar comportamiento`, `reimplementar`, `reemplazar asset` o `retirar`.
3. Migrar una vertical funcional a la vez, con pruebas de comportamiento y sin copiar código del origen durante la reimplementación.
4. Sustituir la marca en todas las superficies; migrar identificadores técnicos solo con compatibilidad explícita.
5. Repetir la comparación de blobs, revisar licencias y ejecutar los gates web/móvil/Studio antes de declarar «implementación propia».

La meta «100 % propio» permanece abierta. Esta auditoría establece un baseline medible; no certifica autoría, titularidad ni cumplimiento legal.

## Fuentes

- Árbol y archivos de `rwm6857/GraceChords`: https://github.com/rwm6857/GraceChords
- Licencia del origen: https://github.com/rwm6857/GraceChords/blob/main/LICENSE
- Aviso del origen: https://github.com/rwm6857/GraceChords/blob/main/NOTICE
- Condiciones Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0
