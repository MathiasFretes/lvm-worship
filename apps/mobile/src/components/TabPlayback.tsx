import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, Switch, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { AudioContext, AudioManager } from 'react-native-audio-api'
import { useTranslation } from 'react-i18next'
import {
  buildTabPlayback, createTabSession, tabLoopMeasures, tabMidiFrequency, tabPlaybackSettings,
  type TabAudio, type TabPlaybackPosition,
} from '@lavozmisionera/core/music/tablaturePlayback'
import { buildScorePlayback } from '@lavozmisionera/core/music/scorePlayback'
import type { Score } from '@lavozmisionera/core/music/score'
import Button from './Button'
import { useTheme } from '../theme/ThemeProvider'

async function openAudio(): Promise<TabAudio> {
  AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default', iosOptions: ['mixWithOthers'] })
  await AudioManager.setAudioSessionActivity(true)
  const audio = new AudioContext()
  try {
    await audio.resume()
  } catch (error) {
    void audio.close().catch(() => {})
    throw error
  }
  return {
    clock: () => audio.currentTime,
    note(at, midi, decay, click, sustain) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = click ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(tabMidiFrequency(midi), at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.065, at + Math.min(0.006, decay / 4))
      if (sustain) gain.gain.setValueAtTime(0.065, at + decay - Math.min(0.025, decay / 4))
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(at)
      oscillator.stop(at + decay)
      return () => { gain.disconnect(); oscillator.stop() }
    },
    close: () => { void audio.close().catch(() => {}) },
  }
}

export default function TabPlayback({ source, score, onPosition }: ({
  source: string
  score?: never
} | {
  source?: never
  score: Score
}) & {
  onPosition: (position: TabPlaybackPosition | null) => void
}) {
  const { t } = useTranslation('utilities', { keyPrefix: 'tablature.playback' })
  const theme = useTheme()
  const [status, setStatus] = useState<'idle' | 'opening' | 'playing' | 'paused' | 'error'>('idle')
  const [tempo, setTempo] = useState('96')
  const [speed, setSpeed] = useState('100')
  const [transpose, setTranspose] = useState('0')
  const [loop, setLoop] = useState(false)
  const [metronome, setMetronome] = useState(false)
  const [first, setFirst] = useState('1')
  const [last, setLast] = useState('')
  const measures = useMemo(() => score ? buildScorePlayback(score) : buildTabPlayback(source ?? ''), [score, source])
  const session = useMemo(() => createTabSession({ open: openAudio, onPosition, onStatus: setStatus }), [onPosition])
  const active = status === 'opening' || status === 'playing' || status === 'paused'
  const range = loop ? tabLoopMeasures(measures, first, last) : measures
  const canPlay = range.length > 0 && (metronome || range.some(bar => bar.notes.length))

  useEffect(() => () => { session.dispose(); onPosition(null) }, [session, onPosition])
  useEffect(() => { session.stop() }, [session, measures])
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') session.stop()
    })
    return () => { subscription.remove(); session.stop() }
  }, [session]))

  function play() {
    const settings = tabPlaybackSettings(score ? String(score.tempo) : tempo, speed, transpose)
    if (!score) setTempo(String(settings.bpm))
    setSpeed(String(settings.speed))
    setTranspose(String(settings.transpose))
    void session.play(range, settings.bpm, settings.speed, settings.transpose, loop, metronome)
  }

  function field(key: string, value: string, change: (value: string) => void, placeholder?: string) {
    return <View style={{ gap: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.ink }}>{t(key)}</Text>
      <TextInput accessibilityLabel={t(key)} keyboardType={key === 'pitch' ? 'numbers-and-punctuation' : 'number-pad'}
        editable={!active} value={value} placeholder={placeholder} placeholderTextColor={theme.colors.sec}
        maxLength={5} onChangeText={change} style={{
          minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.sm, color: theme.colors.ink,
        }} />
    </View>
  }

  const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm } as const
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, color: theme.colors.ink }}>{t(score ? 'scoreTitle' : 'title')}</Text>
      <View style={row}>
        {status === 'playing'
          ? <Button title={t('pause')} onPress={session.pause} />
          : <Button title={t('play')} disabled={status === 'opening' || !canPlay} onPress={play} />}
        <Button title={t('stop')} variant="secondary" disabled={!active} onPress={session.stop} />
        <Text style={{ color: theme.colors.ink }}>{t('loop')}</Text>
        <Switch accessibilityLabel={t('loop')} value={loop} disabled={active} onValueChange={setLoop} />
        <Text style={{ color: theme.colors.ink }}>{t('metronome')}</Text>
        <Switch accessibilityLabel={t('metronome')} value={metronome} disabled={active} onValueChange={setMetronome} />
      </View>
      <View style={row}>
        {!score && field('bpm', tempo, setTempo)}
        {field('speed', speed, setSpeed)}
        {field('pitch', transpose, setTranspose)}
      </View>
      {loop && <View style={row}>
        {field('first', first, setFirst)}
        {field('last', last, setLast, String(measures.length))}
      </View>}
      <Text style={{ color: theme.colors.sec }}>{t(score ? 'scoreHelp' : 'help')}</Text>
      {status === 'error' && <Text accessibilityRole="alert" style={{ color: theme.colors.ink }}>{t('error')}</Text>}
      {loop && !range.length && <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.ink }}>{t('invalidRange')}</Text>}
    </View>
  )
}
