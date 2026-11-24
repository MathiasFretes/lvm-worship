import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/layout-kit'
import { TrashIcon } from '../../components/Icons'
import { offlineSetlists, notifyOfflineSetlists, useOfflineSetlists } from '../../hooks/useOfflineSetlists'
import { showToast } from '../../utils/app/toast'

export default function OfflineSetlists() {
  const { t } = useTranslation('pages')
  const { ownerId, setlists, error } = useOfflineSetlists()
  if (!ownerId || (!error && !setlists.length)) return null
  return <section className="lvm-offline-sets" aria-label={t('setlist.savedOnDevice')}>
    <h2>{t('setlist.savedOnDevice')}</h2>
    {error ? <p role="alert">{t('mixer.restoreError')}</p> : <ul>
      {setlists.map(set => <li key={set.id}>
        <Link to={`/worship?offline=${encodeURIComponent(set.id)}`}>
          <strong>{set.name}</strong>
          <span>{new Date(set.savedAt).toLocaleString()}</span>
        </Link>
        <Button variant="secondary" size="sm" iconLeft={<TrashIcon />} onClick={async () => {
          try {
            await offlineSetlists.remove(ownerId, set.id)
            notifyOfflineSetlists()
          } catch { showToast(t('mixer.saveError')) }
        }} aria-label={`${t('mixer.deleteSaved')}: ${set.name}`}>
          {t('mixer.deleteSaved')}
        </Button>
      </li>)}
    </ul>}
  </section>
}
