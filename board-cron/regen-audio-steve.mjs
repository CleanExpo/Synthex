/**
 * Regenerate all Session 23 narration audio using Steve (CEO voice).
 * Overwrites existing files in public/session-23/audio/
 * Usage: node regen-audio-steve.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load .env.local ---
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../../../.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// Steve — CEO voice
const STEVE_VOICE_ID = 'aGkVQvWUZi16EH8aZJvT';

async function generateAudio(apiKey, voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs error ${res.status}: ${body}`);
  }

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

async function main() {
  const env = loadEnv();
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not found in .env.local');

  // Load script
  const scriptPath = path.resolve(
    __dirname,
    'remotion/src/data/session-23-client-journey.json',
  );
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));

  // Build narrated scene list with audio filename
  const narratedScenes = [];
  let narratedCount = 0;
  for (const scene of script.scenes) {
    if (scene.narrated) {
      const prefix = narratedCount.toString().padStart(2, '0');
      const persona = scene.persona ?? 'narrator';
      const filename = `${prefix}-${persona}-${scene.id}.mp3`;
      narratedScenes.push({ scene, filename, index: narratedCount });
      narratedCount++;
    }
  }

  const outDir = path.resolve(
    __dirname,
    'remotion/public/session-23/audio',
  );
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Regenerating ${narratedScenes.length} clips with Steve (CEO voice)`);
  console.log(`Voice ID: ${STEVE_VOICE_ID}\n`);

  for (const { scene, filename, index } of narratedScenes) {
    const outPath = path.join(outDir, filename);
    const preview = scene.content.slice(0, 60).replace(/\n/g, ' ');
    process.stdout.write(
      `[${(index + 1).toString().padStart(2, ' ')}/${narratedScenes.length}] ${filename}\n    "${preview}..."\n`,
    );

    try {
      const audio = await generateAudio(apiKey, STEVE_VOICE_ID, scene.content);
      fs.writeFileSync(outPath, audio);
      console.log(`    ✓ ${(audio.length / 1024).toFixed(0)} KB\n`);
    } catch (err) {
      console.error(`    ✗ FAILED: ${err.message}\n`);
      process.exit(1);
    }

    // Small delay to avoid rate-limit bursts
    if (index < narratedScenes.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log('All audio regenerated. Ready to re-render.');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
