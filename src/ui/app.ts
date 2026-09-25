import {
  chase,
  currentSession,
  gamesOf,
  inPeriod,
  machineStats,
  overtakers,
  ranking,
  summarize,
  totals,
  type Game,
  type Machine,
  type Metric,
  type Period,
  type PlayerId,
  type RankRow,
  type Session,
} from '../domain'
import { ACHIEVEMENTS, achievements, newlyUnlocked } from '../achievements'
import { eur, num } from '../format'
import { JEWELS, PLAYERS, playerById, type Player } from '../players'
import { prefs } from '../prefs'
import type { GameStore } from '../store'
import { WrongGroupCodeError } from '../supabaseStore'
import { bindDial, dialHTML } from './dial'

const COINS = [50, 100, 200] as const
const DEFAULT_CENTS = 100

interface State {
  games: Game[]
  sessions: Session[]
  machines: Machine[]
  /** Partida que se está corrigiendo, si la hay. */
  editing: string | null
  /** Máquina elegida para la próxima partida. */
  machineId: string | null
  user: PlayerId | null
  jewels: Partial<Record<PlayerId, string>>
  tickets: number
  cents: number
  page: number
  period: Period
  metric: Metric
}

const METRICS: Array<[Metric, string]> = [
  ['tickets', 'Tickets'],
  ['cents', 'Gastado'],
  ['ratio', 'Tickets/€'],
]
const PERIODS: Array<[Period, string]> = [
  ['session', 'Sesión'],
  ['today', 'Hoy'],
  ['all', 'Siempre'],
]

const clock = (t: number): string => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const UNIT: Record<Metric, string> = { tickets: ' tickets', cents: '', ratio: ' tk/€' }

const fmtValue = (metric: Metric, v: number | null): string =>
  v === null ? '–' : metric === 'cents' ? eur(v) : num(v)

const CROWN = `<svg class="crown" viewBox="0 0 36 24" aria-hidden="true"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#C69C47"/><stop offset=".45" stop-color="#FFF3C9"/><stop offset="1" stop-color="#B8862F"/></linearGradient></defs><path d="M3 21 5 6l8 7 5-11 5 11 8-7 2 15z" fill="url(#cg)"/></svg>`

const seg = <T extends string>(id: string, options: Array<[T, string]>, current: T): string =>
  `<div class="seg" id="${id}" style="--n:${options.length};--k:${options.findIndex(([v]) => v === current)}"><i></i>${options
    .map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === current}">${l}</button>`)
    .join('')}</div>`

const escapeHTML = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export async function mountApp(root: HTMLElement, store: GameStore, onWrongCode?: () => void): Promise<void> {
  let loadFailed = false
  const s: State = {
    games: await store.load().catch(() => {
      loadFailed = true
      return []
    }),
    sessions: (await store.loadSessions?.().catch(() => [])) ?? [],
    machines: (await store.loadMachines?.().catch(() => [])) ?? [],
    machineId: null,
    editing: null,
    user: prefs.read<PlayerId | null>('tk.user', null),
    jewels: prefs.read('tk.jewels', {}),
    tickets: 0,
    cents: DEFAULT_CENTS,
    page: 0,
    period: 'today',
    metric: 'tickets',
  }
  const hasSessions = typeof store.startSession === 'function'
  const hasMachines = typeof store.addMachine === 'function'
  const machineName = (id: string): string => s.machines.find((m) => m.id === id)?.name ?? 'Máquina'
  const openSession = (): Session | null => s.sessions.find((x) => x.endedAt === null) ?? null
  if (openSession()) s.period = 'session'
  const summariesShown = new Set<string>()

  root.innerHTML = '<div class="app" id="shell"><div class="bgfx"><span></span></div><div id="screen"></div></div>'
  const shell = root.querySelector<HTMLElement>('#shell')!
  const screen = root.querySelector<HTMLElement>('#screen')!
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => screen.querySelector<T>(sel)!
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...screen.querySelectorAll<T>(sel)]

  const toasts = document.createElement('div')
  toasts.className = 'toasts'
  toasts.setAttribute('role', 'status')
  shell.append(toasts)
  const toast = (text: string, action?: { label: string; run: () => void }): void => {
    const t = document.createElement('div')
    t.className = 'toast'
    t.textContent = text
    if (action) {
      const b = document.createElement('button')
      b.textContent = action.label
      b.onclick = () => {
        t.remove()
        action.run()
      }
      t.append(b)
    }
    toasts.append(t)
    setTimeout(() => t.remove(), action ? 6000 : 3800)
  }

  /** Ejecuta una escritura y avisa si falla; devuelve false si no se pudo. */
  const attempt = async (action: () => Promise<void>, failure: string): Promise<boolean> => {
    try {
      await action()
      return true
    } catch (e) {
      if (e instanceof WrongGroupCodeError && onWrongCode) onWrongCode()
      else toast(failure)
      return false
    }
  }

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
${hasSessions ? '<div class="sess" id="sess"></div>' : ''}
<div class="play card"><p class="lbl">Tickets ganados</p>${dialHTML()}
${hasMachines ? '<p class="lbl">Máquina</p><div class="machines" id="machines"></div>' : ''}
<p class="lbl">Dinero metido</p><div class="money"><output id="eurv">${eur(s.cents)}</output><button class="clr" id="clr">Poner a 0</button></div>
<div class="coins">${COINS.map(
      (c) => `<button class="coin" data-c="${c}" aria-label="Sumar ${eur(c)}"><span>${c < 100 ? c : c / 100}</span><small>${c < 100 ? 'cént.' : c > 100 ? 'euros' : 'euro'}</small></button>`,
    ).join('')}</div>
<button class="go" id="go">Apuntar partida</button><button class="clr cancel-edit" id="cancelEdit" hidden>Cancelar corrección</button></div>
<div class="hist card"><p class="lbl">Tus últimas partidas</p>${
      last.length
        ? `<ul>${last.map((g) => `<li><span class="h-tk">${num(g.tickets)} <small>tickets</small></span><span class="h-eur">${eur(g.cents)}</span><span class="h-t">${ago(g.createdAt)}${g.machineId ? ` · ${escapeHTML(machineName(g.machineId))}` : ''}</span><span class="h-act">${store.update ? `<button class="edit" data-id="${g.id}" aria-label="Corregir partida">✎</button>` : ''}<button class="del" data-id="${g.id}" aria-label="Quitar partida">×</button></span></li>`).join('')}</ul>`
        : '<p class="empty">Aún no hay partidas. Apunta la primera arriba.</p>'
    }</div>
<div class="ach card" id="ach"></div>
<p class="swipe-hint">Desliza para ver el ranking <i>→</i></p></section>`
  }

  const rankHTML = (): string => `
<section class="page"><p class="eyebrow">Clasificación</p>
<div class="rk-head"><h2>Ranking</h2></div>
${seg('period', hasSessions ? PERIODS : PERIODS.slice(1), s.period)}
${seg('metric', METRICS, s.metric)}
<div id="board"></div></section>`

  function renderBoard(): void {
    const m = s.metric
    const rows = ranking(s.games, PLAYERS.map((p) => p.id), m, s.period, Date.now(), currentSession(s.sessions)?.id ?? null)
    const top = rows[0].value || 1
    const pod = (r: RankRow, i: number): string => {
      const p = playerById(r.player)
      return `<div class="pod p${i + 1}${r.player === s.user ? ' you' : ''}" style="--c:${color(p)};--i:${i}">${i === 0 ? CROWN : ''}<span class="av">${p.emoji}</span><b class="nm">${p.name}</b><span class="val">${fmtValue(m, r.value)}</span><small>${r.player === s.user ? 'tú' : ''}</small><div class="ped"><span>${i + 1}</span></div></div>`
    }
    const c = chase(rows, s.user!)
    const msg =
      c.kind === 'first'
        ? 'Vas primero. Que no te pillen.'
        : c.kind === 'out'
          ? 'Apunta una partida para entrar en este ranking.'
          : `Te faltan <b>${fmtValue(m, c.diff)}${UNIT[m]}</b> para pasar a ${playerById(c.ahead).name}.`
    $('#board').innerHTML = `<div class="podium">${[1, 0, 2].map((i) => pod(rows[i], i)).join('')}</div>
<ol class="rest">${rows
      .slice(3)
      .map((r, i) => {
        const p = playerById(r.player)
        return `<li class="${r.player === s.user ? 'you' : ''}" style="--c:${color(p)};--i:${i}"><span class="pos">${i + 4}</span><span class="av">${p.emoji}</span><span class="nm">${p.name}${r.player === s.user ? ' · tú' : ''}</span><span class="val">${fmtValue(m, r.value)}${r.value === null ? '' : UNIT[m]}</span><i class="bar" style="--w:${((r.value ?? 0) / top) * 100}%"></i></li>`
      })
      .join('')}</ol>
<p class="chase">${msg}</p>${hasMachines ? machinesBoardHTML() : ''}`
  }

  function machinesBoardHTML(): string {
    const stats = machineStats(inPeriod(s.games, s.period, Date.now(), currentSession(s.sessions)?.id ?? null))
    return `<div class="mach card"><p class="lbl">Máquinas que más rinden</p>${
      stats.length
        ? `<ol>${stats
            .map(
              (m, i) =>
                `<li><span class="pos">${i + 1}</span><span class="nm">${machineName(m.machineId)}<small>${m.games} ${m.games === 1 ? 'partida' : 'partidas'}</small></span><span class="val">${fmtValue('ratio', m.totals.ratio)}${m.totals.ratio === null ? '' : ' tk/€'}</span></li>`,
            )
            .join('')}</ol>`
        : '<p class="empty">Elige la máquina al apuntar y aquí verás cuál rinde más.</p>'
    }</div>`
  }

  /** Chips de máquina: la de tu última partida viene elegida; tocar la elegida la quita. */
  function renderMachines(): void {
    const box = screen.querySelector<HTMLElement>('#machines')
    if (!box) return
    const lastUse = new Map<string, number>()
    mine().forEach((g) => g.machineId && lastUse.set(g.machineId, g.createdAt))
    const ordered = [...s.machines].sort(
      (a, b) => (lastUse.get(b.id) ?? 0) - (lastUse.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'es'),
    )
    box.innerHTML = `${ordered
      .map((m) => `<button class="chip" data-id="${m.id}" aria-pressed="${m.id === s.machineId}">${escapeHTML(m.name)}</button>`)
      .join('')}<button class="chip add" id="addMachine">+ Nueva</button>`
    box.querySelectorAll<HTMLButtonElement>('.chip[data-id]').forEach(
      (b) =>
        (b.onclick = () => {
          s.machineId = s.machineId === b.dataset.id ? null : b.dataset.id!
          renderMachines()
        }),
    )
    box.querySelector<HTMLButtonElement>('#addMachine')!.onclick = () => {
      box.insertAdjacentHTML(
        'beforeend',
        '<form class="chip-form" id="machineForm"><input id="machineName" maxlength="40" placeholder="Nombre de la máquina" aria-label="Nombre de la máquina" required /><button class="chip">Crear</button></form>',
      )
      box.querySelector('#addMachine')!.remove()
      const form = box.querySelector<HTMLFormElement>('#machineForm')!
      const input = form.querySelector<HTMLInputElement>('input')!
      input.focus()
      form.onsubmit = async (e) => {
        e.preventDefault()
        const name = input.value.trim()
        if (!name) return
        await attempt(async () => {
          const machine = await store.addMachine!(name)
          if (!s.machines.some((m) => m.id === machine.id)) s.machines.push(machine)
          s.machineId = machine.id
        }, 'No se ha podido crear la máquina. Comprueba la conexión.')
        renderMachines()
      }
    }
  }

  function render(): void {
    const u = s.user ? playerById(s.user) : null
    shell.style.setProperty('--me', u ? color(u) : PLAYERS[0].jewel)
    if (!u) {
      screen.innerHTML = pickHTML()
      $$('.person').forEach((b) => (b.onclick = () => choose(b.dataset.id as PlayerId)))
      return
    }
    screen.innerHTML = `<div class="pager" id="pager">${playHTML(u)}${rankHTML()}</div><nav class="dots"><button data-p="0" aria-label="Apuntar partida"></button><button data-p="1" aria-label="Ranking"></button></nav>`
    bindPager()
    renderBoard()
    renderSession()
    bindPlay(u)
    checkAchievements()
  }

  function renderSession(): void {
    const bar = screen.querySelector<HTMLElement>('#sess')
    if (!bar) return
    const open = openSession()
    const played = open ? s.games.filter((g) => g.sessionId === open.id).length : 0
    bar.classList.toggle('on', open !== null)
    bar.innerHTML = open
      ? `<span class="pulse" aria-hidden="true"></span><div class="sess-txt"><b>Sesión en marcha</b><small>Desde las ${clock(open.startedAt)} · ${played} ${played === 1 ? 'partida' : 'partidas'}</small></div><button class="swap" id="sessBtn">Terminar</button>`
      : '<div class="sess-txt"><b>Sin sesión abierta</b><small>Empieza una para agrupar las partidas de la tarde</small></div><button class="swap" id="sessBtn">Empezar</button>'
    const btn = $<HTMLButtonElement>('#sessBtn')
    let armed = false
    btn.onclick = async () => {
      if (!open) {
        await attempt(async () => upsertSession(await store.startSession!()), 'No se ha podido empezar la sesión. Comprueba la conexión.')
        return
      }
      // Terminar pide un segundo toque para no cerrarla sin querer.
      if (!armed) {
        armed = true
        btn.textContent = '¿Seguro?'
        setTimeout(() => {
          armed = false
          if (btn.isConnected) btn.textContent = 'Terminar'
        }, 3000)
        return
      }
      await attempt(async () => {
        const ended = await store.endSession!()
        if (ended) upsertSession(ended)
      }, 'No se ha podido terminar la sesión. Comprueba la conexión.')
    }
  }

  function upsertSession(session: Session): void {
    const wasOpen = s.sessions.some((x) => x.id === session.id && x.endedAt === null)
    s.sessions = [...s.sessions.filter((x) => x.id !== session.id), session]
    if (session.endedAt !== null && wasOpen) showSummary(session)
    checkAchievements()
    // Sin repintar la pantalla, para no perder lo marcado en la rueda.
    if (s.user) {
      renderSession()
      renderBoard()
    }
  }

  function showSummary(session: Session): void {
    if (summariesShown.has(session.id)) return
    summariesShown.add(session.id)
    const sum = summarize(s.games, session.id, PLAYERS.map((p) => p.id))
    const winner = sum.winner ? playerById(sum.winner) : null
    const best = sum.best ? playerById(sum.best.player) : null
    const minutes = Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 60000)
    const box = document.createElement('div')
    box.className = 'sum'
    box.innerHTML = `<div class="sum-card card" role="dialog" aria-modal="true" aria-labelledby="sumT">
<p class="eyebrow">Sesión terminada · ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}</p>
<h2 id="sumT">Resumen</h2>
${
  winner
    ? `<div class="sum-win" style="--c:${color(winner)}">${CROWN}<span class="av">${winner.emoji}</span><p><b>${winner.name}</b> gana la tarde</p></div>`
    : '<p class="empty">Nadie apuntó partidas en esta sesión.</p>'
}
<div class="totals"><div class="tot"><b>${num(sum.games)}</b><small>partidas</small></div><div class="tot"><b>${num(sum.tickets)}</b><small>tickets</small></div><div class="tot"><b>${eur(sum.cents)}</b><small>gastado</small></div></div>
${best && sum.best ? `<p class="sum-best">Mejor partida: ${best.emoji} ${best.name} con <b>${num(sum.best.tickets)} tickets</b> por ${eur(sum.best.cents)}</p>` : ''}
<button class="go" id="sumClose">Cerrar</button></div>`
    shell.append(box)
    const close = box.querySelector<HTMLButtonElement>('#sumClose')!
    close.focus()
    close.onclick = () => box.remove()
  }

  function bindPager(): void {
    const pager = $('#pager')
    const dots = $$('.dots button')
    const mark = () => dots.forEach((d, i) => d.classList.toggle('on', i === s.page))
    pager.scrollLeft = s.page * pager.clientWidth
    mark()
    pager.onscroll = () => {
      const p = Math.round(pager.scrollLeft / pager.clientWidth)
      if (p === s.page) return
      s.page = p
      mark()
      if (p === 1) renderBoard()
    }
    dots.forEach((d) => (d.onclick = () => pager.scrollTo({ left: Number(d.dataset.p) * pager.clientWidth, behavior: 'smooth' })))
    $$('.seg').forEach((sg) => {
      const buttons = [...sg.querySelectorAll<HTMLButtonElement>('button')]
      buttons.forEach(
        (b, i) =>
          (b.onclick = () => {
            if (sg.id === 'period') s.period = b.dataset.v as Period
            else s.metric = b.dataset.v as Metric
            sg.style.setProperty('--k', String(i))
            buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
            renderBoard()
          }),
      )
    })
  }

  function choose(id: PlayerId | null): void {
    s.user = id
    s.page = 0
    prefs.write('tk.user', id)
    render()
  }

  function bindPlay(u: Player): void {
    s.tickets = 0
    s.machineId = mine().at(-1)?.machineId ?? null
    renderMachines()
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
          renderBoard()
        }),
    )

    const tkv = $('#tkv')
    const dial = bindDial($('#dial'), (tickets) => {
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

    $$('.edit').forEach(
      (b) =>
        (b.onclick = () => {
          const g = s.games.find((x) => x.id === b.dataset.id)
          if (!g) return
          s.editing = g.id
          dial.set(g.tickets)
          setCents(g.cents)
          s.machineId = g.machineId ?? null
          renderMachines()
          $('#go').textContent = 'Guardar cambios'
          $('#cancelEdit').hidden = false
          $('.play').classList.add('editing')
          $('.play').scrollIntoView({ behavior: 'smooth', block: 'start' })
        }),
    )
    $('#cancelEdit').onclick = () => {
      s.editing = null
      render()
    }

    $$('.del').forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await attempt(() => store.remove(b.dataset.id!), 'No se ha podido quitar la partida. Comprueba la conexión.')
          if (!ok) return
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
      const go = $<HTMLButtonElement>('#go')
      go.disabled = true
      const fields = { tickets: s.tickets, cents: s.cents, machineId: s.machineId }
      const editing = s.editing
      let saved: Game | null = null
      const ok = await attempt(
        async () => {
          saved = editing ? await store.update!(editing, fields) : await store.add({ player: u.id, ...fields })
        },
        editing ? 'No se ha podido corregir la partida. Comprueba la conexión.' : 'No se ha podido apuntar la partida. Comprueba la conexión y vuelve a probar.',
      )
      go.disabled = false
      if (!ok || !saved) return
      upsertGame(saved)
      s.editing = null
      s.cents = DEFAULT_CENTS
      render()
      if (editing) {
        toast('Partida corregida')
      } else {
        celebrate()
        const id = (saved as Game).id
        toast(`Apuntada: ${num(fields.tickets)} tickets por ${eur(fields.cents)}`, {
          label: 'Deshacer',
          run: async () => {
            if (!(await attempt(() => store.remove(id), 'No se ha podido deshacer. Comprueba la conexión.'))) return
            s.games = s.games.filter((g) => g.id !== id)
            render()
          },
        })
      }
      const after = totals(mine())
      countUp($('#tTk'), before.tickets, after.tickets, num)
      countUp($('#tEur'), before.cents, after.cents, eur)
      if (after.ratio !== null) countUp($('#tR'), before.ratio ?? 0, after.ratio, num)
    }
  }

  function upsertGame(game: Game): void {
    s.games = s.games.some((g) => g.id === game.id) ? s.games.map((g) => (g.id === game.id ? game : g)) : [...s.games, game]
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

  store.subscribe?.((change) => {
    if (change.type === 'session') return upsertSession(change.session)
    if (change.type === 'machine') {
      if (!s.machines.some((m) => m.id === change.machine.id)) s.machines.push(change.machine)
      renderMachines()
      return
    }
    if (change.type === 'updated') {
      upsertGame(change.game)
      refreshLive()
      return
    }
    if (change.type === 'added') {
      if (s.games.some((g) => g.id === change.game.id)) return
      const standings = () => ranking(s.games, PLAYERS.map((p) => p.id), 'tickets', s.period, Date.now(), currentSession(s.sessions)?.id ?? null)
      const before = standings()
      s.games.push(change.game)
      announce(change.game, before, standings())
    } else {
      if (!s.games.some((g) => g.id === change.id)) return
      s.games = s.games.filter((g) => g.id !== change.id)
    }
    refreshLive()
  })

  /** Avisos de lo que hacen los demás: su partida y si te adelantan. */
  function announce(game: Game, before: RankRow[], after: RankRow[]): void {
    if (!s.user || game.player === s.user) return
    const p = playerById(game.player)
    toast(game.tickets ? `${p.emoji} ${p.name} acaba de sacar ${num(game.tickets)} tickets` : `${p.emoji} ${p.name} ha apuntado una partida`)
    overtakers(before, after, s.user).forEach((id) => {
      const o = playerById(id)
      toast(`${o.emoji} ${o.name} te ha adelantado en el ranking`)
    })
  }

  /** Actualiza totales y ranking sin repintar la pantalla, para no perder lo marcado en la rueda. */
  let unlocked = achievements(s.games, s.sessions)

  /** Pinta tus logros y avisa a todos de los recién conseguidos. */
  function checkAchievements(): void {
    const next = achievements(s.games, s.sessions)
    newlyUnlocked(unlocked, next).forEach(([player, id]) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!
      const p = playerById(player)
      toast(player === s.user ? `🏆 Has conseguido «${a.name}» ${a.emoji}` : `🏆 ${p.emoji} ${p.name} ha conseguido «${a.name}» ${a.emoji}`)
    })
    unlocked = next
    const box = screen.querySelector<HTMLElement>('#ach')
    if (!box || !s.user) return
    const mineUnlocked = unlocked.get(s.user) ?? new Set()
    box.innerHTML = `<p class="lbl">Tus logros · ${mineUnlocked.size} de ${ACHIEVEMENTS.length}</p><ul>${ACHIEVEMENTS.map(
      (a) =>
        `<li class="${mineUnlocked.has(a.id) ? 'got' : ''}"><span class="ach-e" aria-hidden="true">${a.emoji}</span><b>${a.name}</b><small>${a.description}</small></li>`,
    ).join('')}</ul>`
  }

  function refreshLive(): void {
    if (!s.user || !screen.querySelector('#board')) return
    renderBoard()
    renderSession()
    checkAchievements()
    const t = totals(mine())
    const set = (sel: string, text: string) => {
      const el = $(sel)
      if (el.textContent === text) return
      el.textContent = text
      bump(el)
    }
    set('#tTk', num(t.tickets))
    set('#tEur', eur(t.cents))
    set('#tR', t.ratio === null ? '–' : num(t.ratio))
  }

  render()
  if (loadFailed) toast('No se han podido cargar las partidas. Comprueba la conexión.')
}
