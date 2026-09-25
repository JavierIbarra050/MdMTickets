/** Pide el código de grupo hasta que `check` lo dé por bueno. */
export function askGroupCode(root: HTMLElement, check: (code: string) => Promise<boolean>): Promise<string> {
  root.innerHTML = `
<div class="app"><div class="bgfx"><span></span></div>
<form class="page gate" id="gate">
  <p class="eyebrow">Solo para el grupo</p>
  <h2>Código del grupo</h2>
  <p class="sub">Pídeselo a alguien del grupo. Solo lo meterás una vez en este móvil.</p>
  <label class="lbl" for="code">Código</label>
  <input id="code" name="code" autocomplete="off" autocapitalize="none" required />
  <p class="gate-error" id="gate-error" role="alert"></p>
  <button class="go" type="submit">Entrar</button>
</form></div>`
  const form = root.querySelector<HTMLFormElement>('#gate')!
  const input = root.querySelector<HTMLInputElement>('#code')!
  const error = root.querySelector<HTMLElement>('#gate-error')!
  const button = form.querySelector<HTMLButtonElement>('button')!
  input.focus()

  return new Promise((resolve) => {
    form.onsubmit = async (e) => {
      e.preventDefault()
      const code = input.value.trim()
      button.disabled = true
      error.textContent = ''
      try {
        if (await check(code)) return resolve(code)
        error.textContent = 'Ese código no es el del grupo. Revísalo y vuelve a probar.'
      } catch {
        error.textContent = 'No hay conexión con el servidor. Comprueba internet y vuelve a probar.'
      } finally {
        button.disabled = false
      }
    }
  })
}
