import { generateMetadata } from '@/lib/seo/metadata';
import ContactClient from './ContactClient';

export const metadata = generateMetadata({
  title: 'Contact Synthex',
  description:
    'Get in touch with the Synthex team. Book a demo, ask a question, or get support for your AI marketing platform.',
  path: '/contact',
  keywords: ['contact Synthex', 'book a demo', 'marketing automation support'],
});

export default function ContactPage() {
  return <ContactClient />;
}
