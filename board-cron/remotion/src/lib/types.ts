/** Types for Synthex Board Session Remotion compositions */

export interface ScriptScene {
  id: string;
  type:
    | 'title_card'
    | 'narration'
    | 'deliberation'
    | 'decision'
    | 'decision_body'
    | 'next_actions'
    | 'risk'
    | 'closing';
  persona?: string;
  narrated: boolean;
  content: string;
  duration_hint_seconds?: number;
  music?: string;
  sfx?: string[];
}

export interface ScriptMeta {
  session: number;
  title: string;
  date: string;
  rotation: string;
  topic: string;
  ep_title: string;
  youtube_description: string;
}

export interface BoardScript {
  _meta: ScriptMeta;
  scenes: ScriptScene[];
}

export interface PersonaVisual {
  colour: string;
  style: string;
  props: string[];
  expression: string;
}

export interface PersonaEntry {
  id: string;
  title: string;
  voice_seat: string;
  voice_name: string;
  voice_id: string | null;
  gender: 'male' | 'female';
  filename: string;
  status: string;
  visual: PersonaVisual;
  description: string;
}

export interface PersonaManifest {
  personas: PersonaEntry[];
}

/** Resolved scene with calculated frame timing */
export interface ResolvedScene extends ScriptScene {
  startFrame: number;
  durationFrames: number;
  audioDurationMs?: number;
  persona_entry?: PersonaEntry;
}
