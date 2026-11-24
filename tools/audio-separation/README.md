# Separación local de audio para Worship

La herramienta convierte una mezcla WAV mono o estéreo en `vocals.wav` y `accompaniment.wav`. Conserva el inicio y la duración de las dos pistas para que se puedan importar juntas en **Audio de ensayo** o en el mezclador de Worship. El archivo de entrada se procesa en la computadora y el modelo se descarga por separado. Los WAV de salida usan PCM de 16 bits a 44,1 kHz. El máximo de 140 segundos permite que cada pista esté dentro del límite actual del mezclador.

Con Python 3.12, desde la raíz de Worship en PowerShell:

```powershell
python -m venv "$env:TEMP/lvm-separator-venv"
$python = "$env:TEMP/lvm-separator-venv/Scripts/python.exe"
& $python -m pip install 'numpy==2.2.1' 'scipy==1.17.1' 'onnxruntime==1.20.1'
$model = "$env:TEMP/lvm-sep-all-int8.onnx"
curl.exe --fail --location 'https://huggingface.co/redbaty/ytm-vocal-separator/resolve/d9d3f27d58c4f9c0286a07ed541b18ceaa91f107/sep-all-int8.onnx' --output $model
& $python tools/audio-separation/separate.py mezcla.wav pistas --model $model
```

Usá un directorio de salida nuevo. El proceso publica ambos WAV juntos al terminar. El progreso se escribe como JSON por tramos en la consola. La descarga del modelo es de aproximadamente 236 MB y la herramienta valida su SHA-256 antes de cargarlo.

## Desde Worship Web

Con el entorno y el modelo del ejemplo anterior, iniciá el separador en la misma computadora que el navegador. Para desarrollo, usá el origen exacto que imprime Vite. Para una web publicada, usá su origen HTTPS:

```powershell
& $python tools/audio-separation/serve.py --model $model --origin http://127.0.0.1:5173
```

En el mezclador abrí **Separar voz y acompañamiento**, elegí el WAV y pulsá **Separar**. Podés reproducir ambos resultados individualmente antes de elegir **Agregar al mezclador**. El navegador puede pedir permiso para conectarse al separador local. [Permisos de red local en Chromium](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)

## Desde Worship Expo

En **Audio de ensayo** o el mezclador, pausá la reproducción y elegí **Elegir WAV y separar**. La app descarga el mismo modelo fijado (236 MB) en su almacenamiento privado y verifica su SHA-256 por bloques. Después funciona sin conexión. El WAV permanece en el teléfono y el resultado permite preescuchar voz y acompañamiento antes de agregar las dos pistas y guardar el ensayo.

Esta función requiere regenerar y compilar el cliente nativo con `onnxruntime-react-native`; una actualización de JavaScript o Expo Go no incorpora ese motor. Usa CPU, ventanas de ocho segundos con solapamiento y el mismo límite de 140 segundos. Cancelar o salir de la pantalla descarta el trabajo cuando termina la inferencia del fragmento actual. El tiempo y consumo de memoria deben verificarse en Android e iOS físicos antes de distribuir la función; la exportación de Metro solo verifica el bundle.

`plugins/withOnnxNewArchitecture.js` adapta la inicialización JSI de la versión fijada 1.24.3 a React Native 0.83: Android obtiene el invocador directamente del contexto y iOS recibe runtime e invocador del gestor de TurboModules. También reemplaza el uso de `VersionNumber`, eliminado en Gradle 9, y fija el AAR de ONNX en 1.24.3. El plugin falla ante una versión distinta para obligar a revisar su compatibilidad antes de actualizar. Windows permite verificar los bundles de ambas plataformas y regenerar Android; regenerar iOS requiere macOS o Linux y compilarlo requiere macOS con Xcode.

## Importación de archivos generados

1. Abrí **Audio de ensayo** desde la canción en Worship Web o Expo.
2. Elegí **Importar pistas** y seleccioná los dos WAV juntos en un mezclador vacío.
3. Usá **Solo** en cada pista para escuchar el resultado. Guardá el ensayo si querés conservarlo junto a la canción.

El motor usa el modelo vocal de Kimberley Jensen en la conversión ONNX de redbaty. La ficha original indica MIT y la ficha del export incluye los avisos de atribución y licencia. Esta herramienta usa el grafo cuantizado de voces. [Modelo original](https://huggingface.co/KimberleyJSN/melbandroformer) · [Conversión, atribución y formato del grafo](https://huggingface.co/redbaty/ytm-vocal-separator/blob/d9d3f27d58c4f9c0286a07ed541b18ceaa91f107/README.md)

```powershell
& $python -m unittest discover -s tools/audio-separation -p 'test_*.py'
```
