/**
 * Canonical 1Password account-reference inventory (SYN-1023).
 *
 * Single source of truth for which client orgs have a reference-only credential
 * item in 1Password, and which are still missing one. Both the importer
 * (`scripts/import-1password-synthex-account-references.ts`) and the read-only
 * coverage report (`scripts/verify-credential-references.ts`) consume this list
 * so the two can never drift.
 *
 * Reference-only: these entries point at 1Password items. They never contain a
 * secret value — the importer stores an encrypted *reference*, and the coverage
 * report reads only existence/metadata. Do not add secret values here.
 */

export type CredentialMapping = {
  orgSlug: string;
  provider: string;
  slug: string;
  name: string;
  vault: string;
  itemId: string;
  platforms?: string[];
  notes?: string;
};

export type CredentialSearchBlocker = {
  orgSlug: string;
  checkedQueries: string[];
  status: 'not_found_in_1password_inventory';
  checkedAt: string;
  actionRequired: string;
};

export const ACCOUNT_REFERENCE_MAPPINGS: CredentialMapping[] = [
  {
    orgSlug: 'carsi',
    provider: 'facebook',
    slug: 'onepassword-carsi-facebook-developer',
    name: '1Password Reference - CARSI Facebook Developer',
    vault: 'Carsi',
    itemId: 'wllmcdb4j7noqljmg47gmkrppq',
    platforms: ['facebook', 'instagram'],
    notes: 'Login reference only. OAuth app credentials must still be connected through the platform OAuth flow.',
  },
  {
    orgSlug: 'carsi',
    provider: 'linkedin',
    slug: 'onepassword-carsi-linkedin',
    name: '1Password Reference - CARSI LinkedIn',
    vault: 'Carsi',
    itemId: '6xxdyh6sz5qcscxowg6k2iqlge',
    platforms: ['linkedin'],
  },
  {
    orgSlug: 'carsi',
    provider: 'youtube',
    slug: 'onepassword-carsi-youtube-channel',
    name: '1Password Reference - CARSI YouTube Channel',
    vault: 'Carsi',
    itemId: 'li3bk3iaji2jmhkpfgmp2spfd4',
    platforms: ['youtube'],
  },
  {
    orgSlug: 'disaster-recovery',
    provider: 'facebook',
    slug: 'onepassword-disaster-recovery-facebook',
    name: '1Password Reference - Disaster Recovery Facebook',
    vault: 'Disaster-Recovery-NRPG',
    itemId: 'utszijmi3xejw4p4awhghkkhfy',
    platforms: ['facebook'],
  },
  {
    orgSlug: 'disaster-recovery',
    provider: 'facebook',
    slug: 'onepassword-disaster-recovery-facebook-business',
    name: '1Password Reference - Disaster Recovery Facebook Business',
    vault: 'Disaster-Recovery-NRPG',
    itemId: 't577qpncmju76jbwvu4nghob4a',
    platforms: ['facebook'],
  },
  {
    orgSlug: 'disaster-recovery',
    provider: 'linkedin',
    slug: 'onepassword-disaster-recovery-linkedin',
    name: '1Password Reference - Disaster Recovery LinkedIn',
    vault: 'Disaster-Recovery-NRPG',
    itemId: 'kxnjsgdxxrq6yz6q7sxy6ct4z4',
    platforms: ['linkedin'],
  },
  {
    orgSlug: 'disaster-recovery',
    provider: 'instagram',
    slug: 'onepassword-disaster-recovery-instagram',
    name: '1Password Reference - Disaster Recovery Instagram',
    vault: 'Disaster-Recovery-NRPG',
    itemId: '3lox6vagfwqtipq7pkybdznobe',
    platforms: ['instagram'],
  },
  {
    orgSlug: 'restoreassist',
    provider: 'youtube',
    slug: 'onepassword-restoreassist-youtube',
    name: '1Password Reference - RestoreAssist YouTube',
    vault: 'RestoreAssist',
    itemId: 'lzoytmqwrjrcofsvzpys3avtne',
    platforms: ['youtube'],
  },
  {
    orgSlug: 'unite-group',
    provider: 'synthex',
    slug: 'onepassword-unite-group-synthex-google-signin',
    name: '1Password Reference - Synthex Google Sign-In',
    vault: 'Employee',
    itemId: '76aomgtnjbzuixttx2uoshja4u',
    notes: 'Account reference for Synthex access. Existing item indicates Google Sign-In rather than a stored password.',
  },
];

/**
 * Orgs where no 1Password item was found, so Synthex cannot store a reference.
 * `checkedAt` is the static inventory-audit date (when the searches were run),
 * not the time a script happens to execute.
 */
export const CREDENTIAL_SEARCH_BLOCKERS: CredentialSearchBlocker[] = [
  {
    orgSlug: 'ccw',
    checkedQueries: ['ccw', 'carpet cleaners warehouse', 'carpet cleaners'],
    status: 'not_found_in_1password_inventory',
    checkedAt: '2026-06-16',
    actionRequired:
      'Add verified CCW social account items to 1Password before Synthex can store account-scoped references.',
  },
];
