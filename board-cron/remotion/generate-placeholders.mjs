/**
 * Generate placeholder persona avatar PNGs (64x64 coloured squares).
 * Zero external dependencies — pure Node.js with zlib.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'src/assets/personas/persona-manifest.json'), 'utf-8')
);

const COLOURS = {
  ceo: '#F59E0B',
  'senior-pm': '#2563EB',
  moonshot: '#22C55E',
  'algorithm-engineer': '#EC4899',
  technical: '#84CC16',
  'qa-engineer': '#E5E7EB',
  'security-engineer': '#7C3AED',
  'ai-ml-engineer': '#06B6D4',
  'database-engineer': '#DC2626',
  'frontend-engineer': '#F87171',
  'bigdata-architect': '#14B8A6',
  'api-reliability-engineer': '#EAB308',
  'devops-engineer': '#34D399',
  'systems-architect': '#1D4ED8',
  'infosec-compliance': '#8B5CF6',
  'mobile-engineer': '#4ADE80',
  cmo: '#EA580C',
  'social-pr-director': '#EC4899',
  market: '#D97706',
  oracle: '#4338CA',
  compounder: '#166534',
  contrarian: '#374151',
  product: '#D946EF',
  revenue: '#2563EB',
};

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function generatePNG(hexColour) {
  const r = parseInt(hexColour.slice(1, 3), 16);
  const g = parseInt(hexColour.slice(3, 5), 16);
  const b = parseInt(hexColour.slice(5, 7), 16);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const width = 64;
  const height = 64;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // colour type RGB
  const ihdr = makeChunk('IHDR', ihdrData);

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const outDir = join(__dirname, 'public/personas');
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const persona of manifest.personas) {
  const colour = COLOURS[persona.id] ?? '#F59E0B';
  const png = generatePNG(colour);
  writeFileSync(join(outDir, persona.filename), png);
  count++;
  console.log(`  ${persona.filename} (${colour})`);
}

console.log(`\nGenerated ${count} placeholder PNGs in public/personas/`);
