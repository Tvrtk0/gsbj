/**
 * Price rendering. A product with `priceMax` is an assortment sold at varying
 * prices, where `price` is the low end.
 */

/** Detail pages, where there is room for the whole range: "3.80 – 4.60 €". */
export function formatPrice(price: number, priceMax?: number): string {
  return priceMax === undefined
    ? `${price.toFixed(2)} €`
    : `${price.toFixed(2)} – ${priceMax.toFixed(2)} €`;
}

/**
 * Cards, which are ~160px wide in the 2-column mobile grid — too narrow for a
 * full range without wrapping: "od 3.80 €".
 */
export function formatPriceFrom(price: number, priceMax?: number): string {
  return priceMax === undefined ? `${price.toFixed(2)} €` : `od ${price.toFixed(2)} €`;
}

/** "2026-09-10" → "10. 9. 2026." */
export function formatDateHr(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return `${d}. ${m}. ${y}.`;
}

/**
 * The anchor price line ("sidrena cijena", NN 101/2026). The Ministry's guidance is that the
 * date alone identifies it: "Cijena 10. 9. 2026.: 12.00 €", or on narrow cards just
 * "10. 9. 2026.: od 12.00 €". Non-breaking spaces keep the date and the amount whole, so a
 * line that has to wrap breaks after the colon.
 */
export function formatAnchor(anchor: { price: number; priceMax?: number; date: string }, compact = false): string {
  const nb = (s: string) => s.replace(/ /g, '\u00a0');
  const amount = compact ? formatPriceFrom(anchor.price, anchor.priceMax) : formatPrice(anchor.price, anchor.priceMax);
  const date = nb(formatDateHr(anchor.date));
  return compact ? `${date}: ${nb(amount)}` : `Cijena ${date}: ${nb(amount)}`;
}
