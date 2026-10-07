import React from 'react'

export default function MobileActionSheet({
  open = false,
  onClose,
  title = 'More',
  children,
  className = '',
}){
  if (!open) return null

  return (
    <div className={`lvm-mobile-actionsheet ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="lvm-mobile-actionsheet__overlay"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="lvm-mobile-actionsheet__panel">
        <div className="lvm-mobile-actionsheet__grab" aria-hidden />
        <div className="lvm-mobile-actionsheet__head">
          <strong className="lvm-mobile-actionsheet__title">{title}</strong>
          <button type="button" className="lvm-btn lvm-btn--sm" onClick={onClose}>Done</button>
        </div>
        <div className="lvm-mobile-actionsheet__body">
          {children}
        </div>
      </div>
    </div>
  )
}
