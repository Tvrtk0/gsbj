import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'src/content/products');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const CATEGORIES_DIR = path.join(ROOT, 'src/content/categories');

const CROATIAN_MAP = {
  č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd',
  Č: 'c', Ć: 'c', Š: 's', Ž: 'z', Đ: 'd',
};

function slugify(text) {
  return text
    .split('')
    .map((ch) => CROATIAN_MAP[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function downloadImage(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    return true;
  } catch (err) {
    console.error(`  Failed to download image: ${url} — ${err.message}`);
    return false;
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'gsbj-db-backup-2.json'), 'utf-8'));

  // Clean existing content
  for (const dir of [PRODUCTS_DIR, CATEGORIES_DIR]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  // Extract unique categories
  const categoryMap = new Map();
  for (const entry of data) {
    const cat = entry.category;
    if (!categoryMap.has(cat.id)) {
      const slug = slugify(cat.categoryName);
      categoryMap.set(cat.id, { name: cat.categoryName, slug });
    }
  }

  // Write category files
  for (const cat of categoryMap.values()) {
    const content = `name: '${cat.name}'\nslug: '${cat.slug}'\n`;
    fs.writeFileSync(path.join(CATEGORIES_DIR, `${cat.slug}.yaml`), content);
  }
  console.log(`Created ${categoryMap.size} categories`);

  // Process products
  let success = 0;
  let failed = 0;
  const usedSlugs = new Set();

  for (const entry of data) {
    const product = entry.product;
    const category = categoryMap.get(entry.category.id);

    let slug = slugify(product.name);
    if (!slug) slug = `product-${product.id}`;
    // Deduplicate slugs
    let finalSlug = slug;
    let counter = 2;
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }
    usedSlugs.add(finalSlug);

    // Download image
    let imagePath = '';
    if (product.imageUrl) {
      const ext = 'jpg';
      const imageFile = `${finalSlug}.${ext}`;
      const destPath = path.join(IMAGES_DIR, imageFile);
      const ok = await downloadImage(product.imageUrl, destPath);
      if (ok) {
        imagePath = `/gsbj/images/${imageFile}`;
      }
    }

    // Build markdown
    const description = (product.description || '').trim();
    const frontmatter = [
      '---',
      `name: '${product.name.replace(/'/g, "''")}'`,
      `price: ${product.price}`,
      `image: '${imagePath}'`,
      `category: '${category.slug}'`,
      `archive: ${product.archive || false}`,
      '---',
    ].join('\n');

    const md = `${frontmatter}\n${description}\n`;
    fs.writeFileSync(path.join(PRODUCTS_DIR, `${finalSlug}.md`), md);
    success++;

    if (success % 50 === 0) console.log(`  Processed ${success} products...`);
  }

  console.log(`\nDone! ${success} products migrated, ${failed} failed.`);
}

main();
