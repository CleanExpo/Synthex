import { generateMetadata } from '@/lib/seo/metadata';
import ForgotPasswordClient from './ForgotPasswordClient';

export const metadata = generateMetadata({
  title: 'Forgot Password',
  description: 'Reset your Synthex account password.',
  path: '/forgot-password',
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
