import React, { forwardRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

// Glow button (ported): a dark pill with a soft halo that brightens on hover
// and flashes on press. Used for the store's Add to cart.
export const GlowButton = forwardRef<HTMLButtonElement, {
  label?: string
  onClick?: () => void
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}>(({ label = 'Add to cart', onClick, className, disabled, type = 'button' }, ref) => {
  const [isClicked, setIsClicked] = useState(false)

  const handleClick = () => {
    setIsClicked(true)
    setTimeout(() => setIsClicked(false), 200)
    onClick?.()
  }

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn('glow-btn', className)}
      onClick={handleClick}
      disabled={disabled}
      data-state={isClicked ? 'clicked' : undefined}
    >
      <span className="flex items-center justify-center gap-1.5">
        {label}
        <Sparkles size={16} className="ml-0.5" />
      </span>
    </button>
  )
})

GlowButton.displayName = 'GlowButton'
