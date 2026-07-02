import { useEffect, useRef, useState } from 'react'

interface Props {
  endsAt: number
  totalSeconds: number
  onExtend: (seconds: number) => void
  onClose: () => void
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    // audio not available; vibration/notification still fire
  }
}

function notifyRestOver() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification('Rest over 💪', { body: 'Time for your next set.' }))
      .catch(() => {})
  } catch {
    // notifications unsupported in this context
  }
}

export default function RestTimer({ endsAt, totalSeconds, onExtend, onClose }: Props) {
  const [now, setNow] = useState(Date.now())
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
  }, [endsAt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remainingMs = endsAt - now
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000))

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true
      navigator.vibrate?.([200, 100, 200])
      beep()
      notifyRestOver()
      const id = setTimeout(onClose, 8000)
      return () => clearTimeout(id)
    }
  }, [remainingMs, onClose])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const frac = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0

  return (
    <div className="rest-timer">
      <div className="row-between">
        <div>
          <div className="muted small">{remaining > 0 ? 'Rest' : 'Rest over — go!'}</div>
          <div className="rest-time">
            {mins}:{String(secs).padStart(2, '0')}
          </div>
        </div>
        <div className="row">
          <button className="btn-ghost" onClick={() => onExtend(30)}>
            +30s
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Skip
          </button>
        </div>
      </div>
      <div className="rest-bar">
        <div className="rest-bar-fill" style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}
