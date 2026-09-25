# La Voz Misionera: mapa de producto

Estado: visión de producto y límites de responsabilidad, 2026-09-25. No describe funcionalidades ya entregadas.

## Productos y repositorios

| Producto | Repositorio | Responsable de | Estado |
| --- | --- | --- | --- |
| LVM Platform | futuro `MathiasFretes/la-voz-misionera-platform` | Iglesia, personas, equipos, sedes y servicios | No creado |
| LVM Worship | `MathiasFretes/lvm-worship` (fork de GraceChords) | Canciones, arreglos y repertorios | Fork creado; modo local de desarrollo inicial |
| LVM Presenter | `MathiasFretes/lvm-presenter` (fork de FreeShow) | Presentación local, Biblia, salidas y operación en vivo | Fork creado; instala, compila y arranca; prueba de escritorio pasa. Chequeos Svelte/formato/lint fallan en upstream |
| La Voz Misionera V0 | `C:\la-voz-misionera-v0` | Referencia funcional y fuente futura de migración | Archivado |

La carpeta local de Worship sigue siendo `C:\la-voz-misionera`, según la ubicación elegida para este trabajo. Presenter está en `C:\lvm-presenter`.

## Propiedad del dato

- Platform crea y mantiene iglesia, sede, persona, equipo y servicio.
- Worship mantiene canción, versión, arreglo y repertorio musical. Un repertorio puede referirse a un servicio de Platform.
- Presenter importa una copia operativa del servicio, canciones, referencias bíblicas y medios para funcionar sin conexión. Sus cambios locales y registros de uso requieren reglas explícitas de sincronización antes de habilitar escritura de vuelta.
- Un mismo identificador de servicio relaciona las tres experiencias. Compartir un contrato no implica permitir que cada aplicación escriba en las tablas de las otras.

## Primer flujo verificable

1. Crear un servicio con fecha, sede y orden.
2. Asignar personas y equipo.
3. Preparar canciones y tonalidades en Worship.
4. Exportar un paquete local de servicio con referencias a canciones y Biblia.
5. Abrirlo en Presenter y proyectar letras y pasajes con Internet desconectado.

El contrato del servicio y sus fixtures JSON se diseñarán después de auditar los dos forks. La primera versión no requiere backend, Auth, Supabase, PostgreSQL, Rust ni n8n.

## Secuencia de trabajo

1. Ordenar repositorios y verificar baseline local de ambos forks.
2. Auditar qué se conserva, adapta, elimina o pospone.
3. Definir el contrato de `Service`, `ServiceItem`, `Song`, `Person`, `Team` y `ScriptureReference`.
4. Demostrar la integración local Worship → servicio JSON → Presenter.
5. Crear Platform mínimo con Servicios, Equipos y Personas usando fixtures.
6. Diseñar persistencia y API según los flujos comprobados.

## Licencias y contenido

Worship conserva `LICENSE` y `NOTICE` de GraceChords (Apache-2.0). Presenter conserva la licencia GPL-3.0 de FreeShow en su propio repositorio. No se copiará código entre ellos sin revisar la distribución resultante. El texto de cada traducción bíblica solo se empaquetará o descargará para uso sin conexión cuando su licencia lo permita.
