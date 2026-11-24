import { useTranslation } from 'react-i18next'
import React, { useEffect } from 'react'

// Parse a line that may contain inline [Chord] markers
function parseChordLine(line) {
  const segments = []
  const re = /\[([^\]]+)\]/g
  let lastIndex = 0
  let chord = null
  let match

  while ((match = re.exec(line)) !== null) {
    const lyric = line.slice(lastIndex, match.index)
    if (lyric || chord) segments.push({ chord, lyric })
    chord = match[1]
    lastIndex = re.lastIndex
  }
  const remaining = line.slice(lastIndex)
  if (remaining || chord || segments.length === 0) segments.push({ chord, lyric: remaining })
  return segments
}

function hasChords(line) {
  return /\[[^\]]+\]/.test(line)
}

function parseDirective(line) {
  const m = line.match(/^\{(start_of_\w+|end_of_\w+|[^}:]+)(?::\s*([^}]*))?\}/)
  if (!m) return null
  return { type: m[1].trim(), label: (m[2] || '').trim() }
}

function renderLine(line, idx) {
  if (!hasChords(line)) {
    return (
      <div key={idx} className="lvm-preview-modal__line">
        <span className="lvm-preview-modal__lyric">{line || '\u00A0'}</span>
      </div>
    )
  }
  const segments = parseChordLine(line)
  return (
    <div key={idx} className="lvm-preview-modal__line lvm-preview-modal__chord-row">
      {segments.map((seg, si) => (
        <span key={si} className="lvm-preview-modal__chord-col">
          <span className="lvm-preview-modal__chord">{seg.chord || ' '}</span>
          <span className="lvm-preview-modal__lyric">{seg.lyric || ' '}</span>
        </span>
      ))}
    </div>
  )
}

export default function LivePreviewModal({ content, metadata, onClose }) {
  const { t } = useTranslation('songEditor')
  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lvm-preview-modal" role="dialog" aria-modal="true" aria-label={t('previewTitle')}>
      <div className="lvm-preview-modal__backdrop" onClick={onClose} />
      <div className="lvm-preview-modal__panel">
        <div className="lvm-preview-modal__header">
          <div>
            {metadata?.title && <h2 className="lvm-preview-modal__title">{metadata.title}</h2>}
            {metadata?.currentKey && (
              <span className="lvm-preview-modal__key">{t('previewKey')} {metadata.currentKey}</span>
            )}
          </div>
          <button
            type="button"
            className="lvm-preview-modal__close"
            onClick={onClose}
            aria-label={t('closePreview')}
          >
            ✕
          </button>
        </div>

        <div className="lvm-preview-modal__body">
          {(content || '').split('\n').map((line, idx) => {
            const trimmed = line.trim()
            const directive = parseDirective(trimmed)

            if (directive) {
              if (directive.type.startsWith('start_of_')) {
                const name = directive.label || directive.type.replace('start_of_', '').replace(/_/g, ' ')
                return (
                  <div key={idx} className="lvm-preview-modal__section-header">
                    {name}
                  </div>
                )
              }
              return null
            }

            return renderLine(line, idx)
          })}
        </div>
      </div>
    </div>
  )
}
