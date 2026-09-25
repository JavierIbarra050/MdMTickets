export const eur = (cents: number): string =>
  (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export const num = (value: number): string => Math.round(value).toLocaleString('es-ES')
