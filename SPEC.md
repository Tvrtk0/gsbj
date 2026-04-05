# SPEC.md — Gift Shop Bjelovar Website

## Project Overview

Static e-commerce-style website for a gift shop in Bjelovar, Croatia. The site advertises products and displays business info. There is **no payment system** and **no user accounts**. One editor manages all content via a CMS backed by GitHub.

---

## Tech Stack

| Layer          | Choice                                                 |
| -------------- | ------------------------------------------------------ |
| Framework      | Astro (static output only, no SSR)                     |
| UI             | Astro components + vanilla JS (no framework)           |
| Styling        | Tailwind CSS + CSS custom property design tokens       |
| CMS            | Sveltia CMS (GitHub backend, GitHub OAuth login)       |
| Content format | Markdown (products), YAML (categories, business info)  |
| Images         | Stored in Git repo (`src/content/products/images/`)    |
| Search         | Pagefind (build-time index)                            |
| Hosting        | Netlify free tier                                      |
| Analytics      | Deferred — will be added later (single script tag)     |
| SEO            | JSON-LD product schema, Open Graph, `@astrojs/sitemap` |

---

## Content Schema

### Products (`src/content/products/*.md`)

Each product is a Markdown file. The body is the description (plain text with line breaks, not rich HTML).

```yaml
# frontmatter
name: 'Ogledalo srce sa porukom' # string, required
slug: 'ogledalo-srce-sa-porukom' # string, auto-generated from name
price: 6.50 # number, EUR, display only
image: './images/ogledalo-srce.jpg' # single image, relative path
category: 'suveniri-i-pokloni' # string, references categories collection by slug
archive: false # boolean, default false — hides from storefront
```

```markdown
<!-- body = description -->

Personalizirano srce, preklopno ogledalo za unikatni poklon.
```

**Rules:**

- `category` must reference an existing category slug. Astro content schema (Zod) validates this at build time — broken references fail the build.
- `archive: true` products are excluded from all listing pages and search index but remain in the repo.
- One image per product. No gallery.
- No variants, no tags, no specs table, no featured flag, no sort order.
- Description is plain text with `\n` line breaks. No markdown formatting inside the body.

### Categories (`src/content/categories/*.yaml`)

Each category is a YAML file. The editor can add, rename, or delete categories from the CMS.

```yaml
name: 'Suveniri i pokloni' # string, required
slug: 'suveniri-i-pokloni' # string, auto-generated from name
```

**Rules:**

- Products reference categories by slug.
- If a category is deleted while products still reference it, the build fails (Zod validation). The editor must reassign products before deleting a category.
- Document this rule for the editor.

### Business Info (`src/content/info/general.yaml`) — Singleton

One YAML file, editor-managed via CMS.

```yaml
businessName: 'Gift Shop Bjelovar'
phone: '+385 ...'
email: 'info@example.com'
address: 'Ulica ..., Bjelovar, Hrvatska'
workingHours:
  - day: 'Ponedjeljak - Petak'
    hours: '09:00 - 17:00'
  - day: 'Subota'
    hours: '09:00 - 13:00'
  - day: 'Nedjelja'
    hours: 'Zatvoreno'
googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=...'
social:
  facebook: 'https://facebook.com/...'
  instagram: 'https://instagram.com/...'
aboutText: 'Kratki opis trgovine...'
```

---

## Pages & Routes

| Route              | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `/`                | Homepage — business intro, working hours, selection of products   |
| `/products`        | Full product catalog with client-side category filtering          |
| `/products/[slug]` | Product detail page (name, image, description, price, category)   |
| `/contact`         | Working hours, address, embedded map, phone, email, social links  |
| `/admin`           | Sveltia CMS panel (single `index.html` that loads Sveltia script) |

### Homepage (`/`)

- Business name + short about text
- Working hours
- Grid of products (latest or random selection — implementer's choice)
- Link to full catalog

### Product Listing (`/products`)

- Grid/list of all non-archived products
- Client-side category filter (vanilla JS): clicking a category shows/hides products via DOM manipulation or CSS classes. No framework needed.
- Pagefind search widget integrated on this page
- Show product card: image, name, price, category badge
- Clicking a card navigates to the detail page

### Product Detail (`/products/[slug]`)

- Full-size image
- Product name
- Price (formatted as EUR)
- Description (plain text, preserve line breaks)
- Category (linked back to filtered listing)
- JSON-LD structured data (see SEO section)
- Open Graph meta tags

### Contact (`/contact`)

- All fields from `general.yaml`
- Embedded Google Maps iframe
- Social media icon links

### Admin (`/admin`)

- Single HTML page loading Sveltia CMS from CDN
- Config at `/admin/config.yml`
- GitHub OAuth via Netlify Identity / Git Gateway

---

## Styling & Design System

### Design Tokens (CSS Custom Properties)

Define all tokens in `src/styles/global.css`. Tailwind references these via `theme.extend` in `tailwind.config.mjs`.

```css
:root {
  /* Define brand colors, spacing, radii, etc. */
  --color-primary: ...;
  --color-primary-foreground: ...;
  --color-secondary: ...;
  --color-secondary-foreground: ...;
  --color-background: ...;
  --color-foreground: ...;
  --color-muted: ...;
  --color-muted-foreground: ...;
  --color-accent: ...;
  --color-border: ...;
  --color-card: ...;
  --color-card-foreground: ...;
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
}
```

### Tailwind Config

Extend Tailwind to consume CSS custom properties:

```js
// tailwind.config.mjs
colors: {
  primary: "var(--color-primary)",
  "primary-foreground": "var(--color-primary-foreground)",
  // ... map all tokens
}
```

### General Styling Rules

- Mobile-first responsive design (mobile + desktop, no separate tablet layout)
- No component library — build all UI with Tailwind utility classes
- Keep interactive JS minimal: category filter, mobile nav toggle, Pagefind widget
- All interactive JS goes in `<script>` tags within Astro components (no framework)

---

## Search (Pagefind)

- Install `@pagefind/default-ui` and integrate with Astro build
- Pagefind indexes all product pages at build time
- Place search widget on `/products` page
- Archived products (`archive: true`) must be excluded from the index (they won't have generated pages, so this happens automatically)

---

## SEO

### JSON-LD (Product Pages)

Each `/products/[slug]` page includes a `<script type="application/ld+json">` block:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "...",
  "description": "...",
  "image": "...(absolute URL)...",
  "offers": {
    "@type": "Offer",
    "price": "6.50",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
}
```

- Set `availability` to `InStock` for non-archived, `Discontinued` for archived (though archived pages aren't generated, this is a safeguard).

### Open Graph & Twitter Meta

Every page gets:

```html
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="...(absolute URL)..." />
<meta property="og:url" content="..." />
<meta property="og:type" content="website" />
<!-- or "product" on product pages -->
<meta name="twitter:card" content="summary_large_image" />
```

Product pages use the product image; other pages use a default site OG image.

### Sitemap

- Use `@astrojs/sitemap` integration
- Configure `site` in `astro.config.mjs` with the production URL
- Archived products are excluded (no generated pages = not in sitemap)

### robots.txt

```
User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap-index.xml
```

---

## CMS Configuration (`/admin/config.yml`)

Sveltia CMS is a drop-in replacement for Decap CMS (Netlify CMS). The config file defines the backend, media storage, and content collections.

```yaml
backend:
  name: github
  repo: owner/repo-name
  branch: main

media_folder: 'src/content/products/images'
public_folder: '/src/content/products/images'

collections:
  - name: 'products'
    label: 'Products'
    folder: 'src/content/products'
    create: true
    slug: '{{slug}}'
    extension: 'md'
    fields:
      - { label: 'Name', name: 'name', widget: 'string', required: true }
      - { label: 'Price (EUR)', name: 'price', widget: 'number', value_type: 'float', required: true }
      - { label: 'Image', name: 'image', widget: 'image', required: true }
      - {
          label: 'Category',
          name: 'category',
          widget: 'relation',
          collection: 'categories',
          search_fields: ['name'],
          value_field: 'slug',
          display_fields: ['name'],
          required: true,
        }
      - { label: 'Archived', name: 'archive', widget: 'boolean', default: false }
      - { label: 'Description', name: 'body', widget: 'text' }

  - name: 'categories'
    label: 'Categories'
    folder: 'src/content/categories'
    create: true
    slug: '{{slug}}'
    extension: 'yaml'
    format: 'yaml'
    fields:
      - { label: 'Name', name: 'name', widget: 'string', required: true }
      - { label: 'Slug', name: 'slug', widget: 'string', required: true }

  - name: 'info'
    label: 'Business Info'
    files:
      - label: 'General Info'
        name: 'general'
        file: 'src/content/info/general.yaml'
        fields:
          - { label: 'Business Name', name: 'businessName', widget: 'string' }
          - { label: 'Phone', name: 'phone', widget: 'string' }
          - { label: 'Email', name: 'email', widget: 'string' }
          - { label: 'Address', name: 'address', widget: 'string' }
          - label: 'Working Hours'
            name: 'workingHours'
            widget: 'list'
            fields:
              - { label: 'Day', name: 'day', widget: 'string' }
              - { label: 'Hours', name: 'hours', widget: 'string' }
          - { label: 'Google Maps Embed URL', name: 'googleMapsEmbedUrl', widget: 'string' }
          - label: 'Social Links'
            name: 'social'
            widget: 'object'
            fields:
              - { label: 'Facebook', name: 'facebook', widget: 'string', required: false }
              - { label: 'Instagram', name: 'instagram', widget: 'string', required: false }
          - { label: 'About Text', name: 'aboutText', widget: 'text' }
```

**Important:** The CMS config field structure must mirror the Astro content collection schemas exactly. If they drift, either the CMS won't save correctly or the build will fail.

---

## Astro Content Collections (`src/content/config.ts`)

Define Zod schemas for build-time validation:

```typescript
import { defineCollection, z, reference } from 'astro:content'

const products = defineCollection({
  type: 'content', // markdown with frontmatter
  schema: z.object({
    name: z.string(),
    price: z.number(),
    image: z.string(),
    category: z.string(), // validated against categories collection
    archive: z.boolean().default(false),
  }),
})

const categories = defineCollection({
  type: 'data', // yaml
  schema: z.object({
    name: z.string(),
    slug: z.string(),
  }),
})

const info = defineCollection({
  type: 'data',
  schema: z.object({
    businessName: z.string(),
    phone: z.string(),
    email: z.string(),
    address: z.string(),
    workingHours: z.array(
      z.object({
        day: z.string(),
        hours: z.string(),
      })
    ),
    googleMapsEmbedUrl: z.string(),
    social: z.object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
    }),
    aboutText: z.string(),
  }),
})

export const collections = { products, categories, info }
```

**Build-time category validation:** After collections load, validate that every product's `category` field matches an existing category slug. Fail the build with a clear error message if not.

---

## Project Structure

```
/
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── admin/
│       └── index.html          # Sveltia CMS entry point
├── src/
│   ├── content/
│   │   ├── config.ts           # Astro content collection schemas
│   │   ├── products/
│   │   │   ├── images/         # Product images stored here
│   │   │   ├── ogledalo-srce-sa-porukom.md
│   │   │   └── upaljac-na-benzin.md
│   │   ├── categories/
│   │   │   ├── suveniri-i-pokloni.yaml
│   │   │   └── upaljaci.yaml
│   │   └── info/
│   │       └── general.yaml
│   ├── layouts/
│   │   └── BaseLayout.astro    # HTML shell, meta tags, nav, footer
│   ├── components/
│   │   ├── ProductCard.astro
│   │   ├── ProductGrid.astro
│   │   ├── CategoryFilter.astro
│   │   ├── WorkingHours.astro
│   │   ├── MapEmbed.astro
│   │   ├── SocialLinks.astro
│   │   ├── MobileNav.astro
│   │   ├── SearchWidget.astro
│   │   └── SEO.astro           # Reusable OG/JSON-LD head component
│   ├── pages/
│   │   ├── index.astro
│   │   ├── products/
│   │   │   ├── index.astro     # Product listing
│   │   │   └── [slug].astro    # Product detail (dynamic route)
│   │   └── contact.astro
│   └── styles/
│       └── global.css          # Design tokens + Tailwind imports
├── admin/
│   └── config.yml              # Sveltia CMS configuration
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── SPEC.md                     # This file
```

---

## Migration Script

A Node.js script to migrate data from the old Spring Boot API to static content files.

**Source:** `gsbj-db-backup.json` and `gsbj-db-backup-2` files

**What the script does:**

1. Fetch all products from the API (paginated)
2. Fetch all categories from `/api/product-category`
3. For each category: create `src/content/categories/{slug}.yaml`
4. For each product:
   - Download image from `ucarecdn.com` URL → save to `src/content/products/images/{slug}.jpg`
   - Generate slug from product name (transliterate Croatian characters)
   - Create `src/content/products/{slug}.md` with frontmatter + description body
5. Log summary: products migrated, categories created, any failures

**Slug generation:** Transliterate Croatian characters (č→c, ć→c, š→s, ž→z, đ→d), lowercase, replace spaces with hyphens, remove special characters.

**Script location:** `scripts/migrate.js` (not part of the built site)

---

## Deployment (Netlify)

### Build Configuration

- **Build command:** `astro build`
- **Publish directory:** `dist`
- **Node version:** 18+ (set in `.nvmrc` or Netlify UI)

### OAuth Setup for Sveltia CMS

1. Register a GitHub OAuth App (Settings → Developer settings → OAuth Apps)
2. Set callback URL to Netlify's auth endpoint
3. Enable Netlify Identity or use an external OAuth proxy
4. Configure in Sveltia CMS backend settings

### Free Tier Limits (safe for this project)

- 100GB bandwidth/month — static site with optimized images will use <5GB
- 300 build minutes/month — Astro builds take ~1-2 min, safe even with daily edits
- 10GB storage — few hundred products with images ≈ 100-500MB

---

## Build Phases (Implementation Order)

1. **Scaffold** — Init Astro project, install Tailwind, configure design tokens in `global.css`, create `BaseLayout.astro` with nav/footer
2. **Content schemas** — Define Astro content collections in `config.ts`, create folder structure, add 2-3 sample products and categories manually for testing
3. **CMS** — Add `/admin/index.html` and `config.yml`, set up GitHub OAuth via Netlify, verify creating/editing a product from the CMS commits to repo
4. **Pages** — Build homepage, product listing with category filter (vanilla JS), product detail with dynamic routes, contact page with map
5. **Search** — Integrate Pagefind, add search widget to product listing page
6. **SEO** — Add JSON-LD to product pages, Open Graph meta to all pages, install `@astrojs/sitemap`, add `robots.txt`
7. **Migration** — Write and run `scripts/migrate.js` to pull all products from old API
8. **Deploy** — Connect repo to Netlify, configure build settings, verify CMS OAuth in production, set up custom domain

---

## Editor Documentation Notes

Document these rules for the content editor:

1. **Deleting categories:** Always reassign all products to another category before deleting. If you delete a category that products still use, the site build will fail and changes won't go live.
2. **Archiving products:** Toggle the "Archived" switch to hide a product from the site. The product stays in the repo and can be un-archived later.
3. **Images:** Upload one image per product through the CMS. Keep images under 1MB for fast loading (the build will optimize them).
4. **Working hours:** Edit via Business Info in the CMS. Each entry is a day/range + hours pair.
5. **Social links:** Leave blank to hide the icon from the site.
