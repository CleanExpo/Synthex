export type ProviderMode = 'mock' | 'live';

export type GateStatus = 'pass' | 'warn' | 'blocked';

export interface SourceRef {
  id: string;
  label: string;
  url?: string;
  path?: string;
  verifiedAt: string;
}

export interface ClientBrandProfile {
  id: string;
  slug: string;
  displayName: string;
  legalName?: string;
  websiteUrl: string;
  primaryAudience: string;
  secondaryAudience: string;
  voiceRules: string[];
  forbiddenClaims: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface ProductProfile {
  id: string;
  name: string;
  primaryOffer: string;
  valueProposition: string;
  proofPoints: string[];
  blockedClaims: string[];
}

export interface BuyerPersona {
  id: string;
  name: string;
  platformPriority: string;
  coreProblem: string;
  messageAngle: string;
  proofNeeded: string[];
  primaryCta: string;
}

export interface CampaignFixture {
  clientBrand: ClientBrandProfile;
  productProfile: ProductProfile;
  personas: BuyerPersona[];
  sourceRefs: SourceRef[];
}

export type ClaimType =
  | 'factual'
  | 'outcome'
  | 'comparative'
  | 'subjective'
  | 'testimonial'
  | 'future-looking';

export interface CampaignClaim {
  id: string;
  text: string;
  type: ClaimType;
  evidenceRefs: string[];
}

export type LicenceStatus = 'unknown' | 'pending' | 'licensed' | 'rejected' | 'expired';

export interface CampaignAsset {
  id: string;
  assetType: 'image' | 'video' | 'audio' | 'voice' | 'generated';
  provider: string;
  providerAssetId?: string;
  sourceUrl?: string;
  licenceStatus: LicenceStatus;
}

export interface GateResult {
  status: GateStatus;
  blockedReasons: string[];
  warnings: string[];
}

export interface BoardMemo {
  campaignObjective: string;
  targetPersona: string;
  creativeStrategy: string;
  evidenceGaps: string[];
  finalBoardDecision: 'draft' | 'blocked' | 'client-ready';
}

export interface StoryboardScene {
  index: number;
  startSec: number;
  endSec: number;
  onScreenText: string;
  voiceover: string;
  visualNote: string;
}

export interface CampaignStoryboard {
  id: string;
  title: string;
  channel: string;
  targetPersona: string;
  strategy: string;
  primaryFormat: '16:9' | '9:16' | '4:5' | '1:1';
  audioDirection: string;
  callToAction: string;
  rankingRationale: string[];
  testHypothesis: string;
  durationSec: number;
  scenes: StoryboardScene[];
}

export interface ExportManifest {
  campaignId: string;
  formats: string[];
  assets: CampaignAsset[];
  blockedReasons: string[];
}

export interface MockCampaignPackage {
  campaignId: string;
  providerMode: ProviderMode;
  boardMemo: BoardMemo;
  personas: BuyerPersona[];
  storyboards: CampaignStoryboard[];
  qa: import('./qa').CampaignQaResult;
  exportManifest: ExportManifest;
}
