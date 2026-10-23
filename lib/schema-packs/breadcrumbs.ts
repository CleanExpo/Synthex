import type { JsonLd } from './types';

export interface Crumb {
  name: string;
  url: string;
}

export function buildBreadcrumbList(trail: Crumb[]): JsonLd {
  if (trail.length === 0) {
    throw new Error('A breadcrumb trail needs at least one item');
  }
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
