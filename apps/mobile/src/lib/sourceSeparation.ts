import { Directory, File, Paths } from 'expo-file-system'
import { createDownloadResumable } from 'expo-file-system/legacy'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { AudioContext } from 'react-native-audio-api'
import { encodeSeparatedWavs, separateSources, SEPARATION_RATE, SEPARATION_SHAPE } from '@lavozmisionera/core/music/sourceSeparation'
import { uuidv4 } from './uuid'
import { SOURCE_SEPARATION_NOTICE } from './sourceSeparationNotice'

const MODEL_HASH = 'e9570dac2ae14382c99357a547a6739777a029ad7f2b5f6e6bc22e9b0e7b2580'
const MODEL_BYTES = 235623148
const MODEL_URL = 'https://huggingface.co/redbaty/ytm-vocal-separator/resolve/d9d3f27d58c4f9c0286a07ed541b18ceaa91f107/sep-all-int8.onnx'
export type SeparationStage = 'download' | 'verify' | 'decode' | 'separate' | 'encode'
export type SeparatedFiles = { vocals: File; backing: File }
let running = false

export function removeSeparatedFiles(files: SeparatedFiles) {
  for (const file of [files.vocals, files.backing]) try { if (file.exists) file.delete() } catch { /* Cache can be reclaimed by the OS. */ }
}

export async function separateAudioFile(file: File, signal: AbortSignal, progress: (stage: SeparationStage, fraction: number) => void): Promise<SeparatedFiles> {
  if (running) throw new Error('busy')
  running = true
  const checkpoint = async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    if (signal.aborted) throw new Error('cancelled')
  }
  let context: AudioContext | undefined
  let session: import('onnxruntime-react-native').InferenceSession | undefined
  let files: SeparatedFiles | undefined
  try {
    await checkpoint()
    // Load only after an explicit action: older installed builds can still use the mixer.
    const ort = await import('onnxruntime-react-native').catch(() => { throw new Error('nativeBuild') })
    if (!file.exists || !file.size || file.size > 64 * 1024 * 1024) throw new Error('input')
    progress('decode', 0)
    context = new AudioContext({ sampleRate: SEPARATION_RATE })
    const audio = await context.decodeAudioData(file.uri)
    if (audio.duration > 140 || !audio.length || ![1, 2].includes(audio.numberOfChannels)) throw new Error('input')
    const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel))
    await checkpoint()
    const directory = new Directory(Paths.document, 'lvm-separation')
    directory.create({ intermediates: true, idempotent: true })
    new File(directory, 'MODEL-LICENSE.txt').write(SOURCE_SEPARATION_NOTICE)
    const model = new File(directory, 'melband-int8.onnx')
    if (!model.exists || model.size !== MODEL_BYTES) {
      const partial = new File(directory, `${uuidv4()}.download`)
      const task = createDownloadResumable(MODEL_URL, partial.uri, {}, event => progress('download', event.totalBytesWritten / MODEL_BYTES))
      const cancel = () => { void task.cancelAsync().catch(() => {}) }
      signal.addEventListener('abort', cancel, { once: true })
      try {
        progress('download', 0)
        await checkpoint()
        const result = await task.downloadAsync()
        await checkpoint()
        if (!result || result.status !== 200 || partial.size !== MODEL_BYTES) throw new Error('modelError')
        if (model.exists) model.delete()
        partial.move(model)
      } finally {
        signal.removeEventListener('abort', cancel)
        if (partial.exists && partial.uri !== model.uri) partial.delete()
      }
    }
    const hash = sha256.create()
    const handle = model.open()
    try {
      for (let read = 0; read < MODEL_BYTES;) {
        await checkpoint()
        const bytes = handle.readBytes(Math.min(1024 * 1024, MODEL_BYTES - read))
        if (!bytes.length) throw new Error('modelError')
        hash.update(bytes)
        read += bytes.length
        progress('verify', read / MODEL_BYTES)
      }
    } finally { handle.close() }
    if (bytesToHex(hash.digest()) !== MODEL_HASH) { model.delete(); throw new Error('modelError') }
    await checkpoint()
    progress('separate', 0)
    session = await ort.InferenceSession.create(model.uri.replace(/^file:\/\//, ''), { executionProviders: ['cpu'], intraOpNumThreads: 2 })
    const activeSession = session
    const output = await separateSources(channels, async spec => {
      const tensor = new ort.Tensor('float32', spec, [...SEPARATION_SHAPE])
      try {
        const result = await activeSession.run({ spec: tensor }, ['mask'])
        const mask = result.mask
        try {
          if (mask.type !== 'float32' || mask.dims.some((size, index) => size !== SEPARATION_SHAPE[index]) || mask.dims.length !== 4) throw new Error('output')
          return new Float32Array(mask.data as Float32Array)
        } finally { mask.dispose() }
      } finally { tensor.dispose() }
    }, checkpoint, fraction => progress('separate', fraction))
    await checkpoint()
    progress('encode', 0)
    const [vocals, backing] = encodeSeparatedWavs(output.vocals, output.backing)
    files = { vocals: new File(Paths.cache, `${uuidv4()}-vocals.wav`), backing: new File(Paths.cache, `${uuidv4()}-backing.wav`) }
    files.vocals.write(vocals)
    files.backing.write(backing)
    await checkpoint()
    return files
  } catch (error) {
    if (files) removeSeparatedFiles(files)
    throw error
  } finally {
    try { await session?.release() } finally {
      await context?.close().catch(() => {})
      running = false
    }
  }
}
