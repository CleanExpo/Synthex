import prisma from '@/lib/prisma';

export interface BrandFragmentInput {
  businessName: string;
  vertical: string;
  primaryColour: string | null;
  secondaryColour: string | null;
  tone: string;
}

export function brandFragmentFromDna(b: BrandFragmentInput): string {
  const colours = [b.primaryColour, b.secondaryColour]
    .filter(Boolean)
    .join(' and ');
  const colourClause = colours ? `, brand colour accents of ${colours}` : '';
  return `In the visual style of ${b.businessName} (${b.vertical} brand, ${b.tone})${colourClause}`;
}

/** Load the brand fragment for an org; null when the org has no BrandDNA yet. */
export async function getBrandFragment(
  organizationId: string
): Promise<string | null> {
  // Schema: model BrandDNA — fields primaryColour, secondaryColour, brandVoice (Json)
  const dna = await prisma.brandDNA.findFirst({
    where: { organizationId },
    select: {
      businessName: true,
      vertical: true,
      primaryColour: true,
      secondaryColour: true,
      brandVoice: true,
    },
  });
  if (!dna) return null;
  const voice = dna.brandVoice as { tone?: string } | null;
  return brandFragmentFromDna({
    businessName: dna.businessName,
    vertical: dna.vertical,
    primaryColour: dna.primaryColour ?? null,
    secondaryColour: dna.secondaryColour ?? null,
    tone: voice?.tone ?? 'professional',
  });
}
