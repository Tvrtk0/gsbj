import { existsSync, readFileSync } from 'node:fs';
import { join, parse } from 'node:path';

/**
 * src/srcset for a product photo, using the WebP copies integrations/optimize-images.mjs makes
 * at build time. In dev (no copies are made) or for a photo it skipped, it's the original.
 */

type Manifest = Record<string, { widths: number[] }>;

const MANIFEST = join(process.cwd(), 'node_modules', '.cache', 'gsbj-images', 'manifest.json');
let manifest: Manifest | undefined;
const loadManifest = (): Manifest =>
  (manifest ??= !import.meta.env.DEV && existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {});

/** Display widths to pick from, for `sizes` */
export const SIZES = {
  // 2 columns on phones, 3 on tablets, 4 × ~270px on desktop
  card: '(min-width: 1024px) 270px, (min-width: 768px) 33vw, 50vw',
  // half of the max-w-5xl detail layout from md up
  detail: '(min-width: 1024px) 460px, (min-width: 768px) 45vw, 100vw',
  // desktop-only hero collage tiles
  hero: '(min-width: 1024px) 280px, 1px',
};

export function responsiveImage(src: string): { src: string; srcset?: string } {
  const file = decodeURIComponent(src.split('/').pop() ?? '');
  const entry = loadManifest()[file];
  if (!entry) return { src };

  const dir = src.slice(0, src.lastIndexOf('/') + 1);
  const name = encodeURIComponent(parse(file).name); // spaces or commas would break srcset
  const url = (w: number) => `${dir}_w/${name}-${w}.webp`;
  const widths = entry.widths;
  return {
    src: url(widths[Math.min(1, widths.length - 1)]),
    srcset: widths.map((w) => `${url(w)} ${w}w`).join(', '),
  };
}
