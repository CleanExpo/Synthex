export interface ModifierChip {
  id: string;
  category: 'style' | 'camera' | 'lighting';
  name: string;
  promptFragment: string;
  params?: Record<string, string | number | boolean>;
}

function style(
  slug: string,
  name: string,
  promptFragment: string,
  params?: Record<string, string | number | boolean>
): ModifierChip {
  return {
    id: `style-${slug}`,
    category: 'style',
    name,
    promptFragment,
    params,
  };
}

function camera(
  slug: string,
  name: string,
  promptFragment: string,
  params?: Record<string, string | number | boolean>
): ModifierChip {
  return {
    id: `camera-${slug}`,
    category: 'camera',
    name,
    promptFragment,
    params,
  };
}

function lighting(
  slug: string,
  name: string,
  promptFragment: string,
  params?: Record<string, string | number | boolean>
): ModifierChip {
  return {
    id: `lighting-${slug}`,
    category: 'lighting',
    name,
    promptFragment,
    params,
  };
}

export const MODIFIER_CHIPS: ModifierChip[] = [
  // ── Style (5) ──────────────────────────────────────────────────────────────
  style(
    'cinematic',
    'Cinematic',
    'cinematic widescreen look, film-grade colour grading'
  ),
  style(
    'animated',
    'Animated',
    'stylised animation, vivid colours, smooth motion graphics'
  ),
  style(
    'documentary',
    'Documentary',
    'gritty documentary aesthetic, natural colour, realistic texture'
  ),
  style(
    'retro-film',
    'Retro Film',
    'vintage 16mm film grain, faded colour palette, nostalgic warmth'
  ),
  style(
    'clean-commercial',
    'Clean Commercial',
    'clean commercial aesthetic, crisp whites, polished product finish'
  ),

  // ── Camera (15) ────────────────────────────────────────────────────────────
  camera(
    'dolly-in',
    'Dolly In',
    'slow dolly-in push toward the subject, building intimacy'
  ),
  camera(
    'dolly-out',
    'Dolly Out',
    'steady dolly-out pull away from the subject, revealing scale'
  ),
  camera('orbit', 'Orbit', 'smooth 360 degree orbit around the subject'),
  camera(
    'crash-zoom',
    'Crash Zoom',
    'rapid crash zoom into the subject for dramatic impact'
  ),
  camera(
    'bullet-time',
    'Bullet Time',
    'frozen-time 360 degree rotation, hyper-slow playback'
  ),
  camera(
    'crane-up',
    'Crane Up',
    'rising crane move from ground level up to aerial reveal'
  ),
  camera(
    'crane-down',
    'Crane Down',
    'descending crane move from high angle down to subject level'
  ),
  camera(
    'handheld',
    'Handheld',
    'naturalistic handheld shake, intimate documentary energy'
  ),
  camera(
    'whip-pan',
    'Whip Pan',
    'fast whip-pan transition between scenes, high kinetic energy'
  ),
  camera(
    'tracking',
    'Tracking',
    'parallel tracking shot following the subject in motion'
  ),
  camera(
    'low-angle',
    'Low Angle',
    'low-angle upward tilt making subject appear powerful and imposing'
  ),
  camera(
    'top-down',
    'Top Down',
    "overhead top-down bird's-eye view of the subject"
  ),
  camera('fpv', 'FPV', 'immersive first-person view racing through the scene'),
  camera(
    'static-locked',
    'Static Locked',
    'static locked-off tripod shot, no camera movement'
  ),
  camera(
    'rack-focus',
    'Rack Focus',
    'smooth rack focus pulling from background to foreground subject'
  ),

  // ── Lighting (6) ───────────────────────────────────────────────────────────
  lighting(
    'golden-hour',
    'Golden Hour',
    'warm golden-hour sunlight, long soft shadows'
  ),
  lighting(
    'moody-night',
    'Moody Night',
    'deep moody nighttime atmosphere, pools of artificial light'
  ),
  lighting(
    'studio-soft',
    'Studio Soft',
    'soft studio lighting with gentle fill, clean shadowless look'
  ),
  lighting('neon', 'Neon', 'vivid neon accent lights, colourful urban glow'),
  lighting(
    'overcast',
    'Overcast',
    'flat diffuse overcast daylight, even natural exposure'
  ),
  lighting(
    'dramatic-rim',
    'Dramatic Rim',
    'strong rim lighting separating subject from dark background'
  ),
];

export function getChips(ids: string[]): ModifierChip[] {
  return ids
    .map(id => MODIFIER_CHIPS.find(c => c.id === id))
    .filter((c): c is ModifierChip => c !== undefined);
}
