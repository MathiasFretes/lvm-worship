import React, { useEffect, useRef } from 'react'

export default function MobileActionSheet({
  open = false,
  onClose,
  title = 'More',
  children,
  className = '',
  closeLabel = 'Done',
}){
  const dialog = useRef(null)
  const done = useRef(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const element = dialog.current
    if (element?.showModal) element.showModal()
    else element?.setAttribute('open', '')
    done.current?.focus()
    return () => { element?.close?.(); previous?.focus?.() }
  }, [open])
  if (!open) return null

  return (
    <dialog ref={dialog} className={`lvm-mobile-actionsheet ${className}`.trim()} aria-label={title} onCancel={event => { event.preventDefault(); onClose?.() }}>
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
          <button ref={done} type="button" className="lvm-btn lvm-btn--sm" onClick={onClose}>{closeLabel}</button>
        </div>
        <div className="lvm-mobile-actionsheet__body">
          {children}
        </div>
      </div>
    </dialog>
  )
}
