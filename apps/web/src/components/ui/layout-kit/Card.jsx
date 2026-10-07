import React from 'react'

export function Card({
  as: Component = 'div',
  className = '',
  children,
  ...rest
}){
  return (
    <Component className={`lvm-card ${className}`.trim()} {...rest}>
      {children}
    </Component>
  )
}

export function InsetCard({
  as: Component = 'div',
  className = '',
  children,
  ...rest
}){
  return (
    <Component className={`lvm-inset-card ${className}`.trim()} {...rest}>
      {children}
    </Component>
  )
}

export const SongCard = React.forwardRef(function SongCard({
  title,
  subtitle,
  tags = [],
  leftSlot,
  rightSlot,
  onClick,
  className = '',
  as: Component = 'div',
  to,
  ...rest
}, ref){
  const props = { className: `lvm-card lvm-song-card ${className}`.trim(), onClick, ref, ...rest }
  if (to) props.to = to
  return (
    <Component {...props}>
      {leftSlot}
      <div className="lvm-card__body">
        <div className="lvm-card__title">{title}</div>
        {subtitle ? <div className="lvm-card__meta">{subtitle}</div> : null}
        {tags.length ? (
          <div className="lvm-card__tags">
            {tags.map((t) => (
              <span key={t} className="lvm-tag lvm-tag--gray">{t}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="lvm-card__spacer" />
      {rightSlot}
    </Component>
  )
})

export default Card
