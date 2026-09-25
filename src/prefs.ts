// Preferencias de este móvil. localStorage puede fallar (modo privado), así que nunca rompe la app.
const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento: la preferencia dura lo que la pestaña */
  }
}

export const prefs = { read, write }
