import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Toolbar } from '../ui/layout-kit'

export default function SongMaterialLinks({ current, title }) {
  const [params] = useSearchParams()
  const { t } = useTranslation('pages')
  if (!params.get('song')) return null
  const query = new URLSearchParams()
  for (const key of ['song', 'title', 'slug', 'personal']) if (params.has(key)) query.set(key, params.get(key))
  const slug = params.get('slug')
  const song = slug ? `/songs/${encodeURIComponent(slug)}${params.get('personal') === '1' ? `?p=${encodeURIComponent(params.get('song'))}` : ''}` : '/songs'
  return <>
    {title && <p>{title}</p>}
    <Toolbar>
      <Button as={Link} to={song}>{t('mixer.backToSong')}</Button>
      {['tablature', 'score', 'mixer'].map(kind => <Button key={kind} as={Link} to={`/${kind}?${query}`}
        aria-current={current === kind ? 'page' : undefined} variant={current === kind ? 'primary' : 'ghost'}>
        {t(`${kind}.${kind === 'mixer' ? 'songAudio' : 'title'}`)}
      </Button>)}
    </Toolbar>
  </>
}
