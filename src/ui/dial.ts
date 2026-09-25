import { safeClick, unlockAudio } from './sound'

/** Grados de giro por ticket: una vuelta completa son 100 tickets. */
const DEG_PER_TICKET = 3.6

export const dialHTML = (): string => `
<div class="dial" id="dial">
  <div class="ring" id="ring"><div class="rim"></div><div class="face">${Array.from(
    { length: 10 },
    (_, k) => `<span style="transform:rotate(${-k * 36}deg)"><em>${k * 10}</em></span>`,
  ).join('')}</div></div>
  <div class="gloss"></div>
  <div class="hub"><b id="tkv">0</b><small>tickets</small></div>
  <i class="mark"></i>
</div>
<p class="dial-hint">Gira la rueda · cada vuelta son 100</p>`

/** Conecta la rueda ya pintada. `onChange` recibe los tickets marcados; `set` la coloca sin sonar. */
export function bindDial(dial: HTMLElement, onChange: (tickets: number) => void): { set(tickets: number): void } {
  const ring = dial.querySelector<HTMLElement>('#ring')!
  let turned = 0
  let lastAngle: number | null = null
  let tickets = 0

  const angle = (e: PointerEvent): number => {
    const r = dial.getBoundingClientRect()
    return (Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180) / Math.PI
  }

  dial.onpointerdown = (e) => {
    dial.setPointerCapture(e.pointerId)
    lastAngle = angle(e)
    unlockAudio()
  }
  dial.onpointermove = (e) => {
    if (lastAngle === null) return
    const a = angle(e)
    let delta = a - lastAngle
    delta -= Math.round(delta / 360) * 360
    lastAngle = a
    turned = Math.max(0, turned + delta)
    ring.style.transform = `rotate(${turned}deg)`
    const value = Math.round(turned / DEG_PER_TICKET)
    if (value !== tickets) {
      tickets = value
      onChange(value)
      safeClick(value % 10 === 0)
      navigator.vibrate?.(value % 10 ? 2 : 8)
    }
  }
  dial.onpointerup = dial.onpointercancel = () => {
    lastAngle = null
  }

  return {
    set(value) {
      tickets = value
      turned = value * DEG_PER_TICKET
      ring.style.transform = `rotate(${turned}deg)`
      onChange(value)
    },
  }
}
