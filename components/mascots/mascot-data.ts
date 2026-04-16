/**
 * Mascot Data — SYN-646
 *
 * Single source of truth for all 24 Synthex board personas used as
 * in-app mascots. Mirrors persona-manifest.json but typed for
 * React usage.
 *
 * PNG assets live in public/mascots/{filename}.
 * If an asset is missing the MascotAvatar falls back to initials.
 */

export type MascotId =
  | 'ceo'
  | 'senior-pm'
  | 'moonshot'
  | 'algorithm-engineer'
  | 'technical'
  | 'qa-engineer'
  | 'security-engineer'
  | 'ai-ml-engineer'
  | 'database-engineer'
  | 'frontend-engineer'
  | 'bigdata-architect'
  | 'api-reliability-engineer'
  | 'devops-engineer'
  | 'systems-architect'
  | 'infosec-compliance'
  | 'mobile-engineer'
  | 'cmo'
  | 'social-pr-director'
  | 'market'
  | 'oracle'
  | 'compounder'
  | 'contrarian'
  | 'product'
  | 'revenue';

export interface MascotPersona {
  id: MascotId;
  name: string;
  title: string;
  filename: string;
  colour: string;
  initials: string;
  /** Short contextual tip shown in sidebar / card quotes */
  tipText: string;
}

export const MASCOTS: Record<MascotId, MascotPersona> = {
  ceo: {
    id: 'ceo',
    name: 'Steve',
    title: 'CEO',
    filename: 'ceo-steve.png',
    colour: '#F59E0B',
    initials: 'ST',
    tipText:
      'Every metric you track is a signal. The skill is knowing which ones drive the business forward.',
  },
  'senior-pm': {
    id: 'senior-pm',
    name: 'Senior PM',
    title: 'Senior Project Manager',
    filename: 'senior-pm.png',
    colour: '#2563EB',
    initials: 'PM',
    tipText:
      'A clear schedule is the foundation of consistent growth. Gaps in posting are gaps in momentum.',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Charlie',
    title: 'Moonshot Engineer',
    filename: 'moonshot-charlie.png',
    colour: '#22C55E',
    initials: 'CH',
    tipText:
      'The best content ideas feel slightly uncomfortable. That discomfort is the gap between you and your competition.',
  },
  'algorithm-engineer': {
    id: 'algorithm-engineer',
    name: 'Algorithm Engineer',
    title: 'Lead Algorithm & Debugging Engineer',
    filename: 'algorithm-engineer.png',
    colour: '#EC4899',
    initials: 'AE',
    tipText:
      'Algorithms reward consistency and context. Post at the right time, in the right format, with the right signals.',
  },
  technical: {
    id: 'technical',
    name: 'Baxter',
    title: 'Senior Cloud & Systems Architect',
    filename: 'technical-baxter.png',
    colour: '#84CC16',
    initials: 'BX',
    tipText:
      'Connect your platforms once. Synthex handles the rest — scheduling, publishing, and performance tracking automatically.',
  },
  'qa-engineer': {
    id: 'qa-engineer',
    name: 'QA Engineer',
    title: 'Lead QA & Testing Engineer',
    filename: 'qa-engineer.png',
    colour: '#E5E7EB',
    initials: 'QA',
    tipText:
      'Something went wrong — but we caught it. Check the details below and try again.',
  },
  'security-engineer': {
    id: 'security-engineer',
    name: 'Security Engineer',
    title: 'Senior Cybersecurity Engineer',
    filename: 'security-engineer.png',
    colour: '#7C3AED',
    initials: 'SE',
    tipText:
      'Your account security is our top priority. Verify your credentials to continue.',
  },
  'ai-ml-engineer': {
    id: 'ai-ml-engineer',
    name: 'AI/ML Engineer',
    title: 'Lead AI & Machine Learning Engineer',
    filename: 'ai-ml-engineer.png',
    colour: '#06B6D4',
    initials: 'AI',
    tipText:
      'The AI is thinking… Analysing your data to generate the most relevant insights.',
  },
  'database-engineer': {
    id: 'database-engineer',
    name: 'Database Engineer',
    title: 'Lead Database & Performance Engineer',
    filename: 'database-engineer.png',
    colour: '#DC2626',
    initials: 'DB',
    tipText:
      'Every action you take builds your performance history. More data means smarter recommendations.',
  },
  'frontend-engineer': {
    id: 'frontend-engineer',
    name: 'Frontend Engineer',
    title: 'Lead Front-End UI/UX Engineer',
    filename: 'frontend-engineer.png',
    colour: '#F87171',
    initials: 'FE',
    tipText:
      'Great design makes great content easier to create. Everything here is built around your workflow.',
  },
  'bigdata-architect': {
    id: 'bigdata-architect',
    name: 'Big Data Architect',
    title: 'Lead Big Data & Analytics Architect',
    filename: 'bigdata-architect.png',
    colour: '#14B8A6',
    initials: 'BD',
    tipText:
      'Patterns in your data tell the story your gut already suspects. Let the numbers confirm it.',
  },
  'api-reliability-engineer': {
    id: 'api-reliability-engineer',
    name: 'API Engineer',
    title: 'Lead API Integrations & Reliability Engineer',
    filename: 'api-reliability-engineer.png',
    colour: '#EAB308',
    initials: 'AP',
    tipText:
      'Reliable integrations mean your content always reaches every platform on time, every time.',
  },
  'devops-engineer': {
    id: 'devops-engineer',
    name: 'DevOps Engineer',
    title: 'Lead DevOps & Deployment Engineer',
    filename: 'devops-engineer.png',
    colour: '#34D399',
    initials: 'DO',
    tipText:
      "Synthex runs 24/7 so you don't have to. Your pipeline is live and processing in the background.",
  },
  'systems-architect': {
    id: 'systems-architect',
    name: 'Systems Architect',
    title: 'Lead Systems Architecture Engineer',
    filename: 'systems-architect.png',
    colour: '#1D4ED8',
    initials: 'SA',
    tipText:
      'The infrastructure behind your marketing is as important as the marketing itself. Both are handled.',
  },
  'infosec-compliance': {
    id: 'infosec-compliance',
    name: 'InfoSec & Compliance',
    title: 'Lead Information Security & Compliance Engineer',
    filename: 'infosec-compliance.png',
    colour: '#8B5CF6',
    initials: 'IS',
    tipText:
      "Your data is encrypted, backed up, and compliant. Focus on growing your business — we've got the rest.",
  },
  'mobile-engineer': {
    id: 'mobile-engineer',
    name: 'Mobile Engineer',
    title: 'Lead Mobile & App Ecosystem Engineer',
    filename: 'mobile-engineer.png',
    colour: '#4ADE80',
    initials: 'ME',
    tipText:
      'Synthex works on every screen. Manage your content from wherever your business takes you.',
  },
  cmo: {
    id: 'cmo',
    name: 'CMO',
    title: 'Chief Marketing Officer',
    filename: 'cmo.png',
    colour: '#EA580C',
    initials: 'CM',
    tipText:
      'A campaign without a clear goal is just noise. Define the outcome first, then build backwards.',
  },
  'social-pr-director': {
    id: 'social-pr-director',
    name: 'Social PR Director',
    title: 'Lead Social Media & PR Director',
    filename: 'social-pr-director.png',
    colour: '#EC4899',
    initials: 'SP',
    tipText:
      'Every post is a conversation starter. The best content invites a reply, a share, or an action.',
  },
  market: {
    id: 'market',
    name: 'Kylie',
    title: 'Lead Market Strategist',
    filename: 'market-kylie.png',
    colour: '#D97706',
    initials: 'KY',
    tipText:
      'The market rewards businesses that show up with authority. Your analytics are your proof of authority.',
  },
  oracle: {
    id: 'oracle',
    name: 'Lily',
    title: 'The Oracle — Chief Futurist',
    filename: 'oracle-lily.png',
    colour: '#4338CA',
    initials: 'LI',
    tipText:
      "The businesses that win in AI search aren't the biggest — they're the most clearly described.",
  },
  compounder: {
    id: 'compounder',
    name: 'Bruce',
    title: 'The Compounder — CFO & VP of Scalability',
    filename: 'compounder-bruce.png',
    colour: '#166534',
    initials: 'BR',
    tipText:
      'Marketing ROI compounds. Every post you publish today adds to an asset that works for you tomorrow.',
  },
  contrarian: {
    id: 'contrarian',
    name: 'Gary',
    title: 'The Contrarian — Chief Risk Officer',
    filename: 'contrarian-gary.png',
    colour: '#374151',
    initials: 'GY',
    tipText:
      'Before you post, ask: is this the best version of this idea? Good enough is the enemy of memorable.',
  },
  product: {
    id: 'product',
    name: 'Clara',
    title: 'Chief Product Officer',
    filename: 'product-clara.png',
    colour: '#D946EF',
    initials: 'CL',
    tipText:
      'Start with what your customers are searching for. Everything else follows from that.',
  },
  revenue: {
    id: 'revenue',
    name: 'Paul',
    title: 'Chief Revenue Officer',
    filename: 'revenue-paul.png',
    colour: '#2563EB',
    initials: 'PL',
    tipText:
      'Visibility drives enquiries. Enquiries drive revenue. Every Synthex action moves you forward on that chain.',
  },
};

export const MASCOT_LIST = Object.values(MASCOTS);
