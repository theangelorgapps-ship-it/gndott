import { liquidMetalFragmentShader, ShaderMount } from '@paper-design/shaders'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'

// Liquid-metal primary button (paper-design shader), tuned for HaloBox:
// full-width friendly, correct padding, dark chrome rim, click ripples.
interface LiquidMetalButtonProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  fullWidth?: boolean
}

export function LiquidMetalButton({ label, onClick, disabled = false, busy = false, fullWidth = true }: LiquidMetalButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const shaderRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shaderMount = useRef<any>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rippleId = useRef(0)

  useEffect(() => {
    const styleId = 'liquid-metal-button-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .lm-shader-host canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          inset: 0 !important;
          border-radius: 100px !important;
        }
        @keyframes lm-ripple {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }

    if (shaderRef.current && !disabled) {
      try {
        shaderMount.current?.destroy?.()
        shaderMount.current = new ShaderMount(
          shaderRef.current,
          liquidMetalFragmentShader,
          {
            u_repetition: 4, u_softness: 0.5, u_shiftRed: 0.3, u_shiftBlue: 0.3,
            u_distortion: 0, u_contour: 0, u_angle: 45, u_scale: 8, u_shape: 1,
            u_offsetX: 0.1, u_offsetY: -0.1,
          },
          undefined,
          0.6,
        )
      } catch { /* The dark rim below still reads as metal without the shader. */ }
    }
    return () => { shaderMount.current?.destroy?.(); shaderMount.current = null }
  }, [disabled])

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || busy) return
    shaderMount.current?.setSpeed?.(2.4)
    window.setTimeout(() => shaderMount.current?.setSpeed?.(isHovered ? 1 : 0.6), 300)
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const ripple = { x: event.clientX - rect.left, y: event.clientY - rect.top, id: rippleId.current++ }
      setRipples(prev => [...prev, ripple])
      window.setTimeout(() => setRipples(prev => prev.filter(r => r.id !== ripple.id)), 600)
    }
    onClick?.()
  }

  return (
    <div style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block', width: fullWidth ? '100%' : undefined }}>
      <div style={{ position: 'relative', width: '100%', height: 52, transformStyle: 'preserve-3d', transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        {/* chrome rim */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 100, zIndex: 10,
          boxShadow: isPressed
            ? '0 0 0 1px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)'
            : isHovered
              ? '0 0 0 1px rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.35)'
              : '0 0 0 1px rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.25s ease',
        }}>
          <div ref={shaderRef} className="lm-shader-host" style={{ borderRadius: 100, overflow: 'hidden', position: 'relative', width: '100%', height: '100%', opacity: disabled ? 0.4 : 1 }} />
        </div>
        {/* dark inner face */}
        <div style={{
          position: 'absolute', inset: 3, borderRadius: 100, zIndex: 20, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(24,24,24,0.55) 0%, rgba(0,0,0,0.65) 100%)',
          mixBlendMode: 'multiply',
        }} />
        {/* label */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', transform: 'translateZ(20px)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 650, letterSpacing: '0.01em', color: '#f5f5f5', textShadow: '0 1px 3px rgba(0,0,0,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '88%' }}>
            {busy ? 'Opening secure checkout…' : label}
          </span>
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          disabled={disabled || busy}
          onMouseEnter={() => { setIsHovered(true); shaderMount.current?.setSpeed?.(1) }}
          onMouseLeave={() => { setIsHovered(false); setIsPressed(false); shaderMount.current?.setSpeed?.(0.6) }}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 40, width: '100%', height: '100%',
            background: 'transparent', border: 'none', cursor: disabled || busy ? 'default' : 'pointer',
            outline: 'none', borderRadius: 100, overflow: 'hidden',
            transform: isPressed ? 'translateY(1px) scale(0.99)' : 'none',
            transition: 'transform 0.15s ease',
          }}
          aria-label={label}
          aria-busy={busy}
        >
          {ripples.map(ripple => (
            <span key={ripple.id} style={{
              position: 'absolute', left: ripple.x, top: ripple.y, width: 20, height: 20, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none', animation: 'lm-ripple 0.6s ease-out',
            }} />
          ))}
        </button>
      </div>
    </div>
  )
}
