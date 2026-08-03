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
