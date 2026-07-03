import { useEffect, useRef, useState } from 'react'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/**
 * Live camera barcode scanner. Uses the native BarcodeDetector when the
 * browser has one, otherwise the zxing-wasm ponyfill (lazy-loaded).
 * Always offers manual code entry as a fallback.
 */
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function start() {
      try {
        const DetectorCtor =
          'BarcodeDetector' in globalThis
            ? (globalThis as any).BarcodeDetector
            : (await import('barcode-detector/ponyfill')).BarcodeDetector
        const detector = new DetectorCtor({ formats: FORMATS })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (stopped || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const scan = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const value = codes?.[0]?.rawValue
            if (value) {
              stopped = true
              onDetected(String(value))
              return
            }
          } catch {
            // detection can throw while the video warms up — keep trying
          }
          timer = setTimeout(scan, 250)
        }
        scan()
      } catch {
        setError('Camera not available — type the barcode number instead.')
      }
    }
    start()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>Scan barcode</strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {!error && (
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', borderRadius: 12, background: '#000', minHeight: 220 }}
            />
          )}
          {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
          <p className="muted small">Point the camera at the product barcode, or enter it manually:</p>
          <div className="row">
            <input
              inputMode="numeric"
              placeholder="e.g. 0894700010137"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={manual.replace(/\D/g, '').length < 6}
              onClick={() => onDetected(manual)}
            >
              Look up
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
