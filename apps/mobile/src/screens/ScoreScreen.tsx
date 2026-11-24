import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { Stack } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_SCORE_NOTE, DURATIONS, EMPTY_SCORE, METERS, REST_SYMBOLS, SCORE_MAX_BYTES, SCORE_MAX_MEASURES, STEPS,
  editScoreNote, fillScoreMeasure, measureTicks, meterTicks, parseScoreDraft, scoreStaff,
  type Score, type ScoreDuration, type ScoreNote, type ScorePitch,
} from '@lavozmisionera/core/music/score'
import { readMusicXml, writeMusicXml } from '@lavozmisionera/core/music/musicXml'
import { scoreEventAt } from '@lavozmisionera/core/music/scorePlayback'
import { songMaterialKey } from '@lavozmisionera/core/music/songMaterial'
import type { TabPlaybackPosition } from '@lavozmisionera/core/music/tablaturePlayback'
import Button from '../components/Button'
import Chip from '../components/Chip'
import Screen from '../components/Screen'
import TabPlayback from '../components/TabPlayback'
import { useTheme } from '../theme/ThemeProvider'

const flags: Partial<Record<ScoreDuration, number>> = { eighth: 1, '16th': 2, '32nd': 3 }

export default function ScoreScreen({ embedded = false, songId, songTitle }: { embedded?: boolean; songId?: string; songTitle?: string }) {
  const draftKey = songMaterialKey('score', songId)
  const theme = useTheme()
  const { t } = useTranslation('utilities', { keyPrefix: 'score' })
  const [score, setScore] = useState<Score>(() => ({ ...EMPTY_SCORE, title: songId ? (songTitle || '').slice(0, 120) : '' }))
  const [measure, setMeasure] = useState(0)
  const [selection, setSelection] = useState<number | null>(null)
  const [note, setNote] = useState<ScoreNote>(DEFAULT_SCORE_NOTE)
  const [incoming, setIncoming] = useState<Score | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tempoInput, setTempoInput] = useState('96')
  const [position, setPosition] = useState<TabPlaybackPosition | null>(null)
  const staffScroll = useRef<ScrollView>(null)
  const scrollX = useRef(0)
  const [staffWidth, setStaffWidth] = useState(0)
  const visibleMeasure = Math.min(position?.measure ?? measure, score.measures.length - 1)
  const notes = score.measures[visibleMeasure]
  const sounding = position ? scoreEventAt(notes, position.column) : -1
  const staff = scoreStaff(notes, score.clef)
  const ticks = measureTicks(notes)
  const capacity = meterTicks(score.meter)
  const [beats, beatUnit] = score.meter.split('/')
  const complete = score.measures.every(bar => measureTicks(bar) === capacity)

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(draftKey).then(raw => {
      if (active && raw) {
        const value = parseScoreDraft(raw)
        setScore(value)
        setTempoInput(String(value.tempo))
      }
    }).catch(() => {
      if (active) setError('storageError')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [draftKey])

  useEffect(() => {
    if (sounding < 0 || !staffWidth) return
    const x = 48 + sounding * 44
    if (x < scrollX.current || x + 44 > scrollX.current + staffWidth) {
      staffScroll.current?.scrollTo({ x, animated: false })
    }
  }, [visibleMeasure, sounding, staffWidth])

  function changeMeasure(index: number) {
    setMeasure(index)
    setSelection(null)
    setError('')
  }

  function updateScore(next: Score) {
    setScore(next)
    setSaved(false)
  }

  function setPitch(patch: Partial<ScorePitch>) {
    setNote({ ...note, pitch: { ...(note.pitch ?? DEFAULT_SCORE_NOTE.pitch!), ...patch } })
  }

  function apply(next: ScoreNote | null) {
    const result = editScoreNote(score, measure, selection ?? notes.length, next)
    if (!result) {
      setError('noteError')
      return
    }
    updateScore(result)
    setSelection(null)
    setError('')
  }

  async function run(action: () => Promise<void>, errorKey: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() } catch { setError(errorKey) } finally { setBusy(false) }
  }

  async function importFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (result.canceled) return
    const file = new File(result.assets[0].uri)
    if (file.size > SCORE_MAX_BYTES) throw new Error()
    setIncoming(readMusicXml(await file.text()))
  }

  async function exportFile() {
    if (!await Sharing.isAvailableAsync()) throw new Error()
    const file = new File(Paths.cache, 'partitura.musicxml')
    file.create({ overwrite: true })
    file.write(writeMusicXml(score))
    await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.recordare.musicxml+xml', UTI: 'public.xml' })
  }

  const ink = { color: theme.colors.ink }
  const heading = { ...theme.typography.rowTitle, ...ink }
  const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm } as const
  const line = { position: 'absolute', height: 1, backgroundColor: theme.colors.ink } as const
  const inputStyle = { ...ink, minHeight: 44, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: theme.spacing.sm }
  const content = (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Text style={{ color: theme.colors.sec }}>{t('description')}</Text>
      {songId && songTitle && <Text accessibilityRole="header" style={heading}>{songTitle}</Text>}
      {error ? <Text accessibilityRole="alert" style={ink}>{t(error)}</Text> : null}
      {loading ? <Text accessibilityLiveRegion="polite" style={ink}>{t('loading')}</Text> : <>
        <View style={row}>
          <Button title={t('import')} variant="secondary" disabled={busy || Boolean(incoming)} onPress={() => void run(importFile, 'importError')} />
          <Button title={t('export')} disabled={busy || !complete} onPress={() => void run(exportFile, 'exportError')} />
          <Button title={t('save')} variant="secondary" disabled={busy} onPress={() => void run(async () => {
            await AsyncStorage.setItem(draftKey, JSON.stringify(score))
            setSaved(true)
          }, 'storageError')} />
        </View>
        {saved && <Text accessibilityLiveRegion="polite" style={ink}>{t('saved')}</Text>}
        {incoming && <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md }}>
          <Text accessibilityRole="header" style={heading}>{t('importPreview')}</Text>
          <Text style={ink}>{incoming.title || t('untitled')}</Text>
          <Text style={ink}>{t('summary', { count: incoming.measures.length, meter: incoming.meter, tempo: incoming.tempo })}</Text>
          <Text style={{ color: theme.colors.sec }}>{t('importScope')}</Text>
          <View style={row}>
            <Button title={t('cancel')} variant="secondary" onPress={() => setIncoming(null)} />
            <Button title={t('replace')} onPress={() => { updateScore(incoming); setTempoInput(String(incoming.tempo)); setIncoming(null); changeMeasure(0) }} />
          </View>
        </View>}
        <Text style={heading}>{t('name')}</Text>
        <TextInput accessibilityLabel={t('name')} value={score.title} maxLength={120} onChangeText={title => updateScore({ ...score, title })} style={inputStyle} />
        <View style={row}>
          <Text style={heading}>{t('tempo')}</Text>
          <TextInput accessibilityLabel={t('tempo')} value={tempoInput} keyboardType="number-pad" maxLength={3} style={inputStyle}
            onChangeText={value => {
              setTempoInput(value)
              const tempo = Number(value)
              if (Number.isInteger(tempo) && tempo >= 30 && tempo <= 300) updateScore({ ...score, tempo })
            }} onBlur={() => setTempoInput(String(score.tempo))} />
        </View>
        <Text style={heading}>{t('meter')}</Text>
        <View style={row}>{METERS.map(meter => <Chip key={meter} label={meter} selected={score.meter === meter} onPress={() => {
          if (score.measures.some(bar => measureTicks(bar) > meterTicks(meter))) setError('meterError')
          else { updateScore({ ...score, meter }); setError('') }
        }} />)}</View>
        <Text style={heading}>{t('clef')}</Text>
        <View style={row}>
          <Chip label={t('treble')} selected={score.clef === 'G'} onPress={() => updateScore({ ...score, clef: 'G' })} />
          <Chip label={t('bass')} selected={score.clef === 'F'} onPress={() => updateScore({ ...score, clef: 'F' })} />
        </View>
        <TabPlayback score={score} onPosition={setPosition} />
        <View style={row}>
          <Text accessibilityRole="header" style={heading}>{t('measure')} {visibleMeasure + 1}/{score.measures.length}</Text>
          <Button title="−" accessibilityLabel={t('previousMeasure')} variant="secondary" disabled={Boolean(position) || measure === 0} onPress={() => changeMeasure(measure - 1)} />
          <Button title="+" accessibilityLabel={t('nextMeasure')} variant="secondary" disabled={Boolean(position) || measure === score.measures.length - 1} onPress={() => changeMeasure(measure + 1)} />
        </View>
        <View style={row}>
          <Button title={t('addMeasure')} variant="secondary" disabled={Boolean(position) || score.measures.length >= SCORE_MAX_MEASURES} onPress={() => {
            updateScore({ ...score, measures: [...score.measures, []] }); changeMeasure(score.measures.length)
          }} />
          <Button title={t('deleteMeasure')} variant="secondary" disabled={Boolean(position) || score.measures.length < 2 || notes.length > 0} onPress={() => {
            updateScore({ ...score, measures: score.measures.filter((_, index) => index !== measure) }); changeMeasure(Math.max(0, measure - 1))
          }} />
          <Button title={t('fill')} variant="secondary" disabled={Boolean(position) || ticks === capacity} onPress={() => { updateScore(fillScoreMeasure(score, measure)); setError('') }} />
        </View>
        <Text style={ink}>{t('pulses', { used: ticks / 8, total: capacity / 8 })}</Text>
        <ScrollView ref={staffScroll} horizontal scrollEventThrottle={16}
          onLayout={event => setStaffWidth(event.nativeEvent.layout.width)}
          onScroll={event => { scrollX.current = event.nativeEvent.contentOffset.x }}
          style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md }}>
          <View style={{ minWidth: 240, height: staff.height, paddingLeft: 48, flexDirection: 'row' }}>
            {staff.lines.map(y => <View key={y} style={{ ...line, left: 0, right: 0, top: y }} />)}
            <View style={{ ...line, right: 0, top: staff.lines[4], width: 1, height: staff.lines[0] - staff.lines[4] }} />
            <Text accessible={false} style={{ position: 'absolute', left: 6, top: score.clef === 'G' ? staff.lines[1] - 25 : staff.lines[3] - 13, fontSize: 30, ...ink }}>{score.clef === 'G' ? '𝄞' : '𝄢'}</Text>
            <View accessible={false} style={{ position: 'absolute', left: 30, top: staff.lines[4] + 7, alignItems: 'center', width: 17 }}>
              <Text style={{ ...ink, fontWeight: '700', lineHeight: 16 }}>{beats}</Text>
              <Text style={{ ...ink, fontWeight: '700', lineHeight: 16 }}>{beatUnit}</Text>
            </View>
            {notes.map((value, index) => {
              const { y, ledgers, stemDown, accidental } = staff.notes[index]
              const pitch = value.pitch ? `${value.pitch.step}${value.pitch.alter === 1 ? '♯' : value.pitch.alter === -1 ? '♭' : ''}${value.pitch.octave}` : t('rest')
              return <Pressable key={index} accessibilityRole="button" disabled={Boolean(position)}
                accessibilityState={{ selected: position ? sounding === index : selection === index, disabled: Boolean(position) }}
                accessibilityLabel={t('noteLabel', { index: index + 1, pitch, duration: t(`duration.${value.type}`), dot: value.dotted ? t('dot') : '' })}
                onPress={() => { setNote(value); setSelection(index); setError('') }}
                style={{ width: 44, height: staff.height, borderWidth: !position && selection === index ? 2 : 0,
                  borderColor: theme.colors.accent, borderLeftWidth: sounding === index ? 3 : undefined,
                  backgroundColor: sounding === index ? theme.colors.accentSoft : undefined }}>
                {ledgers.map(ledger => <View key={ledger} style={{ ...line, width: 21, left: 12, top: ledger }} />)}
                {value.pitch ? <>
                  {accidental ? <Text style={{ position: 'absolute', left: 4, top: y - 11, ...ink }}>{accidental}</Text> : null}
                  <View style={{ position: 'absolute', left: 17, top: y - 4, width: 11, height: 8, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.ink,
                    backgroundColor: ['whole', 'half'].includes(value.type) ? theme.colors.surfaceAlt : theme.colors.ink, transform: [{ rotate: '-18deg' }] }} />
                  {value.type !== 'whole' && <View style={{ ...line, width: 1, height: 26, left: stemDown ? 17 : 26, top: stemDown ? y : y - 25 }} />}
                  {Array.from({ length: flags[value.type] ?? 0 }, (_, flag) => <View key={flag}
                    style={{ ...line, width: 7, height: 2, left: stemDown ? 17 : 26,
                      top: stemDown ? y + 18 - 5 * flag : y - 25 + 5 * flag, transform: [{ rotate: stemDown ? '-25deg' : '25deg' }] }} />)}
                </> : <Text style={{ position: 'absolute', left: 12, top: y - 18, fontSize: 30, ...ink }}>{REST_SYMBOLS[value.type]}</Text>}
                {value.dotted && <View style={{ ...line, left: 32, top: y - 2, width: 4, height: 4, borderRadius: 2 }} />}
              </Pressable>
            })}
          </View>
        </ScrollView>
        <View style={row}>
          <Text style={ink}>{t('rest')}</Text>
          <Switch accessibilityLabel={t('rest')} value={!note.pitch} onValueChange={rest => setNote({ ...note, pitch: rest ? null : DEFAULT_SCORE_NOTE.pitch })} />
        </View>
        {note.pitch && <>
          <Text style={heading}>{t('pitch')}</Text>
          <View style={row}>{STEPS.map(step => <Chip key={step} label={step} selected={note.pitch?.step === step} onPress={() => setPitch({ step })} />)}</View>
          <View style={row}>
            <Text style={ink}>{t('alter')}</Text>
            {([-1, 0, 1] as const).map(alter => <Chip key={alter} label={alter === 0 ? '♮' : alter === 1 ? '♯' : '♭'} selected={note.pitch?.alter === alter} onPress={() => setPitch({ alter })} />)}
          </View>
          <View style={row}>
            <Text style={ink}>{t('octave')} {note.pitch.octave}</Text>
            <Button title="−" accessibilityLabel={t('lowerOctave')} variant="secondary" disabled={note.pitch.octave <= 2} onPress={() => setPitch({ octave: note.pitch!.octave - 1 })} />
            <Button title="+" accessibilityLabel={t('higherOctave')} variant="secondary" disabled={note.pitch.octave >= 7} onPress={() => setPitch({ octave: note.pitch!.octave + 1 })} />
          </View>
        </>}
        <Text style={heading}>{t('value')}</Text>
        <View style={row}>{(Object.keys(DURATIONS) as ScoreDuration[]).map(type => <Chip key={type} label={t(`duration.${type}`)}
          selected={note.type === type} onPress={() => setNote({ ...note, type, dotted: type === '32nd' ? false : note.dotted })} />)}</View>
        <View style={row}>
          <Text style={ink}>{t('dot')}</Text>
          <Switch accessibilityLabel={t('dot')} disabled={note.type === '32nd'} value={note.dotted} onValueChange={dotted => setNote({ ...note, dotted })} />
        </View>
        <View style={row}>
          <Button title={t(selection === null ? 'add' : 'apply')} disabled={busy || Boolean(position)} onPress={() => apply(note)} />
          {selection !== null && <>
            <Button title={t('remove')} variant="secondary" disabled={busy || Boolean(position)} onPress={() => apply(null)} />
            <Button title={t('cancel')} variant="secondary" onPress={() => setSelection(null)} />
          </>}
        </View>
        {!complete && <Text style={{ color: theme.colors.sec }}>{t('incomplete')}</Text>}
      </>}
    </ScrollView>
  )
  if (embedded) return content
  return <Screen edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ headerShown: true, title: t('title') }} />
    {content}
  </Screen>
}
