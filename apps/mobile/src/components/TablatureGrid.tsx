import { useState } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { appendTabMeasure, getTabMeasure, getTabSystems, replaceTabFret } from '@lavozmisionera/core/music/tablature'
import Button from './Button'
import { useTheme } from '../theme/ThemeProvider'

export default function TablatureGrid({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  const theme = useTheme()
  const { t } = useTranslation('utilities')
  const [systemIndex, setSystemIndex] = useState(0)
  const [measureIndex, setMeasureIndex] = useState(0)
  const [selection, setSelection] = useState<{ row: number; offset: number } | null>(null)
  const [fret, setFret] = useState('')
  const [error, setError] = useState(false)
  const [appendError, setAppendError] = useState(false)
  const systems = getTabSystems(source)
  const system = systems[systemIndex]
  const measureCount = Math.max(...system.map(row => row.measures.length))
  const rows = getTabMeasure(system, measureIndex)
  const cell = selection && rows[selection.row]?.cells?.find(candidate => candidate.offset === selection.offset)
  const actions = { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.sm } as const
  const ink = { color: theme.colors.ink }

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
        <Text style={ink}>{t('tablature.system')} {systemIndex + 1}/{systems.length}</Text>
        <Button title="−" accessibilityLabel={t('tablature.previousSystem')} disabled={systemIndex === 0}
          variant="secondary" onPress={() => selectMeasure(systemIndex - 1, 0)} />
        <Button title="+" accessibilityLabel={t('tablature.nextSystem')} disabled={systemIndex + 1 === systems.length}
          variant="secondary" onPress={() => selectMeasure(systemIndex + 1, 0)} />
      </View>
      <View style={actions}>
        <Text style={ink}>{t('tablature.measure')} {measureIndex + 1}/{measureCount}</Text>
        <Button title="−" accessibilityLabel={t('tablature.previousMeasure')} disabled={measureIndex === 0}
          variant="secondary" onPress={() => selectMeasure(systemIndex, measureIndex - 1)} />
        <Button title="+" accessibilityLabel={t('tablature.nextMeasure')} disabled={measureIndex + 1 === measureCount}
          variant="secondary" onPress={() => selectMeasure(systemIndex, measureIndex + 1)} />
        <Button title={t('tablature.addMeasure')} variant="secondary" onPress={addMeasure} />
      </View>
      {rows.some(row => !row.cells) ? <Text style={ink}>{t('tablature.gridLimit')}</Text> : (
        <ScrollView horizontal keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md }}>
          <View>
            {rows.map(({ tuning, cells }, row) => (
              <View key={row} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border }}>
                <Text style={{ ...ink, width: 44, textAlign: 'center' }}>{tuning}</Text>
                {cells?.map(candidate => {
                  const selected = candidate.offset === cell?.offset
                  const style = {
                    width: 44 * candidate.text.length, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? theme.colors.accentSoft : 'transparent',
                  } as const
                  const content = <Text style={{ ...ink, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{candidate.text}</Text>
                  return candidate.editable ? (
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
