export function formatMoney(amount: number, _currency = 'UYU') {
  return `$ ${amount.toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatPrice(amount: number) {
  return `$ ${amount.toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
