import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://mekatanker.shop';
  const routes = ['', '/how-it-works', '/pricing', '/about', '/contact', '/terms', '/privacy'];
  return routes.map((r) => ({ url: `${base}${r}/`, lastModified: new Date() }));
}
