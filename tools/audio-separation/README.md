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

1. Abrí **Audio de ensayo** desde la canción en Worship Web o Expo.
2. Elegí **Importar pistas** y seleccioná los dos WAV juntos en un mezclador vacío.
3. Usá **Solo** en cada pista para escuchar el resultado. Guardá el ensayo si querés conservarlo junto a la canción.

El motor usa el modelo vocal de Kimberley Jensen en la conversión ONNX de redbaty. La ficha original indica MIT y la ficha del export incluye los avisos de atribución y licencia. Esta herramienta usa el grafo cuantizado de voces. [Modelo original](https://huggingface.co/KimberleyJSN/melbandroformer) · [Conversión, atribución y formato del grafo](https://huggingface.co/redbaty/ytm-vocal-separator/blob/d9d3f27d58c4f9c0286a07ed541b18ceaa91f107/README.md)

```powershell
& $python -m unittest discover -s tools/audio-separation -p 'test_*.py'
```
