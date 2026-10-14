/**
 * Product prices over time, read from git history: every CMS save is a commit, so the
 * repository is a record of what each product cost on any day.
 *
 * Used for the "sidrena cijena" (Odluka o isticanju dodatne cijene, NN 101/2026): alongside
 * every price we show what it was on ANCHOR_DATE, or on the day the product was introduced if
 * that came later; and for the daily machine-readable price list (Odluka o objavi cjenika),
 * whose last 30 days must stay downloadable.
 *
 * Needs the full history: a shallow clone fails the build rather than publish wrong prices.
 */
import { execFileSync } from 'node:child_process';

const PRODUCTS_DIR = 'src/content/products';

/** Reference date for the anchor price, end of day in Zagreb */
export const ANCHOR_DATE = '2026-09-10';
const ANCHOR_CUTOFF = '2026-09-10T23:59:59+02:00';

export interface PricePoint {
  price: number;
  priceMax?: number;
}

export interface Anchor extends PricePoint {
  /** YYYY-MM-DD: ANCHOR_DATE, or the day a later product was introduced */
  date: string;
}

export interface ProductSnapshot extends PricePoint {
  slug: string;
  name: string;
  category: string;
  archive: boolean;
}

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'core.quotepath=off', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

let checked = false;
function assertFullHistory() {
  if (checked) return;
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
    throw new Error(
      'Anchor prices are read from git history, but this clone is shallow. ' +
        'Check out with full history (actions/checkout `fetch-depth: 0`).'
    );
  }
  checked = true;
}

const slugOf = (path: string) => path.slice(PRODUCTS_DIR.length + 1).replace(/\.md$/, '');
const isProduct = (path: string) => path.startsWith(`${PRODUCTS_DIR}/`) && path.endsWith('.md');

/** Reads many blobs in one `git cat-file --batch` call; specs are `<rev>:<path>` or blob ids */
function readBlobs(specs: string[]): string[] {
  if (specs.length === 0) return [];
  const out = execFileSync('git', ['cat-file', '--batch'], { input: specs.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 });
  const blobs: string[] = [];
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const headerEnd = out.indexOf(0x0a, at);
    const header = out.subarray(at, headerEnd).toString('utf8');
    if (header.endsWith('missing')) {
      blobs.push('');
      at = headerEnd + 1;
      continue;
    }
    const size = Number(header.split(' ')[2]);
    blobs.push(out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
    at = headerEnd + 1 + size + 1; // content, then a newline
  }
  return blobs;
}

/** The few frontmatter fields needed here; values are simple scalars as the CMS writes them */
function parseProduct(slug: string, source: string): ProductSnapshot | null {
  const fm = source.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!fm) return null;
  const field = (key: string) => {
    const raw = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();
    return raw?.replace(/^(['"])(.*)\1$/, '$2');
  };
  const num = (v?: string) => (v === undefined || v === '' || v === 'null' ? undefined : Number(v));
  const price = num(field('price'));
  if (price === undefined || Number.isNaN(price)) return null;
  return {
    slug,
    name: field('name') ?? slug,
    category: field('category') ?? '',
    archive: field('archive') === 'true',
    price,
    priceMax: num(field('priceMax')),
  };
}

/** Every product as it stood in the last commit at or before `cutoff` (ISO date-time) */
export function snapshotAt(cutoff: string): Map<string, ProductSnapshot> {
  assertFullHistory();
  const commit = git('rev-list', '-1', `--before=${cutoff}`, 'HEAD').trim();
  const products = new Map<string, ProductSnapshot>();
  if (!commit) return products;
  const entries = git('ls-tree', '-r', commit, '--', PRODUCTS_DIR)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t');
      return { blob: meta.split(' ')[2], path };
    })
    .filter((e) => isProduct(e.path));
  readBlobs(entries.map((e) => e.blob)).forEach((source, i) => {
    const product = parseProduct(slugOf(entries[i].path), source);
    if (product) products.set(product.slug, product);
  });
  return products;
}

let anchors: Map<string, Anchor> | undefined;

/**
 * Anchor price per product slug. Products that existed on ANCHOR_DATE keep that day's price;
 * products added later get their price on the day they were added. Renames carry the anchor.
 */
export function anchorPrices(): Map<string, Anchor> {
  if (anchors) return anchors;
  const result = new Map<string, Anchor>();
  for (const [slug, p] of snapshotAt(ANCHOR_CUTOFF)) {
    result.set(slug, { price: p.price, priceMax: p.priceMax, date: ANCHOR_DATE });
  }

  // Walk later commits oldest-first for additions and renames
  const log = git('log', '--reverse', '-M', '--name-status', '--format=@%H %cI', `--since=${ANCHOR_CUTOFF}`, '--', PRODUCTS_DIR);
  const added: { commit: string; date: string; path: string }[] = [];
  let commit = '';
  let date = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) {
      [commit, date] = line.slice(1).split(' ');
      continue;
    }
    const [status, from, to] = line.split('\t');
    if (!status) continue;
    if (status.startsWith('R') && isProduct(from) && isProduct(to)) {
      const anchor = result.get(slugOf(from));
      if (anchor) result.set(slugOf(to), anchor);
      else added.push({ commit, date, path: to });
    } else if (status === 'A' && isProduct(from) && !result.has(slugOf(from))) {
      added.push({ commit, date, path: from });
    }
  }
  readBlobs(added.map((a) => `${a.commit}:${a.path}`)).forEach((source, i) => {
    const slug = slugOf(added[i].path);
    const p = parseProduct(slug, source);
    if (p && !result.has(slug)) {
      result.set(slug, { price: p.price, priceMax: p.priceMax, date: zagrebDate(new Date(added[i].date)) });
    }
  });

  anchors = result;
  return result;
}

/**
 * Anchor for a product as currently priced. A product with no history yet (a new file not
 * committed, only possible locally) is introduced "today" at its current price.
 */
export function anchorFor(slug: string, current: PricePoint): Anchor {
  return anchorPrices().get(slug) ?? { ...current, date: zagrebDate(new Date()) };
}

/** YYYY-MM-DD of `date` in Zagreb */
export function zagrebDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(date);
}

/** Zagreb's UTC offset on `day` (YYYY-MM-DD), e.g. "+01:00" or "+02:00" */
export function zagrebOffset(day: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zagreb', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')!.value; // "GMT+1"
  const hours = Number(name.replace('GMT', '') || 0);
  return `${hours >= 0 ? '+' : '-'}${String(Math.abs(hours)).padStart(2, '0')}:00`;
}
