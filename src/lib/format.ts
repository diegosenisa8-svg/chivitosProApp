export function formatMoney(amount: number, currency = 'UYU') {
  const formatted = amount.toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

export function formatPrice(amount: number) {
  return amount.toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
