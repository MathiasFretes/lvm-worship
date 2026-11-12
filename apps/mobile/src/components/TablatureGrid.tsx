import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { appendTabMeasure, getTabMeasure, getTabSystems, replaceTabFret } from '@lavozmisionera/core/music/tablature'
import type { TabPlaybackPosition } from '@lavozmisionera/core/music/tablaturePlayback'
import Button from './Button'
import { useTheme } from '../theme/ThemeProvider'

export default function TablatureGrid({ source, onChange, position }: {
  source: string; onChange: (source: string) => void; position: TabPlaybackPosition | null
}) {
  const theme = useTheme()
  const { t } = useTranslation('utilities')
  const [systemIndex, setSystemIndex] = useState(0)
  const [measureIndex, setMeasureIndex] = useState(0)
  const [selection, setSelection] = useState<{ row: number; offset: number } | null>(null)
  const [fret, setFret] = useState('')
  const [error, setError] = useState(false)
  const [appendError, setAppendError] = useState(false)
  const scroll = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const scrollX = useRef(0)
  const systems = useMemo(() => getTabSystems(source), [source])
  const activeSystem = Math.min(position?.system ?? systemIndex, systems.length - 1)
  const system = systems[activeSystem]
  const measureCount = Math.max(...system.map(row => row.measures.length))
  const activeMeasure = Math.min(position?.measure ?? measureIndex, measureCount - 1)
  const rows = useMemo(() => getTabMeasure(system, activeMeasure), [system, activeMeasure])
  const cell = !position && selection ? rows[selection.row]?.cells?.find(candidate => candidate.offset === selection.offset) : null
  const actions = { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm } as const
  const ink = { color: theme.colors.ink }

  useEffect(() => {
    if (!position || !width) return
    const x = 44 + position.column * 44
    if (x < scrollX.current || x + 44 > scrollX.current + width) {
      scroll.current?.scrollTo({ x, animated: false })
    }
  }, [position, width])

  function selectMeasure(system: number, measure: number) {
    setSystemIndex(system)
    setMeasureIndex(measure)
    setSelection(null)
    setError(false)
    setAppendError(false)
  }

  function apply(value: string) {
    if (!cell) return
    const next = replaceTabFret(source, cell, value)
    setError(next === null)
    if (next !== null) {
      setFret(value)
      onChange(next)
    }
  }

  function addMeasure() {
    const next = appendTabMeasure(source, system)
    if (next === null) {
      setAppendError(true)
      return
    }
    selectMeasure(systemIndex, measureCount)
    onChange(next)
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.rowTitle, ...ink }}>{t('tablature.grid')}</Text>
      <View style={actions}>
        <Text style={ink}>{t('tablature.system')} {activeSystem + 1}/{systems.length}</Text>
        <Button title="−" accessibilityLabel={t('tablature.previousSystem')} disabled={Boolean(position) || systemIndex === 0}
          variant="secondary" onPress={() => selectMeasure(systemIndex - 1, 0)} />
        <Button title="+" accessibilityLabel={t('tablature.nextSystem')} disabled={Boolean(position) || systemIndex + 1 === systems.length}
          variant="secondary" onPress={() => selectMeasure(systemIndex + 1, 0)} />
      </View>
      <View style={actions}>
        <Text style={ink}>{t('tablature.measure')} {activeMeasure + 1}/{measureCount}</Text>
        <Button title="−" accessibilityLabel={t('tablature.previousMeasure')} disabled={Boolean(position) || measureIndex === 0}
          variant="secondary" onPress={() => selectMeasure(systemIndex, measureIndex - 1)} />
        <Button title="+" accessibilityLabel={t('tablature.nextMeasure')} disabled={Boolean(position) || measureIndex + 1 === measureCount}
          variant="secondary" onPress={() => selectMeasure(systemIndex, measureIndex + 1)} />
        <Button title={t('tablature.addMeasure')} disabled={Boolean(position)} variant="secondary" onPress={addMeasure} />
      </View>
      {rows.some(row => !row.cells) ? <Text style={ink}>{t('tablature.gridLimit')}</Text> : (
        <ScrollView ref={scroll} horizontal keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
          onLayout={event => setWidth(event.nativeEvent.layout.width)}
          onScroll={event => { scrollX.current = event.nativeEvent.contentOffset.x }}
          style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md }}>
          <View>
            {rows.map(({ tuning, cells }, row) => (
              <View key={row} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border }}>
                <Text style={{ ...ink, width: 44, textAlign: 'center' }}>{tuning}</Text>
                {cells?.map(candidate => {
                  const selected = candidate.offset === cell?.offset
                  const start = candidate.offset - cells[0].offset
                  const sounding = Boolean(position && position.column >= start && position.column < start + candidate.text.length)
                  const style = {
                    width: 44 * candidate.text.length, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected || sounding ? theme.colors.accentSoft : 'transparent',
                    borderLeftWidth: sounding ? 2 : 0, borderLeftColor: theme.colors.ink,
                  } as const
                  const content = <Text style={{ ...ink, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{candidate.text}</Text>
                  return candidate.editable && !position ? (
                    <Pressable key={candidate.offset} accessibilityRole="button" accessibilityState={{ selected }}
                      accessibilityLabel={t('tablature.cell', { string: row + 1, tuning, position: candidate.offset - cells[0].offset + 1, note: candidate.text })}
                      style={style} onPress={() => {
                        setSelection({ row, offset: candidate.offset })
                        setFret(candidate.text === '-' ? '' : candidate.text)
                        setError(false)
                      }}>{content}</Pressable>
                  ) : <View key={candidate.offset} style={style}>{content}</View>
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {cell && <View style={actions}>
        <Text style={ink}>{t('tablature.fret')}</Text>
        <TextInput accessibilityLabel={t('tablature.fret')} keyboardType="number-pad" value={fret} maxLength={2}
          style={{ ...ink, minWidth: 56, minHeight: 44, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md }}
          onChangeText={value => { setFret(value); setError(false) }} />
        <Button title={t('tablature.applyFret')} disabled={!fret} onPress={() => apply(fret)} />
        <Button title={t('tablature.removeFret')} disabled={cell.text === '-'} variant="secondary" onPress={() => apply('')} />
      </View>}
      {error && <Text accessibilityLiveRegion="polite" style={ink}>{t('tablature.fretError')}</Text>}
      {appendError && <Text accessibilityLiveRegion="polite" style={ink}>{t('tablature.appendError')}</Text>}
    </View>
  )
}
