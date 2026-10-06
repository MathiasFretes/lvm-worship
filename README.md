# LVM Worship

LVM Worship prepara el repertorio musical de La Voz Misionera. El equipo arma un setlist local con canciones, tonalidades, secciones y repeticiones, y entrega a LVM Platform un archivo `WorshipPlan 0.1`. Platform integra ese repertorio en el orden completo del culto; LVM Presenter recibe después `Service 0.1` para proyección.

```text
Platform → contexto del servicio → Worship → WorshipPlan 0.1 → Platform
Platform → Service 0.1 → Presenter
```

## Flujo local

1. Abre el borrador en `/setlist` y elige **Abrir contexto de Platform**.
2. Agrega canciones de la biblioteca disponible o importa ChordPro local (`.cho`, `.chordpro`, `.pro`, `.txt`).
3. Ajusta el orden, las tonalidades y las repeticiones de secciones.
4. Usa **Guardar para Platform** para exportar el archivo `WorshipPlan 0.1`.

El borrador y el contexto importado se conservan en el navegador. Guarda el JSON exportado como copia portable. El intercambio con Platform es por archivos locales; no promete sincronización en vivo.

## Desarrollo local

Usa Node compatible con el `package.json` del repositorio. Desde la raíz:

```powershell
npm ci
npm run dev:mock
```

`dev:mock` permite explorar la aplicación con canciones de muestra. Para verificar los cambios:

```powershell
npm run test:run
npm run build:mock
```

El código de la aplicación web vive en `apps/web/`; la lógica compartida en `packages/core/`. El [contrato de servicio](docs/service-contract.md) y la [auditoría del flujo de Worship](docs/worship-flow-audit.md) describen los límites del intercambio local.
