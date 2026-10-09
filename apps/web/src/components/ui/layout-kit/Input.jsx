import React from 'react'

const Input = React.forwardRef(function InputImpl({ label, id, className = '', ...rest }, ref){
  return (
    <label className="lvm-field" htmlFor={id}>
      {label ? <span className="lvm-label">{label}</span> : null}
      <input ref={ref} id={id} className={`lvm-input ${className}`.trim()} {...rest} />
    </label>
  )
})

export default Input
