// Clic de caja fuerte sintetizado: golpe metálico corto; cada decena, un "clonc" más grave.
let ctx: AudioContext | null = null
let lastClick = 0

/** Los navegadores solo dejan sonar audio tras un toque del usuario. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    ctx = null
  }
}

export function safeClick(notch: boolean): void {
  if (!ctx) return
  const t = ctx.currentTime
  if (t - lastClick < 0.012) return
  lastClick = t
  if (notch) notchClonk(ctx, t)
  else ratchetTick(ctx, t)
}

/** Ráfaga de ruido que decae rápido: la base de cualquier golpe mecánico. */
function burst(c: AudioContext, seconds: number, sharpness: number): AudioBufferSourceNode {
  const length = Math.floor(c.sampleRate * seconds)
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, sharpness)
  const source = c.createBufferSource()
  source.buffer = buffer
  return source
}

/** Clic de trinquete de un dial de caja fuerte: seco, con cuerpo y un leve timbre metálico. */
function ratchetTick(c: AudioContext, t: number): void {
  const vary = 0.85 + Math.random() * 0.3
  const out = c.createGain()
  out.gain.value = 0.9 * vary
  out.connect(c.destination)

  // Golpe seco del diente contra el trinquete.
  const hit = burst(c, 0.006, 10)
  const high = c.createBiquadFilter()
  const low = c.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 900
  low.type = 'lowpass'
  low.frequency.value = 5200 * vary
  const hitGain = c.createGain()
  hitGain.gain.value = 0.7
  hit.connect(high).connect(low).connect(hitGain).connect(out)
  hit.start(t)

  // Cuerpo: la puerta de acero resonando un instante.
  const body = c.createOscillator()
  const bodyGain = c.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(260 * vary, t)
  body.frequency.exponentialRampToValueAtTime(140, t + 0.03)
  bodyGain.gain.setValueAtTime(0.18, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
  body.connect(bodyGain).connect(out)
  body.start(t)
  body.stop(t + 0.04)

  // Timbre metálico muy corto.
  const ring = c.createOscillator()
  const ringGain = c.createGain()
  ring.type = 'triangle'
  ring.frequency.value = 3300 * vary
  ringGain.gain.setValueAtTime(0.025, t)
  ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)
  ring.connect(ringGain).connect(out)
  ring.start(t)
  ring.stop(t + 0.02)
}

/** "Clonc" de cada 10 tickets, el de siempre. */
function notchClonk(c: AudioContext, t: number): void {
  const noise = burst(c, 0.012, 3)
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  filter.type = 'bandpass'
  filter.frequency.value = 1400
  filter.Q.value = 4
  gain.gain.value = 1
  noise.connect(filter).connect(gain).connect(c.destination)
  noise.start(t)

  const tone = c.createOscillator()
  const toneGain = c.createGain()
  tone.type = 'triangle'
  tone.frequency.value = 520
  toneGain.gain.setValueAtTime(0.25, t)
  toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  tone.connect(toneGain).connect(c.destination)
  tone.start(t)
  tone.stop(t + 0.1)
}

/** "Cha-ching" de caja registradora para las partidas grandes. */
export function cashRegister(): void {
  if (!ctx) return
  const t = ctx.currentTime
  ;[
    [1318, 0],
    [1760, 0.09],
    [2637, 0.18],
  ].forEach(([freq, delay]) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(0.22, t + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.45)
    o.connect(g).connect(ctx!.destination)
    o.start(t + delay)
    o.stop(t + delay + 0.5)
  })
}
