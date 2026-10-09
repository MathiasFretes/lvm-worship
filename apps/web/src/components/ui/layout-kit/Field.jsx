import React, { useId } from 'react'

export default function Field({
  label,
  help,
  error,
  id,
  className = '',
  children,
  ...rest
}){
  const uid = useId()
  const inputId = id || `lvm-field-${uid}`
  const helpId = help ? `${inputId}-help` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  let control = children
  if (React.isValidElement(children)) {
    control = React.cloneElement(children, {
      id: children.props.id || inputId,
      'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : children.props['aria-invalid'],
    })
  }

  return (
    <label className={`lvm-field ${className}`.trim()} htmlFor={inputId} {...rest}>
      {label ? <span className="lvm-field__label">{label}</span> : null}
      <div className="lvm-field__control">{control}</div>
      {help ? <div className="lvm-field__help" id={helpId}>{help}</div> : null}
      {error ? <div className="lvm-field__error" id={errorId}>{error}</div> : null}
    </label>
  )
}
