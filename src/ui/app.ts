import { gamesOf, totals, type Game, type PlayerId } from '../domain'
import { eur, num } from '../format'
import { JEWELS, PLAYERS, playerById, type Player } from '../players'
import { prefs } from '../prefs'
import type { GameStore } from '../store'
import { bindDial, dialHTML } from './dial'

const COINS = [50, 100, 200] as const
const DEFAULT_CENTS = 100

interface State {
  games: Game[]
  user: PlayerId | null
  jewels: Partial<Record<PlayerId, string>>
  tickets: number
  cents: number
}

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export async function mountApp(root: HTMLElement, store: GameStore): Promise<void> {
  const s: State = {
    games: await store.load(),
    user: prefs.read<PlayerId | null>('tk.user', null),
    jewels: prefs.read('tk.jewels', {}),
    tickets: 0,
    cents: DEFAULT_CENTS,
  }
  root.innerHTML = '<div class="app" id="shell"><div class="bgfx"><span></span></div><div id="screen"></div></div>'
  const shell = root.querySelector<HTMLElement>('#shell')!
  const screen = root.querySelector<HTMLElement>('#screen')!
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => screen.querySelector<T>(sel)!
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...screen.querySelectorAll<T>(sel)]

  const color = (p: Player): string => s.jewels[p.id] ?? p.jewel
  const mine = (): Game[] => (s.user ? gamesOf(s.games, s.user) : [])
  const bump = (el: HTMLElement): void => {
    el.classList.remove('bump')
    void el.offsetWidth
    el.classList.add('bump')
  }

  const pickHTML = (): string => `
<section class="page pick"><p class="eyebrow">Primera vez aquí</p><h2>¿Quién eres?</h2><p class="sub">Lo recordaremos en este móvil.</p>
<div class="people">${PLAYERS.map(
    (p, i) =>
      `<button class="person" data-id="${p.id}" style="--c:${color(p)};--i:${i}"><span class="av">${p.emoji}</span><span class="nm">${p.name}</span></button>`,
  ).join('')}</div></section>`

  const playHTML = (u: Player): string => {
    const t = totals(mine())
    const last = mine().slice(-5).reverse()
    return `
<section class="page">
<div class="me"><span class="av">${u.emoji}</span><div class="who"><small>Jugando como</small><b>${u.name}</b></div>
<button class="swap" id="tone" aria-expanded="false">Tono</button><button class="swap" id="swap">Cambiar</button></div>
<div class="jewels" id="jewels" hidden>${JEWELS.map(
      ([n, c]) => `<button class="jw" data-c="${c}" style="--c:${c}" aria-label="${n}" title="${n}" aria-pressed="${c === color(u)}"></button>`,
    ).join('')}</div>
<div class="totals"><div class="tot"><b id="tTk">${num(t.tickets)}</b><small>tickets</small></div><div class="tot"><b id="tEur">${eur(t.cents)}</b><small>gastado</small></div><div class="tot"><b id="tR">${t.ratio === null ? '–' : num(t.ratio)}</b><small>tickets/€</small></div></div>
<div class="play card"><p class="lbl">Tickets ganados</p>${dialHTML()}
<p class="lbl">Dinero metido</p><div class="money"><output id="eurv">${eur(s.cents)}</output><button class="clr" id="clr">Poner a 0</button></div>
<div class="coins">${COINS.map(
      (c) => `<button class="coin" data-c="${c}" aria-label="Sumar ${eur(c)}"><span>${c < 100 ? c : c / 100}</span><small>${c < 100 ? 'cént.' : c > 100 ? 'euros' : 'euro'}</small></button>`,
    ).join('')}</div>
<button class="go" id="go">Apuntar partida</button></div>
<div class="hist card"><p class="lbl">Tus últimas partidas</p>${
      last.length
        ? `<ul>${last.map((g) => `<li><span class="h-tk">${num(g.tickets)} <small>tickets</small></span><span class="h-eur">${eur(g.cents)}</span><span class="h-t">${ago(g.createdAt)}</span><button class="del" data-id="${g.id}" aria-label="Quitar partida">×</button></li>`).join('')}</ul>`
        : '<p class="empty">Aún no hay partidas. Apunta la primera arriba.</p>'
    }</div></section>`
  }

  function render(): void {
    const u = s.user ? playerById(s.user) : null
    shell.style.setProperty('--me', u ? color(u) : PLAYERS[0].jewel)
    if (!u) {
      screen.innerHTML = pickHTML()
      $$('.person').forEach((b) => (b.onclick = () => choose(b.dataset.id as PlayerId)))
      return
    }
    screen.innerHTML = playHTML(u)
    bindPlay(u)
  }

  function choose(id: PlayerId | null): void {
    s.user = id
    prefs.write('tk.user', id)
    render()
  }

  function bindPlay(u: Player): void {
    s.tickets = 0
    $('#swap').onclick = () => choose(null)
    const jewels = $('#jewels')
    const tone = $('#tone')
    tone.onclick = () => {
      jewels.hidden = !jewels.hidden
      tone.setAttribute('aria-expanded', String(!jewels.hidden))
    }
    $$('.jw').forEach(
      (b) =>
        (b.onclick = () => {
          s.jewels[u.id] = b.dataset.c
          prefs.write('tk.jewels', s.jewels)
          shell.style.setProperty('--me', b.dataset.c!)
          $$('.jw').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
        }),
    )

    const tkv = $('#tkv')
    bindDial($('#dial'), (tickets) => {
      s.tickets = tickets
      tkv.textContent = num(tickets)
      bump(tkv)
    })

    const eurv = $('#eurv')
    const setCents = (c: number) => {
      s.cents = c
      eurv.textContent = eur(c)
      bump(eurv)
    }
    $$('.coin').forEach((c) => (c.onclick = () => setCents(s.cents + Number(c.dataset.c))))
    $('#clr').onclick = () => setCents(0)

    $$('.del').forEach(
      (b) =>
        (b.onclick = async () => {
          await store.remove(b.dataset.id!)
          s.games = s.games.filter((g) => g.id !== b.dataset.id)
          render()
        }),
    )

    $('#go').onclick = async () => {
      const card = $('.play')
      if (!s.tickets && !s.cents) {
        card.classList.remove('nope')
        void card.offsetWidth
        card.classList.add('nope')
        return
      }
      const before = totals(mine())
      s.games.push(await store.add({ player: u.id, tickets: s.tickets, cents: s.cents }))
      s.cents = DEFAULT_CENTS
      render()
      celebrate()
      const after = totals(mine())
      countUp($('#tTk'), before.tickets, after.tickets, num)
      countUp($('#tEur'), before.cents, after.cents, eur)
      if (after.ratio !== null) countUp($('#tR'), before.ratio ?? 0, after.ratio, num)
    }
  }

  function countUp(el: HTMLElement, from: number, to: number, fmt: (v: number) => string): void {
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900)
      el.textContent = fmt(from + (to - from) * (1 - (1 - p) ** 3))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    bump(el)
  }

  function celebrate(): void {
    const palette = ['#FFF3C9', '#E9CD86', '#C69C47']
    for (let i = 0; i < 28; i++) {
      const f = document.createElement('i')
      f.className = 'fx'
      f.style.cssText = `--x:${Math.random() * 92}%;--dx:${(Math.random() - 0.5) * 160}px;--d:${0.9 + Math.random() * 0.9}s;--w:${Math.random() * 0.4}s;--c:${palette[i % 3]}`
      shell.append(f)
      setTimeout(() => f.remove(), 3000)
    }
  }

  render()
}
