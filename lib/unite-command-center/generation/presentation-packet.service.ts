import type { CommandPacket } from '../ontology/command-ontology.schema';

export interface PresentationSlidePacket {
  index: number;
  title: string;
  objective: string;
  evidenceRefs: string[];
  maxTitleChars: number;
}

export interface PresentationPacket {
  title: string;
  state: 'draft' | 'blocked';
  approvalGate: CommandPacket['approvalGate'];
  slides: PresentationSlidePacket[];
  qaFindings: string[];
}

export function createPresentationPacket(input: {
  commandPacket: CommandPacket;
  evidenceRefs: string[];
}): PresentationPacket {
  const qaFindings: string[] = [];
  if (input.evidenceRefs.length === 0) qaFindings.push('missing_evidence');
  if (input.commandPacket.approvalGate === 'production_blocked') {
    qaFindings.push('production_gate_blocked');
  }

  const slides = [
    {
      title: safeSlideTitle(input.commandPacket.title),
      objective: 'Frame the request, audience, and desired outcome.',
    },
    {
      title: 'Evidence map',
      objective: 'Show source links, product context, and decision confidence.',
    },
    {
      title: 'Recommended draft path',
      objective: 'Show the safest next action before production work starts.',
    },
  ].map((slide, index) => ({
    index: index + 1,
    title: slide.title,
    objective: slide.objective,
    evidenceRefs: [...input.evidenceRefs],
    maxTitleChars: 64,
  }));

  return {
    title: safeSlideTitle(input.commandPacket.title),
    state: qaFindings.length === 0 ? 'draft' : 'blocked',
    approvalGate: input.commandPacket.approvalGate,
    slides,
    qaFindings,
  };
}

function safeSlideTitle(title: string): string {
  return title.length > 64 ? `${title.slice(0, 61).trim()}...` : title;
}
