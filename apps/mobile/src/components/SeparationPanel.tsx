import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { AudioContext, AudioManager, type AudioBufferSourceNode } from 'react-native-audio-api'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { removeSeparatedFiles, separateAudioFile, type SeparatedFiles, type SeparationStage } from '../lib/sourceSeparation'
import { useTheme } from '../theme/ThemeProvider'

export default function SeparationPanel({ disabled, onAdd, onStart, onBusy }: {
  disabled: boolean; onAdd: (files: SeparatedFiles, name: string) => Promise<boolean>; onStart: () => void; onBusy: (busy: boolean) => void
}) {
  const { t } = useTranslation('utilities', { keyPrefix: 'separation' })
  const theme = useTheme()
  const [files, setFiles] = useState<SeparatedFiles>()
  const [name, setName] = useState('')
  const [stage, setStage] = useState<SeparationStage>()
  const [fraction, setFraction] = useState(0)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState<'vocals' | 'backing'>()
  const [previewBusy, setPreviewBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const processing = useRef(false)
  const result = useRef<SeparatedFiles | undefined>(undefined)
  const alive = useRef(true)
  const preview = useRef<{ context: AudioContext; source?: AudioBufferSourceNode } | null>(null)
  const generation = useRef(0)
  const stop = useCallback(() => {
    generation.current++
    const current = preview.current
    preview.current = null
    try { current?.source?.stop() } catch { /* May already have ended. */ }
    void current?.context.close().catch(() => {})
    if (alive.current) { setPlaying(undefined); setPreviewBusy(false) }
  }, [])
  useEffect(() => { if (disabled) stop() }, [disabled, stop])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
      stop()
      if (result.current) removeSeparatedFiles(result.current)
    }
  }, [stop])
  useFocusEffect(useCallback(() => {
    const background = () => { if (processing.current) controller.current?.abort(); stop() }
    // The system document picker can background the app before processing starts.
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') background() })
    return () => { subscription.remove(); controller.current?.abort(); stop() }
  }, [stop]))

  async function choose() {
    if (controller.current || disabled || adding) return
    const abort = new AbortController()
    controller.current = abort
    onBusy(true)
    setError('')
    stop()
    onStart()
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['audio/wav', 'audio/x-wav', 'audio/wave'], copyToCacheDirectory: true })
      if (picked.canceled || abort.signal.aborted) return
      processing.current = true
      if (result.current) { removeSeparatedFiles(result.current); result.current = undefined; setFiles(undefined) }
      setName(picked.assets[0].name)
      const separated = await separateAudioFile(new File(picked.assets[0].uri), abort.signal, (next, progress) => {
        if (alive.current && !abort.signal.aborted) { setStage(next); setFraction(Math.min(1, progress)) }
      })
      if (!alive.current || abort.signal.aborted) removeSeparatedFiles(separated)
      else { result.current = separated; setFiles(separated) }
    } catch (cause) {
      if (alive.current && !abort.signal.aborted) setError(cause instanceof Error && ['nativeBuild', 'input', 'modelError'].includes(cause.message) ? cause.message : 'failed')
    } finally {
      processing.current = false
      controller.current = null
      if (alive.current) { setStage(undefined); onBusy(false) }
    }
  }

  async function listen(part: 'vocals' | 'backing') {
    const selected = result.current
    const wasPlaying = playing === part
    stop()
    if (!selected || wasPlaying) return
    const token = generation.current
    setPreviewBusy(true)
    onStart()
    try {
      const context = new AudioContext()
      preview.current = { context }
      const buffer = await context.decodeAudioData(selected[part].uri)
      if (token !== generation.current || !alive.current) return
      AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default', iosOptions: ['mixWithOthers'] })
      await AudioManager.setAudioSessionActivity(true)
      await context.resume()
      if (token !== generation.current || !alive.current) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      preview.current = { context, source }
      source.onEnded = () => { if (generation.current === token) stop() }
      source.start()
      setPlaying(part)
    } catch { if (alive.current && token === generation.current) { stop(); setError('failed') } }
    finally { if (alive.current && token === generation.current) setPreviewBusy(false) }
  }

  return <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }}>
    <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, color: theme.colors.ink }}>{t('title')}</Text>
    <Text style={{ color: theme.colors.sec }}>{t('description')}</Text>
    <Button title={t('choose')} variant="secondary" disabled={disabled || !!stage || adding} onPress={() => void choose()} />
    {stage && <>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.ink }}>{t(stage, { percent: Math.round(fraction * 100) })}</Text>
      <Button title={t('cancel')} variant="secondary" onPress={() => { controller.current?.abort(); setError('') }} />
      <Text style={{ color: theme.colors.sec }}>{t('cancelHint')}</Text>
    </>}
    {files && <>
      <Text style={{ color: theme.colors.ink }}>{name}</Text>
      {(['vocals', 'backing'] as const).map(part => <Button key={part} title={t(playing === part ? 'stop' : part)} variant="secondary"
        disabled={!!stage || adding || previewBusy || disabled} onPress={() => void listen(part)} />)}
      <Button title={t('add')} disabled={disabled || !!stage || adding || previewBusy} onPress={() => {
        stop(); setAdding(true); setError('')
        void onAdd(files, name).then(added => {
          if (!alive.current) return
          if (added) { removeSeparatedFiles(files); result.current = undefined; setFiles(undefined) }
          else setError('addFailed')
        }).catch(() => { if (alive.current) setError('addFailed') }).finally(() => { if (alive.current) setAdding(false) })
      }} />
    </>}
    {error && <Text accessibilityRole="alert" style={{ color: theme.colors.ink }}>{t(error)}</Text>}
  </View>
}
