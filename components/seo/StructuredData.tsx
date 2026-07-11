const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

const softwareApplication = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Synthex',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: BASE_URL,
  description:
    'AI marketing operating system for campaign planning, creative production and approval-gated publishing.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'AUD',
    description: 'Controlled pilot access',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Synthex Pty Ltd',
    url: BASE_URL,
  },
};

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Synthex',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    'Evidence-backed marketing command center for agencies and in-house teams.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'AU',
  },
};

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: BASE_URL,
    },
  ],
};

export function HomeStructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplication),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumb),
        }}
      />
    </>
  );
}
