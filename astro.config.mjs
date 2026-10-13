import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import optimizeImages from './integrations/optimize-images.mjs';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const base = '/gsbj/';

/**
 * Pagefind only builds its search index after `astro build`, so `astro dev` has no search.
 * In dev, serve the index from the last build (dist/pagefind) so search works there too.
 */
function pagefindInDev() {
  const root = join(process.cwd(), 'dist', 'pagefind');
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  return {
    name: 'pagefind-in-dev',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Astro may or may not have stripped the base by the time this runs
        const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const match = path.match(new RegExp(`^(?:${base.slice(0, -1)})?/pagefind(/.*)$`));
        if (!match) return next();
        const file = normalize(join(root, match[1]));
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  site: 'https://tvrtk0.github.io',
  base,
  output: 'static',
  integrations: [sitemap(), optimizeImages()],
  // Self-hosted from the installed Fontsource packages, latin + latin-ext only (all Croatian
  // needs: č ć š ž đ are latin-ext). Astro generates metric-matched fallback faces, so text
  // doesn't reflow (layout shift) when the web font swaps in, and preloads the files.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
        {
          src: ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'],
          weight: '100 900',
          style: 'normal',
          unicodeRange: ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F', 'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD'],
        },
        {
          src: ['@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'],
          weight: '100 900',
          style: 'normal',
          unicodeRange: ['U+0100-02BA', 'U+02BD-02C5', 'U+02C7-02CC', 'U+02CE-02D7', 'U+02DD-02FF', 'U+0304', 'U+0308', 'U+0329', 'U+1D00-1DBF', 'U+1E00-1E9F', 'U+1EF2-1EFF', 'U+2020', 'U+20A0-20AB', 'U+20AD-20C0', 'U+2113', 'U+2C60-2C7F', 'U+A720-A7FF'],
        },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['serif'],
      options: {
        variants: [
        {
          src: ['@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2'],
          weight: '100 900',
          style: 'normal',
          unicodeRange: ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F', 'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD'],
        },
        {
          src: ['@fontsource-variable/fraunces/files/fraunces-latin-ext-wght-normal.woff2'],
          weight: '100 900',
          style: 'normal',
          unicodeRange: ['U+0100-02BA', 'U+02BD-02C5', 'U+02C7-02CC', 'U+02CE-02D7', 'U+02DD-02FF', 'U+0304', 'U+0308', 'U+0329', 'U+1D00-1DBF', 'U+1E00-1E9F', 'U+1EF2-1EFF', 'U+2020', 'U+20A0-20AB', 'U+20AD-20C0', 'U+2113', 'U+2C60-2C7F', 'U+A720-A7FF'],
        },
        ],
      },
    },
  ],
  vite: {
    plugins: [tailwindcss(), pagefindInDev()],
  },
});
