import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { songMaterialKey } from '@lavozmisionera/core/music/songMaterial'
import { EMPTY_SCORE } from '@lavozmisionera/core/music/score'
import ScorePage from './ScorePage'
import TablaturePage from '../tablature/TablaturePage'

function Navigation({ kind }) {
  const navigate = useNavigate()
  return <>
    <button onClick={() => navigate(`/${kind}?song=a%2Fb&title=Song+A&slug=song-a`)}>First song</button>
    <button onClick={() => navigate(`/${kind}?song=b&title=Song+B&slug=song-b`)}>Second song</button>
    <button onClick={() => navigate(`/${kind}`)}>General tool</button>
  </>
}

function open(kind) {
  return render(<HelmetProvider><MemoryRouter initialEntries={[`/${kind}?song=a%2Fb&title=Song+A&slug=song-a`]}>
    <Navigation kind={kind} /><Routes>
      <Route path="/tablature" element={<TablaturePage />} />
      <Route path="/score" element={<ScorePage />} />
    </Routes>
  </MemoryRouter></HelmetProvider>)
}

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); localStorage.clear() })

describe('song-linked musical material', () => {
  it('keeps two song tablatures and the existing general draft separate across route changes', async () => {
    localStorage.setItem(songMaterialKey('tablature'), 'General guitar idea')
    localStorage.setItem(songMaterialKey('tablature', 'b'), 'Second song idea')
    open('tablature')
    expect(screen.getByLabelText('Tablature text')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Tablature text'), { target: { value: 'First song idea' } })
    await waitFor(() => expect(localStorage.getItem(songMaterialKey('tablature', 'a/b'))).toBe('First song idea'))
    fireEvent.click(screen.getByRole('button', { name: 'Second song' }))
    expect(screen.getByLabelText('Tablature text')).toHaveValue('Second song idea')
    fireEvent.click(screen.getByRole('button', { name: 'First song' }))
    expect(screen.getByLabelText('Tablature text')).toHaveValue('First song idea')
    expect(screen.getByRole('link', { name: 'Score' })).toHaveAttribute('href', '/score?song=a%2Fb&title=Song+A&slug=song-a')
    fireEvent.click(screen.getByRole('link', { name: 'Score' }))
    expect(screen.getByLabelText('Score title')).toHaveValue('Song A')
  })

  it('restores each score without overwriting another song or the legacy general score', async () => {
    const general = JSON.stringify({ ...EMPTY_SCORE, title: 'General score' })
    localStorage.setItem(songMaterialKey('score'), general)
    localStorage.setItem(songMaterialKey('score', 'b'), JSON.stringify({ ...EMPTY_SCORE, title: 'Existing B' }))
    open('score')
    expect(screen.getByLabelText('Score title')).toHaveValue('Song A')
    fireEvent.change(screen.getByLabelText('Score title'), { target: { value: 'Arrangement A' } })
    await waitFor(() => expect(JSON.parse(localStorage.getItem(songMaterialKey('score', 'a/b'))).title).toBe('Arrangement A'))
    fireEvent.click(screen.getByRole('button', { name: 'Second song' }))
    expect(screen.getByLabelText('Score title')).toHaveValue('Existing B')
    fireEvent.click(screen.getByRole('button', { name: 'First song' }))
    expect(screen.getByLabelText('Score title')).toHaveValue('Arrangement A')
    fireEvent.click(screen.getByRole('button', { name: 'General tool' }))
    expect(screen.getByLabelText('Score title')).toHaveValue('General score')
    expect(localStorage.getItem(songMaterialKey('score'))).toBe(general)
    expect(songMaterialKey('score', 'a/b')).not.toBe(songMaterialKey('score', 'a%2Fb'))
  })
})
