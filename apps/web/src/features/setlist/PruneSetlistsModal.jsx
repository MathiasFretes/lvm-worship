import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { timeAgo } from '@lavozmisionera/core'
import { Button } from '../../components/ui/layout-kit'
import { songCountLabel } from './songCountLabel'

// Shown when the per-role cap is reached instead of letting a create fail at
// the DB trigger. Oldest first, because the set you are least likely to want is
// the one you edited longest ago.
export default function PruneSetlistsModal({ open, setlists, limit, busy, onClose, onDelete }) {
  const { t } = useTranslation(['pages', 'common'])
  const [selected, setSelected] = useState(() => new Set())

  if (!open) return null

  const oldestFirst = [...setlists].sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="lvm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lvm-prune-title">
      <div className="lvm-modal lvm-prune-modal">
        <h2 id="lvm-prune-title">{t('setlist.manageTitle')}</h2>
        <p className="lvm-modal-note">
          {t('setlist.manageDesc', { count: setlists.length, limit })}
        </p>

        <div className="lvm-prune-list">
          {oldestFirst.map((s) => {
            const edited = timeAgo(s.updated_at, (k, o) => t(`common:${k}`, o))
            return (
              <label key={s.id} className="lvm-prune-row">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span className="lvm-prune-name">{s.name}</span>
                <span className="lvm-prune-meta">
                  {songCountLabel(t, s.songCount)}
                  {edited ? ` · ${edited}` : ''}
                </span>
              </label>
            )
          })}
        </div>

        <div className="lvm-modal-actions lvm-prune-actions">
          <span className="lvm-modal-note">
            {t('setlist.manageSelectedCount', { count: selected.size })}
          </span>
          <div className="lvm-modal-buttons">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t('setlist.cancel')}
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              disabled={selected.size === 0}
              onClick={() => onDelete([...selected])}
            >
              {t('setlist.deleteSelected')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
