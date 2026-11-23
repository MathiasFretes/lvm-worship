import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LivePreviewModal from '../LivePreviewModal'

describe('editor chord preview', () => {
  it('places chords above the following lyric instead of the previous segment', () => {
    render(<LivePreviewModal content={'[G]Hoy cantamos [D]en comunidad.'} metadata={{ title: 'Prueba' }} onClose={() => {}} />)
    const columns = screen.getByRole('dialog').querySelectorAll('.lvm-preview-modal__chord-col')
    expect(columns).toHaveLength(2)
    expect(columns[0].querySelector('.lvm-preview-modal__chord')).toHaveTextContent('G')
    expect(columns[0].querySelector('.lvm-preview-modal__lyric').textContent).toBe('Hoy cantamos ')
    expect(columns[1].querySelector('.lvm-preview-modal__chord')).toHaveTextContent('D')
    expect(columns[1].querySelector('.lvm-preview-modal__lyric')).toHaveTextContent('en comunidad.')
  })

  it('retains unchorded lead-in text and a trailing chord', () => {
    render(<LivePreviewModal content={'Juntos [C]cantamos [G]'} onClose={() => {}} />)
    const columns = screen.getByRole('dialog').querySelectorAll('.lvm-preview-modal__chord-col')
    expect(columns).toHaveLength(3)
    expect(columns[0].querySelector('.lvm-preview-modal__lyric').textContent).toBe('Juntos ')
    expect(columns[1].querySelector('.lvm-preview-modal__lyric').textContent).toBe('cantamos ')
    expect(columns[2].querySelector('.lvm-preview-modal__chord')).toHaveTextContent('G')
  })
})
