import { redirect } from 'next/navigation';

// Canonical route is /forgot-password — redirect here to avoid duplicate pages
export default function ForgotPasswordRedirect() {
  redirect('/forgot-password');
}
