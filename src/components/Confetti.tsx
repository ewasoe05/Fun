import { useEffect, useRef } from 'react'

const COLORS = ['#3987e5', '#eda100', '#e34948', '#1baf7a', '#e87ba4', '#ffffff']
const DURATION = 1500

/** Brief celebratory particle burst; removes itself when done. */
export default function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const particles = Array.from({ length: 60 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 10 - 4,
      size: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }))
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const fade = 1 - elapsed / DURATION
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, fade)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        ctx.restore()
      }
      if (elapsed < DURATION) raf = requestAnimationFrame(tick)
      else onDone()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90 }}
      aria-hidden
    />
  )
}
