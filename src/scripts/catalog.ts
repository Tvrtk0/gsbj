/**
 * The product listing: category filter, search and load-more-on-scroll, as one piece of state
 * so they can't fight over which cards are visible.
 *
 * Search runs on the Pagefind index but shows results as the page's own product cards, in
 * Pagefind's ranking order. State lives in the URL (?category=, ?q=) and history.state (how many
 * cards are shown), so coming back from a product restores the same view and scroll position.
 */

const BATCH = 24;
const base = import.meta.env.BASE_URL;

const grid = document.getElementById('product-grid')!;
const sentinel = document.getElementById('scroll-sentinel')!;
const chips = document.getElementById('category-filter')!;
const chipButtons = [...chips.querySelectorAll<HTMLButtonElement>('.filter-btn')];
const input = document.getElementById('search-input') as HTMLInputElement;
const clearBtn = document.getElementById('search-clear')!;
const status = document.getElementById('search-status')!;
const empty = document.getElementById('search-empty')!;

/** Cards in their original (newest-first) order, keyed by slug */
const cards = [...grid.querySelectorAll<HTMLAnchorElement>(':scope > a')];
const bySlug = new Map(cards.map((c) => [slugOf(c.pathname), c]));

const params = new URLSearchParams(location.search);
let category = params.get('category') ?? 'all';
let query = params.get('q') ?? '';
let results: HTMLAnchorElement[] | null = null; // null = no search active
let limit = Math.max(BATCH, Number(history.state?.limit) || BATCH);

function slugOf(path: string) {
  return path.replace(/\/$/, '').split('/').pop()!;
}

/** Lowercase, no diacritics (č→c, đ→d), so "upaljac" finds "Upaljač" */
const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** `animate`: cards newly shown by this render cascade in (not on first load, which is SSR'd) */
function render({ animate = true } = {}) {
  const searching = results !== null;
  const list = searching ? results! : cards.filter((c) => category === 'all' || c.dataset.category === category);
  const wasVisible = new Set(cards.filter((c) => c.style.display !== 'none'));
  // A whole new set (filter/search) restarts the cascade at the top; load-more continues it
  const reorders = list.slice(0, limit).some((c, i) => grid.children[i] !== c);

  // Put the visible list first, in order; everything else stays in the DOM, hidden
  for (const card of cards) card.style.display = 'none';
  let n = 0;
  list.forEach((card, i) => {
    grid.appendChild(card);
    if (i >= limit) return;
    card.style.display = '';
    if (animate && (reorders || !wasVisible.has(card))) {
      card.classList.remove('card-in');
      void card.offsetWidth; // restart the animation if it was mid-run
      card.style.setProperty('--i', String(Math.min(n++, 12)));
      card.classList.add('card-in');
    }
  });

  chips.hidden = searching;
  chipButtons.forEach((b) => {
    const active = b.dataset.category === category;
    b.classList.toggle('active', active);
    b.classList.toggle('bg-primary', active);
    b.classList.toggle('text-primary-foreground', active);
    b.classList.toggle('border-primary', active);
    b.classList.toggle('bg-card', !active);
    b.classList.toggle('text-card-foreground', !active);
    b.classList.toggle('border-border', !active);
  });

  clearBtn.hidden = !query;
  status.hidden = !searching || list.length === 0;
  status.textContent = searching ? `${list.length} ${list.length === 1 ? 'rezultat' : 'rezultata'} za „${query}“` : '';
  empty.hidden = !searching || list.length > 0;
  empty.querySelector('[data-term]')!.textContent = query;

  if (list.length > limit) observer.observe(sentinel);
  else observer.unobserve(sentinel);

  const url = new URL(location.href);
  url.searchParams.delete('category');
  url.searchParams.delete('q');
  if (category !== 'all') url.searchParams.set('category', category);
  if (query) url.searchParams.set('q', query);
  history.replaceState({ limit }, '', url);
}

const observer = new IntersectionObserver(
  (entries) => {
    if (!entries[0].isIntersecting) return;
    limit += BATCH;
    render();
  },
  { rootMargin: '600px' }
);

// --- Search -----------------------------------------------------------------------------

/** The slice of Pagefind's JS API used here (https://pagefind.app/docs/api/) */
interface Pagefind {
  init(): Promise<void>;
  search(term: string): Promise<{
    results: { data(): Promise<{ url: string; content: string; meta: { title: string } }> }[];
  }>;
}
let pagefind: Promise<Pagefind> | null = null;
const loadPagefind = () =>
  (pagefind ??= import(/* @vite-ignore */ `${base}pagefind/pagefind.js`).then(async (pf) => {
    await pf.init();
    return pf;
  }));

let searchSeq = 0;

async function runSearch(term: string) {
  const seq = ++searchSeq;
  query = term.trim();
  limit = BATCH;
  if (!query) {
    results = null;
    render();
    return;
  }

  const pf = await loadPagefind();
  const search = await pf.search(query);
  const data = await Promise.all(search.results.slice(0, 100).map((r) => r.data()));
  if (seq !== searchSeq) return; // a newer keystroke won

  // Pagefind retries a query with no hits as ever-shorter prefixes ("xyzqq" → "x"), which
  // turns gibberish into unrelated results. Keep only pages that really contain every word.
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
  results = data
    .filter((d) => {
      const text = fold(`${d.meta.title} ${d.content}`).split(/[^a-z0-9]+/);
      return words.every((w) => text.some((t) => t.startsWith(w)));
    })
    .map((d) => bySlug.get(slugOf(new URL(d.url, location.origin).pathname)))
    .filter((c): c is HTMLAnchorElement => c !== undefined); // archived products have pages but no card

  render();
}

let debounce: number | undefined;
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = window.setTimeout(() => runSearch(input.value), 180);
});
input.addEventListener('focus', () => loadPagefind(), { once: true });
input.form?.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur(); // close the phone keyboard to show the results
});

function clearSearch() {
  input.value = '';
  runSearch('');
  input.focus();
}
clearBtn.addEventListener('click', clearSearch);
empty.querySelector('button')!.addEventListener('click', clearSearch);

// --- Categories -------------------------------------------------------------------------

chipButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    category = btn.dataset.category!;
    limit = BATCH;
    render();
    btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  })
);

grid.addEventListener('animationend', (e) => (e.target as HTMLElement).classList.remove('card-in'));

// --- Start ------------------------------------------------------------------------------

if (query) {
  input.value = query;
  runSearch(query);
} else {
  render({ animate: false });
  chipButtons.find((b) => b.classList.contains('active'))?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
