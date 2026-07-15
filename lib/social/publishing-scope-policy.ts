type ScopeRequirement = string | string[];

const PUBLISH_SCOPE_REQUIREMENTS: Record<string, ScopeRequirement[]> = {
  facebook: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
  instagram: [
    ['instagram_basic', 'instagram_business_basic'],
    ['instagram_content_publish', 'instagram_business_content_publish'],
    'pages_show_list',
    'pages_read_engagement',
  ],
  // Accept EITHER member-feed posting (w_member_social, the default granted
  // scope) OR company-page posting (w_organization_social). createPost picks the
  // author URN by connection type (person vs numeric org id), so both are valid
  // publish paths. Previously this hard-required w_organization_social, which
  // blocked every default connect (member scope only) at the publish gate.
  linkedin: [['w_member_social', 'w_organization_social']],
  youtube: ['https://www.googleapis.com/auth/youtube.upload'],
  reddit: ['submit'],
  twitter: ['tweet.write'],
  pinterest: ['pins:write'],
  tiktok: ['video.upload'],
  threads: ['threads_content_publish'],
};

export type PublishingScopeCheck = {
  ok: boolean;
  required: string[];
  granted: string[];
  missing: string[];
};

export function parseOAuthScope(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function requirementLabel(requirement: ScopeRequirement): string {
  return Array.isArray(requirement) ? requirement.join('|') : requirement;
}

export function checkPublishingScopes(
  platform: string,
  scope: string | null | undefined
): PublishingScopeCheck {
  const granted = parseOAuthScope(scope);
  const grantedSet = new Set(granted);
  const requirements = PUBLISH_SCOPE_REQUIREMENTS[platform] ?? [];
  const missing = requirements
    .filter(requirement =>
      Array.isArray(requirement)
        ? !requirement.some(option => grantedSet.has(option))
        : !grantedSet.has(requirement)
    )
    .map(requirementLabel);

  return {
    ok: missing.length === 0,
    required: requirements.map(requirementLabel),
    granted,
    missing,
  };
}

