import type { APIRoute, GetStaticPaths } from 'astro';
import { csv, csvResponse, currentProducts, fileName, productsOn, publishedDays } from '../../lib/cjenik';
import { zagrebDate } from '../../lib/priceHistory';

/** One file per day for the last 30 days, each as that morning's list */
export const getStaticPaths = (() =>
  publishedDays().map((day) => ({ params: { file: fileName(day) }, props: { day } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const day = props.day as string;
  const products = day === zagrebDate(new Date()) ? await currentProducts() : productsOn(day);
  return csvResponse(csv(products));
};
