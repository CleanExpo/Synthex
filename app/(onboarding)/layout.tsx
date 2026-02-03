import { OnboardingProvider } from '@/components/onboarding';

/**
 * Onboarding Layout
 *
 * @description Wraps all onboarding pages with the onboarding provider
 */

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </div>
    </OnboardingProvider>
  );
}
