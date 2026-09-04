/** Desplaza la vista hasta el elemento y lo resalta un momento. */
export function scrollToAndFlash(el: HTMLElement | null | undefined, opts?: ScrollIntoViewOptions) {
  if (!el) return
  el.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
    ...opts,
  })
  el.classList.remove('field-flash')
  // Forzar reflow para reiniciar la animación si ya estaba.
  void el.offsetWidth
  el.classList.add('field-flash')
  window.setTimeout(() => el.classList.remove('field-flash'), 1600)
}

/** Primer selector que exista en el DOM. */
export function scrollToFirst(selectors: string[]) {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) {
      scrollToAndFlash(el)
      return el
    }
  }
  return null
}
