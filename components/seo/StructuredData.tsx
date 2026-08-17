import { landingFaqs } from '@/components/landing/premium/landing-faq-data';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

const softwareApplication = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Synthex',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: BASE_URL,
  description:
    'Evidence-backed marketing command center: free Opportunity Map, then approval-gated campaign planning and production.',
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

const faqPage = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: landingFaqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqPage),
        }}
      />
    </>
  );
}
