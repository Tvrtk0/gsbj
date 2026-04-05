import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    price: z.number(),
    image: z.string(),
    category: z.string(),
    archive: z.boolean().default(false),
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/categories' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
  }),
});

const info = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/info' }),
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
});

export const collections = { products, categories, info };
