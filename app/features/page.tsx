import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  ImageIcon,
  Mic,
  Search,
  Shield,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageCtaBand,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'Platform | Synthex',
  description:
    'Explore Synthex command-center features for market research, campaign planning, Gen Media production, approvals and ROI learning.',
};

const featureCards = [
  {
    icon: Mic,
    eyebrow: 'Input',
    title: 'Capture the idea',
    copy: 'Start from a voice note, meeting transcript, product thought or rough campaign brief.',
    points: [
      'Voice and text intake',
      'Business context attached',
      'No blank content form',
    ],
  },
  {
    icon: Search,
    eyebrow: 'Research',
    title: 'Ground the plan',
    copy: 'Connect the idea to evidence before creative work starts.',
    points: [
      'Search and social signals',
      'Competitor and audience notes',
      'Confidence and open questions',
    ],
  },
  {
    icon: ImageIcon,
    eyebrow: 'Assets',
    title: 'Choose what gets made',
    copy: 'Review cards for the assets that matter instead of navigating disconnected tools.',
    points: ['Website pages', 'Lead magnets', 'Thumbnails, emails and video'],
  },
  {
    icon: Shield,
    eyebrow: 'Approval',
    title: 'Keep control',
    copy: 'Claims, spend, publishing and licensed media stay blocked until the approval gate is clear.',
    points: ['Human review', 'Licensing checks', 'No hidden publishing'],
  },
  {
    icon: BarChart3,
    eyebrow: 'Learning',
    title: 'Improve the next campaign',
    copy: 'Outcomes become signal for the next card set, not a report that gets forgotten.',
    points: ['Views, clicks and leads', 'Channel notes', 'Next action cards'],
  },
];

export default function FeaturesPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Product"
          title={
            <>
              Features should feel like{' '}
              <PublicGradientText>cards, not a maze</PublicGradientText>.
            </>
          }
          description="Synthex is easiest to understand as five steps: capture the idea, ground the plan, choose assets, approve production and learn from the outcome."
        >
          <Button asChild variant="premium-primary" size="lg">
            <Link href="/opportunity-map">
              Build my free map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="glass-secondary" size="lg">
            <Link href="/pricing">Request a pilot</Link>
          </Button>
        </PublicPageHero>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          eyebrow="Command center"
          title="Five steps. One operating layer."
          description="Each card carries evidence, approval state and next action — so teams can review before anything goes live."
        >
          <ol className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((group, index) => (
              <li key={group.title} className="min-w-0">
                <PublicPageCard {...group} index={index} />
              </li>
            ))}
          </ol>
        </PublicPageSection>

        <PublicGovernanceStrip />

        <PublicPageCtaBand
          title="Built for controlled launch, then scale."
          description="The interface stays simple while the work behind it stays serious: every card can carry evidence, approval state, production cost and next action."
          href="/pricing"
          label="Request a pilot"
        />
      </PublicPageFrame>
    </SiteShell>
  );
}
