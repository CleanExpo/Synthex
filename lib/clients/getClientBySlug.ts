// SYN-512: Fetch client record from Supabase by slug
import { createClient } from '@supabase/supabase-js';

export interface ClientRecord {
  id: string;
  slug: string;
  name: string;
  url?: string | null;
  telephone?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postcode?: string | null;
  address_country: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  opening_hours_json?: string[] | null;
  description?: string | null;
  logo_url?: string | null;
  industry?: string | null;
}

export interface AuthorityScoreRecord {
  score: number;
  eeat_breakdown: {
    gbp_completeness?: number;
    review_velocity?: number;
    content_freshness?: number;
    backlink_signals?: number;
    schema_coverage?: number;
    social_proof?: number;
  };
  computed_at: string;
}

export async function getClientBySlug(
  slug: string,
): Promise<{ client: ClientRecord; latestScore: AuthorityScoreRecord | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error || !client) return null;

  // Fetch latest authority score
  const { data: scoreData } = await supabase
    .from('authority_scores')
    .select('score, eeat_breakdown, computed_at')
    .eq('client_id', client.id)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  return {
    client: client as ClientRecord,
    latestScore: scoreData as AuthorityScoreRecord | null,
  };
}

export async function getAllActiveClientSlugs(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('clients')
    .select('slug')
    .eq('active', true);

  return (data ?? []).map((r: { slug: string }) => r.slug);
}
