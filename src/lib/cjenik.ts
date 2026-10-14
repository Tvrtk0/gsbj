/**
 * The machine-readable price list (Odluka o objavi cjenika proizvoda i usluga, NN 101/2026):
 * a CSV of every product on sale, published daily by 8:00, with each day's file kept online
 * for 30 days. Columns follow the Ministry's proposed template, plus the anchor's date for
 * products introduced after the reference date.
 *
 * Past days are rebuilt from git history (src/lib/priceHistory.ts), so a rebuild always
 * reproduces exactly what each day's list said.
 */
import { ANCHOR_DATE, anchorFor, snapshotAt, zagrebDate, zagrebOffset, type PricePoint } from './priceHistory';
import { formatDateHr } from './price';

/** First day this site published a price list; no earlier files are generated */
const FIRST_DAY = '2026-10-14';
const KEEP_DAYS = 30;
/** Time each day's list reflects (the daily build runs before it) */
const AS_OF = '03:00';

/** Identifies the shop in file names (točka VI.): type, address, internal code */
const STORE = { kind: 'trgovina', address: 'Augusta Šenoe 25 Bjelovar', code: 'P01' };

export interface ListedProduct extends PricePoint {
  slug: string;
  name: string;
}

const HEADER = [
  'Naziv proizvoda',
  'Šifra',
  'Marka',
  'Jedinica mjere',
  'Cijena za jedinicu mjere',
  'Maloprodajna cijena',
  'Poseban oblik prodaje',
  'Naziv posebnog oblika prodaje',
  `Dodatna cijena ${formatDateHr(ANCHOR_DATE)}`,
  'Barkod',
  'Dostupnost',
  'Datum dodatne cijene',
];

/** Decimal comma, no currency sign; an assortment sold at a range of prices as "1,00-4,00" */
const amount = ({ price, priceMax }: PricePoint) => {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  return priceMax === undefined ? fmt(price) : `${fmt(price)}-${fmt(priceMax)}`;
};

const cell = (value: string) => (/[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function csv(products: ListedProduct[]): string {
  const rows = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'))
    .map((p) => {
      const anchor = anchorFor(p.slug, p);
      return [
        p.name,
        p.slug,
        '',
        'kom',
        '',
        amount(p),
        'NE',
        '',
        amount(anchor),
        '',
        'DA',
        formatDateHr(anchor.date),
      ];
    });
  return [HEADER, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Days with a published list, oldest first: the last KEEP_DAYS days, not before FIRST_DAY */
export function publishedDays(today = zagrebDate(new Date())): string[] {
  const days: string[] = [];
  const d = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i < KEEP_DAYS; i++) {
    const day = d.toISOString().slice(0, 10);
    if (day < FIRST_DAY) break;
    days.unshift(day);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

/** e.g. "trgovina_Augusta-Senoe-25-Bjelovar_P01_001_14.10.2026_06-00" (no extension) */
export function fileName(day: string): string {
  const seq = Math.round((Date.parse(day) - Date.parse(FIRST_DAY)) / 86_400_000) + 1;
  const [y, m, d] = day.split('-');
  const address = STORE.address
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, '-');
  return [STORE.kind, address, STORE.code, String(seq).padStart(3, '0'), `${d}.${m}.${y}`, AS_OF.replace(':', '-')].join('_');
}

/** Products on sale on a past `day`, as of AS_OF that morning */
export function productsOn(day: string): ListedProduct[] {
  return [...snapshotAt(`${day}T${AS_OF}:00${zagrebOffset(day)}`).values()].filter((p) => !p.archive);
}

/** Today's list is the site as built (the content collection), not a git snapshot */
export async function currentProducts(): Promise<ListedProduct[]> {
  const { getCollection } = await import('astro:content');
  const products = await getCollection('products', ({ data }) => !data.archive);
  return products.map((p) => ({ slug: p.id, name: p.data.name, price: p.data.price, priceMax: p.data.priceMax }));
}

export const csvResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
