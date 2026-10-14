import type { APIRoute } from 'astro';
import { csv, csvResponse, currentArticles } from '../lib/cjenik';

/** Stable link to today's price list (NN 101/2026); dated copies live under /cjenik/ */
export const GET: APIRoute = () => csvResponse(csv(currentArticles()));
