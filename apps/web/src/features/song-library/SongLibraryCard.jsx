import React from 'react'
import { Link } from 'react-router-dom'
import { filterDisplayTags } from '../../utils/songs/tags'
import './song-library.css'

export const SongLibraryCard = React.forwardRef(function SongLibraryCard({ song, active, personalLabel, ...props }, ref) {
  const tags = filterDisplayTags(song.tags || [])
  return (
    <Link
      {...props}
      ref={ref}
      to={song.to || `/song/${song.id}`}
      className={`lvm-song-library-card${active ? ' is-active' : ''}`}
    >
      <span className="lvm-song-library-card__body">
        <strong>{song.title}</strong>
        <span className="lvm-song-library-card__meta">
          {song.originalKey || '—'}{tags.length ? ` · ${tags.join(', ')}` : ''}
        </span>
      </span>
      {song.isPersonal ? (
        <span className="lvm-song-library-card__badge">
          {personalLabel}
        </span>
      ) : null}
    </Link>
  )
})
