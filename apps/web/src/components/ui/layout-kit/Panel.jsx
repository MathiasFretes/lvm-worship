import React from 'react'

export default function Panel({ title, open = false, onToggle, children }){
  return (
    <div className="lvm-panel">
      <div className="lvm-panel__header" onClick={onToggle} role="button" aria-expanded={open}>
        <strong>{title}</strong>
        <span aria-hidden>{open ? '–' : '+'}</span>
      </div>
      <div className={['lvm-panel__content', open ? 'open' : ''].filter(Boolean).join(' ')}>
        <div style={{ padding: '10px 12px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
