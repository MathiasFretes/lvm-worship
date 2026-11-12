import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appendTabMeasure, getTabMeasure, getTabSystems, replaceTabFret } from '@lavozmisionera/core/music/tablature'
import { Button } from '../../components/ui/layout-kit'

export default function TablatureGrid({ source, onChange }) {
  const { t } = useTranslation('pages', { keyPrefix: 'tablature' })
  const [systemIndex, setSystemIndex] = useState(0)
  const [measureIndex, setMeasureIndex] = useState(0)
  const [selection, setSelection] = useState(null)
  const [fret, setFret] = useState('')
  const [error, setError] = useState(false)
  const [appendError, setAppendError] = useState(false)
  const systems = getTabSystems(source)
  const system = systems[Math.min(systemIndex, systems.length - 1)]
  const measureCount = Math.max(...system.map(row => row.measures.length))
  const activeMeasure = Math.min(measureIndex, measureCount - 1)
  const rows = getTabMeasure(system, activeMeasure)
  const cell = selection && rows[selection.row]?.cells?.find(candidate => candidate.offset === selection.offset)

  function apply(value) {
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
    setAppendError(next === null)
    if (next === null) return
    setMeasureIndex(measureCount)
    setSelection(null)
    setError(false)
    onChange(next)
  }

  return (
    <div className="lvm-tablature__grid">
      <div className="lvm-tablature__actions">
        <label>{t('system')} <select value={Math.min(systemIndex, systems.length - 1)}
          onChange={event => { setSystemIndex(Number(event.target.value)); setMeasureIndex(0); setSelection(null); setError(false); setAppendError(false) }}>
          {systems.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <label>{t('measure')} <select value={activeMeasure}
          onChange={event => { setMeasureIndex(Number(event.target.value)); setSelection(null); setError(false) }}>
          {Array.from({ length: measureCount }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <Button onClick={addMeasure}>{t('addMeasure')}</Button>
      </div>
      {rows.some(row => !row.cells) ? <p>{t('gridLimit')}</p> : (
        <div className="lvm-tablature__strings">
          {rows.map(({ tuning, cells }, row) => (
            <div className="lvm-tablature__string" key={row}>
              <span className="lvm-tablature__tuning">{tuning}</span>
              {cells.map(candidate => candidate.editable ? (
                <button key={candidate.offset} type="button" className="lvm-tablature__cell"
                  style={{ '--tab-width': candidate.text.length }}
                  aria-label={t('cell', { string: row + 1, tuning, position: candidate.offset - cells[0].offset + 1, note: candidate.text })}
                  aria-pressed={candidate.offset === cell?.offset}
                  onClick={() => {
                    setSelection({ row, offset: candidate.offset })
                    setFret(candidate.text === '-' ? '' : candidate.text)
                    setError(false)
                  }}>{candidate.text}</button>
              ) : <span key={candidate.offset} className="lvm-tablature__cell" style={{ '--tab-width': candidate.text.length }}>{candidate.text}</span>)}
            </div>
          ))}
        </div>
      )}
      {cell && <form className="lvm-tablature__actions" onSubmit={event => { event.preventDefault(); apply(fret) }}>
        <label>{t('fret')} <input value={fret} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required
          onChange={event => { setFret(event.target.value); setError(false) }} /></label>
        <Button type="submit" variant="primary">{t('applyFret')}</Button>
        <Button disabled={cell.text === '-'} onClick={() => apply('')}>{t('removeFret')}</Button>
      </form>}
      {error && <p role="alert">{t('fretError')}</p>}
      {appendError && <p role="alert">{t('appendError')}</p>}
    </div>
  )
}
