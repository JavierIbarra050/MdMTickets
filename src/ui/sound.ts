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

  const length = Math.floor(ctx.sampleRate * 0.012)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, notch ? 3 : 6)

  const noise = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  noise.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = notch ? 1400 : 3200
  filter.Q.value = notch ? 4 : 8
  gain.gain.value = notch ? 1 : 0.55
  noise.connect(filter).connect(gain).connect(ctx.destination)
  noise.start(t)

  const tone = ctx.createOscillator()
  const toneGain = ctx.createGain()
  tone.type = 'triangle'
  tone.frequency.value = notch ? 520 : 1900
  toneGain.gain.setValueAtTime(notch ? 0.25 : 0.08, t)
  toneGain.gain.exponentialRampToValueAtTime(0.001, t + (notch ? 0.09 : 0.03))
  tone.connect(toneGain).connect(ctx.destination)
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
