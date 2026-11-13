import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { AudioContext, AudioManager, type AudioBuffer } from 'react-native-audio-api'
import { useTranslation } from 'react-i18next'
import { createStemMixer, emptyMixer, MIXER_FILE_BYTES, MIXER_TRACK_LIMIT, type MixerAudio } from '@lavozmisionera/core/music/stemMixer'
import { currentMixerMarker, makeMixerProject, MIXER_CHART_LIMIT, putMixerMarker, restoreMixerProject, type MixerManifest, type MixerMarker } from '@lavozmisionera/core/music/mixerProject'
import { parseChordProOrLegacy } from '@lavozmisionera/core'
import { stretchMixerAudio } from '@lavozmisionera/core/music/stretchMixerAudio'
import { clampBpm, MIXER_CLICK, TIME_SIGNATURES } from '@lavozmisionera/core/music/metronomePattern'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { ChartSection } from '../components/ChordChart'
import Screen from '../components/Screen'
import { readMixerProject, writeMixerProject } from '../lib/mixerStore'
import { usePersonalSong, useSong } from '../lib/useSong'
import { useTheme } from '../theme/ThemeProvider'

function nativeAudio(): MixerAudio<AudioBuffer> {
  const audio = new AudioContext()
  return {
    clock: () => audio.currentTime,
    decode: bytes => audio.decodeAudioData(bytes),
    prepare: (buffers, stretch, cancelled) => stretchMixerAudio(buffers, stretch, audio.createBuffer.bind(audio), cancelled),
    async resume() {
      AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default', iosOptions: ['mixWithOthers'] })
      await AudioManager.setAudioSessionActivity(true)
      await audio.resume()
    },
    close: () => { void audio.close().catch(() => {}) },
    click(at, emphasis) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      const { frequency, peak } = MIXER_CLICK[emphasis]
      oscillator.frequency.setValueAtTime(frequency, at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.044)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.onEnded = () => { oscillator.disconnect(); gain.disconnect() }
      oscillator.start(at)
      oscillator.stop(at + 0.05)
      return () => { gain.disconnect(); oscillator.stop() }
    },
    play(buffer, at, offset, duration, rate, volume) {
      const source = audio.createBufferSource()
      const gain = audio.createGain()
      source.buffer = buffer
      source.playbackRate.value = rate
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(audio.destination)
      source.start(at, offset, duration)
      return {
        gain: value => gain.gain.setTargetAtTime(value, audio.currentTime, 0.008),
        stop: () => {
          gain.disconnect()
          source.disconnect()
          source.stop()
        },
      }
    },
  }
}

export default function MixerScreen({ embedded = false, songId, songTitle, songSlug, personal = false, chartSteps, preferFlat = false }: {
  embedded?: boolean; songId?: string; songTitle?: string; songSlug?: string; personal?: boolean; chartSteps?: number; preferFlat?: boolean
}) {
  const { t } = useTranslation('utilities', { keyPrefix: 'mixer' })
  const theme = useTheme()
  const [state, setState] = useState(emptyMixer)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restoring, setRestoring] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stored, setStored] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const [draftError, setDraftError] = useState('')
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState('')
  const [seek, setSeek] = useState('')
  const [clickBpm, setClickBpm] = useState<string | null>(null)
  const [markers, setMarkers] = useState<MixerMarker[]>([])
  const [markerLabel, setMarkerLabel] = useState('')
  const [section, setSection] = useState<number>()
  const [savedChart, setSavedChart] = useState('')
  const [savedChartKey, setSavedChartKey] = useState<MixerManifest['chartKey']>()
  const chartKey = chartSteps === undefined ? savedChartKey : { steps: chartSteps, preferFlat }
  const catalog = useSong(!personal && !restoring && !savedChart ? songSlug : undefined)
  const personalSong = usePersonalSong(personal && !restoring && !savedChart ? songId : undefined)
  const song = personal ? personalSong.song : catalog.song
  const chart = savedChart || (song && song.id === songId ? song.chordpro_content || '' : '')
  const sections = useMemo(() => chart ? parseChordProOrLegacy(chart).sections.filter(item => item.lines.length) : [], [chart])
  const currentMarker = currentMixerMarker(markers, state.time)
  const visibleSection = sections[currentMarker?.section ?? 0]
  const sectionName = (index: number) => sections[index]?.label || t('chartSection', { index: index + 1 })
  const mixer = useRef<ReturnType<typeof createStemMixer<AudioBuffer>> | null>(null)
  const assets = useRef(new Map<number, File>())
  const mounted = useRef(false)
  const importing = useRef(false)

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    let candidate: ReturnType<typeof createStemMixer<AudioBuffer>> | undefined
    async function restore() {
      try {
        const draft = await readMixerProject(songId)
        if (cancelled || !draft) return
        setStored(true)
        let latest = emptyMixer
        candidate = createStemMixer(nativeAudio(), next => {
          latest = next
          if (!cancelled && mixer.current === candidate) setState(next)
        }, reason => setDraftError(reason === 'processing' ? 'processingError' : 'audioError'))
        const result = await restoreMixerProject(draft.manifest, draft.files, candidate)
        if (cancelled) return
        assets.current = result.assets
        mixer.current = candidate
        setState(latest)
        setMarkers(result.manifest.markers)
        setSavedChart(result.manifest.chart || '')
        setSavedChartKey(result.manifest.chartKey)
        if (result.manifest.loop) {
          setStart(String(result.manifest.loop.start))
          setEnd(String(result.manifest.loop.end))
        }
      } catch {
        candidate?.dispose()
        if (!cancelled) setDraftError('restoreError')
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }
    void restore()
    return () => {
      cancelled = true
      mounted.current = false
      candidate?.dispose()
      mixer.current?.dispose()
      mixer.current = null
      assets.current.clear()
    }
  }, [songId])
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status !== 'active') mixer.current?.pause()
    })
    return () => { subscription.remove(); if (mounted.current) mixer.current?.pause() }
  }, []))

  async function importFiles() {
    if (importing.current || restoring || saving) return
    importing.current = true
    setBusy(true)
    setError('')
    const failures: string[] = []
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true })
      if (result.canceled || !mounted.current) return
      mixer.current ??= createStemMixer(nativeAudio(), setState, reason => setDraftError(reason === 'processing' ? 'processingError' : 'audioError'))
      const engine = mixer.current
      for (const { uri, name } of result.assets) {
        if (!mounted.current) break
        try {
          const file = new File(uri)
          const id = file.size <= MIXER_FILE_BYTES ? await engine.add(name, await file.arrayBuffer()) : null
          if (id === null) failures.push(name)
          else if (mounted.current && mixer.current === engine) assets.current.set(id, file)
        } catch {
          failures.push(name)
        }
      }
      if (mounted.current && failures.length) setError(t('importError', { files: failures.join(', ') }))
    } catch {
      if (mounted.current) setError(t('audioError'))
    } finally {
      importing.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function saveDraft() {
    if (busy || restoring || saving) return
    setSaving(true)
    setDraftError('')
    setDraftStatus('')
    try {
      const project = makeMixerProject(state, assets.current, markers, chart && chart.length <= MIXER_CHART_LIMIT ? chart : undefined, chartKey)
      const files = await writeMixerProject(project, songId)
      if (mounted.current) {
        state.tracks.forEach(({ id }, index) => assets.current.set(id, files[index]))
        setStored(files.length > 0)
        setDraftStatus(files.length ? 'saved' : 'deleted')
      }
    } catch {
      if (mounted.current) setDraftError('saveError')
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  function applyLoop() {
    const valid = start.trim() && mixer.current?.setLoop(Number(start.replace(',', '.')), end.trim() ? Number(end.replace(',', '.')) : state.duration)
    setError(valid ? '' : t('loopError'))
  }

  const ink = { color: theme.colors.ink }
  const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm } as const
  const panel = { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: theme.spacing.md }
  function field(label: string, value: string, onChangeText: (text: string) => void, placeholder?: string) {
    return <View style={{ gap: theme.spacing.xs }}>
      <Text style={ink}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={value}
        placeholder={placeholder} placeholderTextColor={theme.colors.sec} maxLength={10} onChangeText={onChangeText}
        style={{ ...ink, minHeight: 44, minWidth: 80, paddingHorizontal: theme.spacing.sm,
          borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md }} />
    </View>
  }

  const content = (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Text style={{ color: theme.colors.sec }}>{t('description')}</Text>
      {songId && <Text accessibilityRole="header" style={ink}>{t('songRehearsal', { title: songTitle || songId })}</Text>}
      <Button title={t(busy ? 'loading' : 'import')} disabled={busy || restoring || saving || state.preparing || state.tracks.length >= MIXER_TRACK_LIMIT} onPress={() => void importFiles()} />
      {(stored || state.tracks.length > 0) && <Button title={t(saving ? 'saving' : state.tracks.length ? 'save' : 'deleteSaved')}
        variant="secondary" disabled={busy || restoring || saving} onPress={() => void saveDraft()} />}
      {error ? <Text accessibilityRole="alert" style={ink}>{error}</Text> : null}
      {draftError ? <Text accessibilityRole="alert" style={ink}>{t(draftError)}</Text> : null}
      {draftStatus ? <Text accessibilityLiveRegion="polite" style={ink}>{t(draftStatus)}</Text> : null}
      {state.tracks.length > 0 ? <>
        {visibleSection && <View style={panel}>
          <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, ...ink }}>{t('chart')}</Text>
          {currentMarker?.section !== undefined && <Text accessibilityLiveRegion="polite" style={ink}>{t('currentSection', { name: currentMarker.label })}</Text>}
          <ChartSection section={visibleSection} first steps={chartKey?.steps ?? 0} preferFlat={chartKey?.preferFlat ?? false} showChords showSections fontScale={1} chordStyle="letters" />
        </View>}
        <View style={panel}>
          <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, ...ink }}>{t('transport')}</Text>
          <View style={row}>
            <Button title={t(state.preparing ? 'preparing' : state.playing ? 'pause' : 'play')} disabled={state.preparing} onPress={() => {
              setDraftError('')
              if (state.playing) mixer.current?.pause()
              else void mixer.current?.play()
            }} />
            <Button title={t('stop')} variant="secondary" onPress={() => mixer.current?.stop()} />
          </View>
          <Text style={ink}>{t('position')} {state.time.toFixed(1)} / {state.duration.toFixed(1)} s</Text>
          <View style={row}>
            {field(t('position'), seek, setSeek)}
            <Button title={t('seek')} variant="secondary" disabled={state.preparing || !seek.trim()} onPress={() => mixer.current?.seek(Number(seek.replace(',', '.')))} />
          </View>
          <Text style={ink}>{t('speed')} {Math.round(state.rate * 100)}%</Text>
          <View style={row}>
            <Button title="−" accessibilityLabel={t('slower')} variant="secondary" disabled={state.preparing || state.rate <= 0.5} onPress={() => {
              setDraftError(''); mixer.current?.setRate(state.rate - 0.25)
            }} />
            <Button title="+" accessibilityLabel={t('faster')} variant="secondary" disabled={state.preparing || state.rate >= 1.5} onPress={() => {
              setDraftError(''); mixer.current?.setRate(state.rate + 0.25)
            }} />
          </View>
          <Text style={ink}>{t('pitch')} {state.pitch > 0 ? `+${state.pitch}` : state.pitch}</Text>
          <View style={row}>
            <Button title="−" accessibilityLabel={t('lowerPitch')} variant="secondary" disabled={state.preparing || state.pitch <= -12} onPress={() => {
              setDraftError(''); mixer.current?.setPitch(state.pitch - 1)
            }} />
            <Button title="+" accessibilityLabel={t('raisePitch')} variant="secondary" disabled={state.preparing || state.pitch >= 12} onPress={() => {
              setDraftError(''); mixer.current?.setPitch(state.pitch + 1)
            }} />
          </View>
          <View style={row}>
            {field(t('start'), start, setStart)}
            {field(t('end'), end, setEnd, state.duration.toFixed(1))}
          </View>
          <View style={row}>
            <Button title={t('apply')} variant="secondary" disabled={state.preparing} onPress={applyLoop} />
            <Button title={t('clear')} variant="secondary" disabled={state.preparing || !state.loop} onPress={() => { mixer.current?.clearLoop(); setError('') }} />
          </View>
          {state.loop && <Text style={ink}>{t('loop', { start: state.loop.start.toFixed(1), end: state.loop.end.toFixed(1) })}</Text>}
          <View style={row}>
            <Chip label={t('click')} selected={state.metronome.enabled} disabled={state.preparing}
              onPress={() => mixer.current?.setMetronome({ ...state.metronome, enabled: !state.metronome.enabled })} />
          </View>
          {state.metronome.enabled && <>
            <Text style={ink}>{t('clickBpm')}</Text>
            <TextInput accessibilityLabel={t('clickBpm')} keyboardType="number-pad" maxLength={3}
              editable={!state.preparing}
              value={clickBpm ?? String(state.metronome.bpm)} onChangeText={setClickBpm} onBlur={() => {
                if (clickBpm?.trim()) mixer.current?.setMetronome({ ...state.metronome, bpm: clampBpm(Number(clickBpm)) })
                setClickBpm(null)
              }} style={{ ...ink, minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: theme.spacing.sm }} />
            <Text style={ink}>{t('clickMeter')}</Text>
            <View style={row}>
              {TIME_SIGNATURES.map(({ id }) => <Chip key={id} label={id} selected={state.metronome.meter === id} disabled={state.preparing}
                onPress={() => mixer.current?.setMetronome({ ...state.metronome, meter: id })} />)}
            </View>
            <Button title={t('clickAnchor')} disabled={state.preparing || state.playing} variant="secondary"
              onPress={() => mixer.current?.setMetronome({ ...state.metronome, offset: state.time })} />
            <Text style={ink}>{t('clickAnchorAt', { time: state.metronome.offset.toFixed(2) })}</Text>
          </>}
        </View>
        <View style={panel}>
          <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, ...ink }}>{t('markers')}</Text>
          {sections.length > 0 && <>
            <Text style={ink}>{t('chartSectionLabel')}</Text>
            <View style={row}>
              <Chip label={t('unlinkedMarker')} selected={section === undefined} onPress={() => setSection(undefined)} />
              {sections.map((_, index) => <Chip key={index} label={`${index + 1} · ${sectionName(index)}`} selected={section === index} onPress={() => setSection(index)} />)}
            </View>
          </>}
          <Text style={ink}>{t('markerName')}</Text>
          <TextInput accessibilityLabel={t('markerName')} value={markerLabel} onChangeText={setMarkerLabel} maxLength={100}
            style={{ ...ink, minHeight: 44, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md }} />
          <Button title={t('markPosition')} disabled={(!markerLabel.trim() && section === undefined) || markers.length >= 100 || saving || state.preparing} onPress={() => {
            const label = markerLabel.trim() || (section !== undefined ? sectionName(section).slice(0, 100) : '')
            if (!label) return
            setMarkers(putMixerMarker(markers, label, state.time, section))
            setMarkerLabel('')
          }} />
          {markers.map((marker, index) => {
            const nextTime = Math.min(state.duration, markers[index + 1]?.time ?? state.duration)
            const selected = state.time >= marker.time && (markers[index + 1]?.time ?? Infinity) > state.time
            return <View key={marker.time} style={row}>
              <Button title={`${marker.label} · ${marker.time.toFixed(2)} s`} variant={selected ? 'primary' : 'secondary'} disabled={state.preparing || marker.time > state.duration}
                onPress={() => {
                  if (state.loop && (marker.time < state.loop.start || marker.time >= state.loop.end)) mixer.current?.clearLoop()
                  mixer.current?.seek(marker.time)
                }} />
              <Button title={t('loopMarker', { name: marker.label })} variant="secondary" disabled={state.preparing || nextTime - marker.time < 0.25}
                onPress={() => {
                  if (mixer.current?.setLoop(marker.time, nextTime)) {
                    setStart(String(marker.time))
                    setEnd(String(nextTime))
                    setError('')
                  }
                }} />
              <Button title={t('removeMarker', { name: marker.label })} variant="secondary" disabled={saving}
                onPress={() => setMarkers(markers.filter(item => item !== marker))} />
            </View>
          })}
        </View>
        {state.tracks.map(track => (
          <View key={track.id} style={panel}>
            <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, ...ink }}>{track.name}</Text>
            <Text style={ink}>{t('volume')} {Math.round(track.volume * 100)}%</Text>
            <View style={row}>
              <Button title="−" accessibilityLabel={t('quieter', { name: track.name })} variant="secondary" disabled={track.volume <= 0}
                onPress={() => mixer.current?.update(track.id, { volume: Math.round((track.volume - 0.1) * 10) / 10 })} />
              <Button title="+" accessibilityLabel={t('louder', { name: track.name })} variant="secondary" disabled={track.volume >= 1}
                onPress={() => mixer.current?.update(track.id, { volume: Math.round((track.volume + 0.1) * 10) / 10 })} />
            </View>
            <View style={row}>
              <Button title={t(track.muted ? 'muted' : 'mute')} variant={track.muted ? 'primary' : 'secondary'}
                onPress={() => mixer.current?.update(track.id, { muted: !track.muted })} />
              <Button title={t(track.solo ? 'soloOn' : 'solo')} variant={track.solo ? 'primary' : 'secondary'}
                onPress={() => mixer.current?.update(track.id, { solo: !track.solo })} />
              <Button title={t('remove')} accessibilityLabel={t('removeFor', { name: track.name })} variant="secondary"
                disabled={saving || state.preparing} onPress={() => { mixer.current?.remove(track.id); assets.current.delete(track.id) }} />
            </View>
          </View>
        ))}
      </> : <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.sec }}>{t(restoring ? 'restoring' : 'empty')}</Text>}
    </ScrollView>
  )
  if (embedded) return content
  return <Screen edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ headerShown: true, title: t('title') }} />
    {content}
  </Screen>
}
