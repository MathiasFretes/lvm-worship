import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LvmSongPicker from '../LvmSongPicker'

function renderPicker(overrides = {}) {
  const onRetrySongs = vi.fn()
  render(<LvmSongPicker
    catalog={{ groups: [], translationLanguages: [] }}
    songsLoading={false}
    songsError={null}
    onRetrySongs={onRetrySongs}
    query=""
    onQuery={vi.fn()}
    communityOnly={false}
    onCommunityOnly={vi.fn()}
    language="en"
    onLanguage={vi.fn()}
    selectedIds={new Set()}
    onAdd={vi.fn()}
    {...overrides}
  />)
  return { onRetrySongs }
}

describe('LVM song picker', () => {
  it('distinguishes an empty catalog from loading and failure', async () => {
    const user = userEvent.setup()
    const { onRetrySongs } = renderPicker({ songsError: new Error('offline') })
    expect(screen.getByRole('alert')).toHaveTextContent('Songs could not be loaded')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetrySongs).toHaveBeenCalledOnce()
  })
})
