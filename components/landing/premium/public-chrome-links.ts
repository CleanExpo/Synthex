/**
 * Public chrome links — header and footer only.
 *
 * Header is the visitor job list: get the map, understand the product,
 * check the gates, talk to the team. Footer carries the rest.
 * Intentionally omitted: Dashboard, MCP add-ons, docs, blog, careers.
 */

export const headerNavLinks = [
  { href: '/opportunity-map', label: 'Free map' },
  { href: '/features', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
] as const;

export const accountLink = { href: '/login', label: 'Log in' } as const;

export const footerLinkColumns = [
  {
    title: 'Product',
    links: [
      { href: '/opportunity-map', label: 'Free map' },
      { href: '/features', label: 'Product' },
      { href: '/security', label: 'Security' },
      { href: '/pricing', label: 'Request a pilot' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About Synthex' },
      { href: '/contact', label: 'Contact' },
      { href: '/login', label: 'Log in' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
] as const;
