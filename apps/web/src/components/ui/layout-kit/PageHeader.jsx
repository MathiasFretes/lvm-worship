import React from 'react'

export default function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
  children,
  ...rest
}){
  return (
    <header className={`lvm-page-header ${className}`.trim()} {...rest}>
      <div className="lvm-page-header__main">
        <div className="lvm-page-header__text">
          {title ? <h1 className="lvm-page-header__title">{title}</h1> : null}
          {subtitle ? <p className="lvm-page-header__subtitle">{subtitle}</p> : null}
          {children}
        </div>
        {actions ? <div className="lvm-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  )
}
