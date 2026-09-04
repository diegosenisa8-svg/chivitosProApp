/**
 * Inicio del día civil en una zona IANA (ej. America/Montevideo).
 * Evita que el dashboard en Railway (UTC) corte el día a las 21:00 UY.
 */
export function startOfDayInTimeZone(date = new Date(), timeZone = 'America/Montevideo') {
  const tz = timeZone || 'America/Montevideo'
  const cal = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

  const base = Date.parse(`${cal}T00:00:00.000Z`)
  for (let deltaMin = -14 * 60; deltaMin <= 14 * 60; deltaMin++) {
    const candidate = new Date(base + deltaMin * 60 * 1000)
    const localCal = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(candidate)
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(candidate)
    if (localCal === cal && (localTime === '00:00:00' || localTime === '00:00')) {
      return candidate
    }
  }
  // Uruguay sin DST: UTC−3
  return new Date(base + 3 * 60 * 60 * 1000)
}

export function addLocalDays(startOfDay, days, timeZone = 'America/Montevideo') {
  const mid = new Date(startOfDay.getTime() + 12 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000)
  return startOfDayInTimeZone(mid, timeZone)
}

export function localDateKey(date, timeZone = 'America/Montevideo') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
