import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function ChordProGuideDrawer({ open, onClose }) {
  const { t } = useTranslation('songEditor')
  useEffect(() => {
    if (!open) return
    function onKey(event) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {open && <div className="lvm-guide-drawer__backdrop" onClick={onClose} aria-hidden="true" />}
      <div className={`lvm-guide-drawer${open ? ' lvm-guide-drawer--open' : ''}`} role="dialog" aria-modal="true" aria-label={t('guide')} aria-hidden={!open}>
        <div className="lvm-guide-drawer__header">
          <h2 className="lvm-guide-drawer__title">{t('guide')}</h2>
          <button type="button" className="lvm-guide-drawer__close" onClick={onClose} aria-label={t('closeGuide')}>✕</button>
        </div>
        <div className="lvm-guide-drawer__body">
          {['guideInline', 'guideSections', 'guideMetadata', 'guideSyntax'].map(section => (
            <section key={section} className="lvm-guide-drawer__section">
              <h3 className="lvm-guide-drawer__section-title">{t(section)}</h3>
              <p className="lvm-guide-drawer__text">{t(`${section}Text`)}</p>
              {['guideInline', 'guideSections'].includes(section) && <pre className="lvm-guide-drawer__code">{t(`${section}Example`)}</pre>}
            </section>
          ))}
          <section className="lvm-guide-drawer__section">
            <h3 className="lvm-guide-drawer__section-title">{t('guideAvailable')}</h3>
            <code>verse, chorus, bridge, pre_chorus, intro, outro, tag, interlude</code>
          </section>
        </div>
      </div>
    </>
  )
}
