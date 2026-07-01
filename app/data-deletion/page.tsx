import { generateMetadata } from '@/lib/seo/metadata';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Card } from '@/components/ui/card';
import {
  Trash2,
  Unlink,
  Mail,
  Clock,
  Database,
  CheckCircle,
  Shield,
} from '@/components/icons';

const whatWeDelete = [
  'The OAuth access and refresh tokens for the disconnected account',
  'The connected account profile we stored (Page ID/name, Instagram account ID/username)',
  'Cached engagement and insight metrics retrieved for that account',
  'Any drafts or scheduled posts targeting that account',
];

const methods = [
  {
    title: 'Disconnect a connected account (immediate)',
    icon: Unlink,
    content: [
      'Sign in to your Synthex account.',
      'Open Settings → Integrations (or the Platforms page).',
      'Find the platform you want removed (e.g. Facebook or Instagram) and select Disconnect.',
      'Synthex immediately revokes and deletes the stored access token and the connected-account data for that platform.',
    ],
  },
  {
    title: 'Delete your whole account and all data',
    icon: Trash2,
    content: [
      'Sign in to your Synthex account.',
      'Open Settings → Privacy (or Account).',
      'Select Delete Account and confirm.',
      'All connected-account data, tokens, and content are removed on the schedule below.',
    ],
  },
  {
    title: 'Request deletion by email',
    icon: Mail,
    content: [
      'If you cannot sign in, email privacy@synthex.social from the address on your account.',
      'Include the platform(s) you want removed (e.g. "Facebook Page" and/or "Instagram account").',
      'We confirm your identity, action the deletion, and reply once complete.',
    ],
  },
];

export const metadata = generateMetadata({
  title: 'Data Deletion Instructions',
  description:
    'How to delete the data Synthex holds, including data obtained from Facebook and Instagram via connected accounts. Disconnect a platform, delete your account, or request deletion by email.',
  path: '/data-deletion',
  keywords: [
    'data deletion',
    'delete my data',
    'Facebook data deletion',
    'Instagram data deletion',
    'revoke access',
    'GDPR',
  ],
});

export default function DataDeletionPage() {
  return (
    <MarketingLayout currentPage="data-deletion">
      {/* Hero */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto text-center">
          <Trash2 className="w-16 h-16 text-orange-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            Data{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              Deletion
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            You control the data Synthex holds. This page explains how to remove
            the information we store for your connected accounts — including
            data obtained from Facebook and Instagram — at any time.
          </p>
          <p className="text-gray-500 mt-4">Last updated: July 2026</p>
        </div>
      </section>

      {/* Meta note */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 border border-orange-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">
                Facebook &amp; Instagram data
              </h2>
            </div>
            <p className="text-gray-300">
              When you connect a Facebook Page or Instagram Business account,
              Synthex stores an access token and basic account details so it can
              publish content and report engagement on your behalf. To remove
              that data, disconnect the platform (fastest), delete your account,
              or email us — each method is described below. Disconnecting also
              revokes Synthex&apos;s access token with Meta.
            </p>
          </Card>
        </div>
      </section>

      {/* Methods */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {methods.map((method, index) => (
              <Card
                key={index}
                className="bg-surface-base/80 border border-orange-500/20 backdrop-blur-sm p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <method.icon className="w-8 h-8 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">
                    {method.title}
                  </h3>
                </div>
                <ol className="space-y-2 list-decimal list-inside">
                  {method.content.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-gray-300 marker:text-orange-400"
                    >
                      {item}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What we delete */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 border border-orange-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-8 h-8 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">What we delete</h2>
            </div>
            <div className="space-y-3">
              {whatWeDelete.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 border border-orange-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-8 h-8 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">Timeline</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                <span className="text-orange-400 font-semibold">
                  Immediate:
                </span>{' '}
                Disconnecting a platform revokes and deletes its access token
                and connected-account data straight away.
              </p>
              <p>
                <span className="text-orange-400 font-semibold">
                  Within 30 days:
                </span>{' '}
                Account deletion and email requests are actioned, and personal
                data is permanently removed from our active systems.
              </p>
              <p>
                <span className="text-orange-400 font-semibold">
                  Up to 90 days:
                </span>{' '}
                A limited set of records may be retained where required for
                legal or security compliance, then permanently deleted. See our{' '}
                <a
                  href="/privacy"
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  Privacy Policy
                </a>{' '}
                for details.
              </p>
              <p className="pt-2">
                Questions about a deletion request? Email{' '}
                <a
                  href="mailto:privacy@synthex.social"
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  privacy@synthex.social
                </a>
                .
              </p>
            </div>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
