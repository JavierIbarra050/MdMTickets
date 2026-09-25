import { createClient } from '@supabase/supabase-js'
import { prefs } from './prefs'
import { LocalGameStore } from './store'
import { SupabaseGameStore, checkGroupCode } from './supabaseStore'
import { mountApp } from './ui/app'
import { askGroupCode } from './ui/gate'
import './ui/styles.css'

const root = document.querySelector<HTMLElement>('#app')!
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

async function start(): Promise<void> {
  // Sin Supabase configurado (desarrollo local), las partidas se quedan en el navegador.
  if (!url || !key) return mountApp(root, new LocalGameStore())

  const client = createClient(url, key)
  const onWrongCode = () => {
    prefs.write('tk.code', null)
    location.reload()
  }
  const saved = prefs.read<string | null>('tk.code', null)
  // Sin conexión al arrancar damos el código guardado por bueno: fallará al apuntar si no lo es.
  const stillValid = saved !== null && (await checkGroupCode(client, saved).catch(() => true))
  const code = stillValid ? saved : await askGroupCode(root, (c) => checkGroupCode(client, c))
  prefs.write('tk.code', code)
  return mountApp(root, new SupabaseGameStore(client, code), onWrongCode)
}

void start()
