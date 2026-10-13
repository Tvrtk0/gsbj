import { defineConfig } from 'astro/config';
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
  vite: {
    plugins: [tailwindcss(), pagefindInDev()],
  },
});
