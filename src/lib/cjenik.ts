/**
 * The machine-readable price list (Odluka o objavi cjenika proizvoda i usluga, NN 101/2026):
 * a CSV of every article the shop sells, published daily by 8:00, with each day's file kept
 * online for 30 days. Columns follow the Ministry's proposed template, plus the anchor's date
 * for articles introduced after the reference date.
 *
 * The articles come from the till's export (src/data/kasa.json, see scripts/import-kasa.py),
 * which is re-imported when prices change; until then every day republishes the same list.
 * Past days are read from git history, so a rebuild reproduces exactly what each day said.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ANCHOR_DATE, zagrebOffset } from './priceHistory';
import { formatDateHr } from './price';

/** First day this site published a price list; no earlier files are generated */
const FIRST_DAY = '2026-10-14';
const KEEP_DAYS = 30;
/** Time each day's list reflects (the daily build runs before it) */
const AS_OF = '03:00';
const KASA = 'src/data/kasa.json';

/**
 * Identifies the shop in file names (točka VI.): type, address, and its code. The code is the
 * business premises label from fiscalisation (receipts read "…/PJ1/1": premises PJ1, till 1).
 */
const STORE = { kind: 'trgovina', address: 'Augusta Šenoe 25 Bjelovar', code: 'PJ1' };

export interface Article {
  code: string;
  name: string;
  unit: string;
  price: number;
  anchor: number;
  /** YYYY-MM-DD */
  anchorDate: string;
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

/** Decimal comma, no currency sign */
const amount = (n: number) => n.toFixed(2).replace('.', ',');

const cell = (value: string) => (/[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function csv(articles: Article[]): string {
  const rows = articles.map((a) => [
    a.name,
    a.code,
    '',
    a.unit,
    '',
    amount(a.price),
    'NE',
    '',
    amount(a.anchor),
    '',
    'DA',
    formatDateHr(a.anchorDate),
  ]);
  return [HEADER, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Days with a published list, oldest first: the last KEEP_DAYS days, not before FIRST_DAY */
export function publishedDays(today = zagrebToday()): string[] {
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

export const zagrebToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date());

/** e.g. "trgovina_Augusta-Senoe-25-Bjelovar_PJ1_001_14.10.2026_03-00" (no extension) */
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

const parse = (json: string): Article[] => JSON.parse(json).articles;

/** Today's list: the till export as built */
export const currentArticles = (): Article[] => parse(readFileSync(KASA, 'utf8'));

/** The list on a past `day`, as of AS_OF that morning, from git history */
export function articlesOn(day: string): Article[] {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const commit = git('rev-list', '-1', `--before=${day}T${AS_OF}:00${zagrebOffset(day)}`, 'HEAD', '--', KASA).trim();
  // Before the first import was committed there's nothing older to show; use the current one
  return commit ? parse(git('show', `${commit}:${KASA}`)) : currentArticles();
}

export const csvResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
