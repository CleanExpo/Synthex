import Link from 'next/link';
import { ChevronRight } from '@/components/icons';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const fullItems = [{ name: 'Home', href: '/' }, ...items];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: fullItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        {fullItems.map((item, index) => (
          <span key={item.href} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
            {index === fullItems.length - 1 ? (
              <span className="text-gray-300">{item.name}</span>
            ) : (
              <Link href={item.href} className="hover:text-cyan-400 transition-colors">
                {item.name}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
