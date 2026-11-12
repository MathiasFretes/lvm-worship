import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appendTabMeasure, getTabMeasure, getTabSystems, replaceTabFret } from '@lavozmisionera/core/music/tablature'
import { Button } from '../../components/ui/layout-kit'

export default function TablatureGrid({ source, onChange, position }) {
  const { t } = useTranslation('pages', { keyPrefix: 'tablature' })
  const [systemIndex, setSystemIndex] = useState(0)
  const [measureIndex, setMeasureIndex] = useState(0)
  const [selection, setSelection] = useState(null)
  const [fret, setFret] = useState('')
  const [error, setError] = useState(false)
  const [appendError, setAppendError] = useState(false)
  const scrollRef = useRef(null)
  const activeSystem = position?.system ?? systemIndex
  const systems = useMemo(() => getTabSystems(source), [source])
  const system = systems[Math.min(activeSystem, systems.length - 1)]
  const measureCount = Math.max(...system.map(row => row.measures.length))
  const activeMeasure = Math.min(position?.measure ?? measureIndex, measureCount - 1)
  const rows = useMemo(() => getTabMeasure(system, activeMeasure), [system, activeMeasure])
  const cell = !position && selection ? rows[selection.row]?.cells?.find(candidate => candidate.offset === selection.offset) : null

  useEffect(() => {
    const scroll = scrollRef.current
    if (!position || !scroll) return
    const indicator = scroll.querySelector('[data-sounding="true"]')
    if (!indicator) return
    const windowBounds = scroll.getBoundingClientRect()
    const noteBounds = indicator.getBoundingClientRect()
    if (noteBounds.right > windowBounds.right || noteBounds.left < windowBounds.left + 48) {
      scroll.scrollLeft += noteBounds.left - windowBounds.left - 48
    }
  }, [position])

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
        <label>{t('system')} <select disabled={Boolean(position)} value={Math.min(activeSystem, systems.length - 1)}
          onChange={event => { setSystemIndex(Number(event.target.value)); setMeasureIndex(0); setSelection(null); setError(false); setAppendError(false) }}>
          {systems.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <label>{t('measure')} <select disabled={Boolean(position)} value={activeMeasure}
          onChange={event => { setMeasureIndex(Number(event.target.value)); setSelection(null); setError(false) }}>
          {Array.from({ length: measureCount }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <Button disabled={Boolean(position)} onClick={addMeasure}>{t('addMeasure')}</Button>
      </div>
      {rows.some(row => !row.cells) ? <p>{t('gridLimit')}</p> : (
        <div className="lvm-tablature__strings" ref={scrollRef}>
          {rows.map(({ tuning, cells }, row) => (
            <div className="lvm-tablature__string" key={row}>
              <span className="lvm-tablature__tuning">{tuning}</span>
              {cells.map(candidate => {
                const start = candidate.offset - cells[0].offset
                const sounding = position && position.column >= start && position.column < start + candidate.text.length
                return candidate.editable && !position ? (
                <button key={candidate.offset} type="button" className="lvm-tablature__cell"
                  style={{ '--tab-width': candidate.text.length }}
                  aria-label={t('cell', { string: row + 1, tuning, position: candidate.offset - cells[0].offset + 1, note: candidate.text })}
                  aria-pressed={candidate.offset === cell?.offset}
                  onClick={() => {
                    setSelection({ row, offset: candidate.offset })
                    setFret(candidate.text === '-' ? '' : candidate.text)
                    setError(false)
                  }}>{candidate.text}</button>
                ) : <span key={candidate.offset} data-sounding={sounding || undefined} className="lvm-tablature__cell"
                  style={{ '--tab-width': candidate.text.length }}>{candidate.text}</span>
              })}
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
