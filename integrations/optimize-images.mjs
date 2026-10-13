/**
 * Responsive WebP copies of the CMS's product photos.
 *
 * Photos live in public/images because that's where the CMS uploads them and how it writes
 * them into products, so Astro's <Image> can't process them. Instead, before pages render this
 * makes WIDTHS-wide WebP copies of each one into a cache, records them in a manifest that
 * src/lib/images.ts reads to build srcset, and copies them into dist/images/_w/ at the end.
 * The cache is keyed on each photo's content hash (mtimes change on every CI checkout), so only
 * new or changed photos are processed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, parse } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const WIDTHS = [320, 640, 960];
export const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache', 'gsbj-images');
export const MANIFEST = join(CACHE_DIR, 'manifest.json');
const SOURCE_DIR = join(process.cwd(), 'public', 'images');
const QUALITY = 78;

export default function optimizeImages() {
  return {
    name: 'optimize-images',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        mkdirSync(CACHE_DIR, { recursive: true });
        const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
        const manifest = {};
        let made = 0;
        let failed = 0;

        const files = readdirSync(SOURCE_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
        for (const file of files) {
          const key = createHash('sha1').update(readFileSync(join(SOURCE_DIR, file))).digest('hex');
          const cached = previous[file];
          if (cached?.key === key && cached.widths.every((w) => existsSync(join(CACHE_DIR, variantName(file, w))))) {
            manifest[file] = cached;
            continue;
          }
          try {
            const image = sharp(join(SOURCE_DIR, file));
            const { width = 0 } = await image.metadata();
            // Never upscale: a 500px photo gets 320 and its own 500, not a blurry 960
            const widths = [...new Set(WIDTHS.map((w) => Math.min(w, width)))].filter(Boolean);
            for (const w of widths) {
              await sharp(join(SOURCE_DIR, file))
                .rotate() // honour EXIF orientation from phone photos
                .resize({ width: w, withoutEnlargement: true })
                .webp({ quality: QUALITY })
                .toFile(join(CACHE_DIR, variantName(file, w)));
            }
            manifest[file] = { key, widths };
            made++;
          } catch (err) {
            // A photo sharp can't read is served as-is rather than failing the build
            logger.warn(`Skipping ${file}: ${err.message}`);
            failed++;
          }
        }

        writeFileSync(MANIFEST, JSON.stringify(manifest));
        logger.info(`${files.length} photos: ${made} optimised, ${files.length - made - failed} cached, ${failed} skipped`);
      },

      'astro:build:done': ({ dir }) => {
        const out = join(dir.pathname, 'images', '_w');
        mkdirSync(out, { recursive: true });
        const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
        for (const [file, { widths }] of Object.entries(manifest)) {
          for (const w of widths) cpSync(join(CACHE_DIR, variantName(file, w)), join(out, variantName(file, w)));
        }
      },
    },
  };
}

export const variantName = (file, width) => `${parse(file).name}-${width}.webp`;
