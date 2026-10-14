import type { APIRoute, GetStaticPaths } from 'astro';
import { articlesOn, csv, csvResponse, currentArticles, fileName, publishedDays, zagrebToday } from '../../lib/cjenik';

/** One file per day for the last 30 days, each as that morning's list */
export const getStaticPaths = (() =>
  publishedDays().map((day) => ({ params: { file: fileName(day) }, props: { day } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const day = props.day as string;
  return csvResponse(csv(day === zagrebToday() ? currentArticles() : articlesOn(day)));
};
