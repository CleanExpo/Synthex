/** Offline, deterministic SVG transcription and favicon packaging. No network. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sources = require('../config/brand-logo-sources.json');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function prepare(bytes, asset) {
  let image = sharp(bytes);
  if (asset.extract) image = image.extract(asset.extract);
  if (asset.unmatteBlack || asset.removeWhitePaper) {
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let p = 0; p < data.length; p += 4) {
      if (asset.removeWhitePaper) {
        if (
          Math.min(data[p], data[p + 1], data[p + 2]) > asset.removeWhitePaper
        )
          data[p + 3] = 0;
        continue;
      }
      const maximum = Math.max(data[p], data[p + 1], data[p + 2]);
      data[p + 3] = Math.round((data[p + 3] * maximum) / 255);
      if (maximum)
        for (let channel = 0; channel < 3; channel++)
          data[p + channel] = Math.round((data[p + channel] * 255) / maximum);
    }
    image = sharp(data, { raw: info });
  }
  return image.trim({ background: '#00000000', threshold: 1 }).png().toBuffer();
}

function svgDocument(width, height, content, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">${content}</svg>\n`;
}

function loadVector(asset) {
  const file = asset.vectorPath ?? asset.path;
  if (!file.endsWith('.svg')) throw new Error(`Missing SVG master: ${file}`);
  const bytes = fs.readFileSync(path.join(root, file));
  if (digest(bytes) !== (asset.vectorSha256 ?? asset.sha256))
    throw new Error(`Vector source changed: ${file}`);
  return { svg: bytes.toString('utf8') };
}

function greyscale(svg, inverted = false) {
  return svg.replace(/#[0-9a-f]{6}/gi, colour => {
    const rgb = [1, 3, 5].map(offset =>
      parseInt(colour.slice(offset, offset + 2), 16)
    );
    let light = Math.round(rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722);
    if (inverted) light = 255 - light;
    const hex = light.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  });
}

function darkSurface(svg, slug) {
  // Opaque badges and bright marks retain their colour and internal detail.
  if (!['carsi', 'ccw', 'dr'].includes(slug)) return svg;
  return svg.replace(/#[0-9a-f]{6}/gi, colour => {
    const rgb = [1, 3, 5].map(offset =>
      parseInt(colour.slice(offset, offset + 2), 16)
    );
    return Math.max(...rgb) < 100 ? '#ffffff' : colour;
  });
}

function monochrome(svg, colour) {
  return svg.replace(
    /\b(fill|stroke|stop-color)="([^"]+)"/g,
    (all, attr, value) => (value === 'none' ? all : `${attr}="${colour}"`)
  );
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, index) => {
    const p = 6 + index * 16;
    header[p] = size === 256 ? 0 : size;
    header[p + 1] = header[p];
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(bytes.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(image => image.bytes)]);
}

async function pinnedMask(svg, slug) {
  if (slug === 'synthex')
    return monochrome(
      svg.replace(/<rect\b[^>]*>(?:<\/rect>)?|<rect\b[^>]*\/>/g, ''),
      '#000000'
    );
  if (slug !== 'ra') return monochrome(svg, '#000000');
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(256, 256, { fit: 'contain', background: '#00000000' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const commands = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; ) {
      const ink = column => {
        const p = (y * info.width + column) * 4;
        return (
          data[p + 3] > 128 && Math.max(data[p], data[p + 1], data[p + 2]) < 185
        );
      };
      if (!ink(x)) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < info.width && ink(end)) end++;
      commands.push(`M${x} ${y}h${end - x}v1h-${end - x}Z`);
      x = end;
    }
  }
  return svgDocument(
    256,
    256,
    `<path fill="#000000" d="${commands.join('')}"/>`,
    'RestoreAssist pinned icon'
  );
}

async function main() {
  const prepareDirectory =
    process.argv[2] === '--prepare-traces' ? process.argv[3] : null;
  if (prepareDirectory) fs.mkdirSync(prepareDirectory, { recursive: true });
  const packs = {};
  const receipts = [];
  for (const source of sources) {
    const directory = path.join(root, 'public/logos', source.slug);
    fs.mkdirSync(directory, { recursive: true });
    const load = key => {
      const asset = source[key];
      const bytes = fs.readFileSync(path.join(root, asset.path));
      if (digest(bytes) !== asset.sha256)
        throw new Error(`Source changed: ${asset.path}`);
      return bytes;
    };
    const primaryOriginal = load('primary');
    const iconOriginal = load('icon');
    if (prepareDirectory) {
      for (const [kind, bytes] of [
        ['primary', primaryOriginal],
        ['icon', iconOriginal],
      ]) {
        if (!source[kind].path.endsWith('.svg'))
          fs.writeFileSync(
            path.join(prepareDirectory, `${source.slug}-${kind}.png`),
            await prepare(bytes, source[kind])
          );
      }
      continue;
    }
    const primary = loadVector(source.primary);
    const icon = loadVector(source.icon);
    const variants = {
      'primary.svg': primary.svg,
      'inverted.svg': darkSurface(primary.svg, source.slug),
      'monochrome-light.svg': greyscale(primary.svg, true),
      'monochrome-dark.svg': greyscale(primary.svg),
      'icon.svg': icon.svg,
      'favicon.svg': icon.svg,
      'safari-pinned-tab.svg': await pinnedMask(icon.svg, source.slug),
    };
    const output = [];
    function save(name, bytes) {
      fs.writeFileSync(path.join(directory, name), bytes);
      const asset = `public/logos/${source.slug}/${name}`;
      output.push(asset);
      receipts.push({
        path: asset,
        sha256: digest(bytes),
        bytes: Buffer.byteLength(bytes),
      });
    }
    for (const [name, svg] of Object.entries(variants)) save(name, svg);
    save(
      'primary.png',
      await sharp(Buffer.from(primary.svg))
        .resize({ width: 1200 })
        .png()
        .toBuffer()
    );
    const icons = [];
    for (const size of [16, 32, 48, 180, 192, 256, 512]) {
      const png = await sharp(Buffer.from(icon.svg))
        .resize(size, size, { fit: 'contain', background: '#00000000' })
        .png()
        .toBuffer();
      const name =
        size === 180
          ? 'apple-touch-icon.png'
          : size >= 192 && size !== 256
            ? `android-chrome-${size}x${size}.png`
            : `favicon-${size}x${size}.png`;
      save(name, png);
      if ([16, 32, 48, 256].includes(size)) icons.push({ size, bytes: png });
    }
    save('favicon.ico', ico(icons));
    const maskableMark = await sharp(Buffer.from(icon.svg))
      .resize(280, 280, { fit: 'contain', background: '#00000000' })
      .png()
      .toBuffer();
    save(
      'maskable-512x512.png',
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: ['unite', 'synthex', 'dr'].includes(source.slug)
            ? '#111827'
            : '#ffffff',
        },
      })
        .composite([{ input: maskableMark, left: 116, top: 116 }])
        .png()
        .toBuffer()
    );
    save(
      'site.webmanifest',
      JSON.stringify(
        {
          name: source.label,
          short_name: source.label,
          // Portable icon pack; the consuming application owns launch metadata.
          icons: [
            ...[192, 512].map(size => ({
              src: `android-chrome-${size}x${size}.png`,
              sizes: `${size}x${size}`,
              type: 'image/png',
              purpose: 'any',
            })),
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        null,
        2
      ) + '\n'
    );
    if (source.slug === 'synthex') {
      const aliases = {
        'public/icon.svg': 'icon.svg',
        'public/logo.png': 'primary.png',
        'public/favicon.ico': 'favicon.ico',
        'public/apple-touch-icon.png': 'apple-touch-icon.png',
      };
      for (const [asset, name] of Object.entries(aliases)) {
        const bytes = fs.readFileSync(path.join(directory, name));
        fs.writeFileSync(path.join(root, asset), bytes);
        output.push(asset);
        receipts.push({
          path: asset,
          sha256: digest(bytes),
          bytes: bytes.length,
        });
      }
      for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
        const asset = `public/icons/icon-${size}.png`;
        const bytes = await sharp(Buffer.from(icon.svg))
          .resize(size, size, { fit: 'contain', background: '#00000000' })
          .png()
          .toBuffer();
        fs.mkdirSync(path.join(root, 'public/icons'), { recursive: true });
        fs.writeFileSync(path.join(root, asset), bytes);
        output.push(asset);
        receipts.push({
          path: asset,
          sha256: digest(bytes),
          bytes: bytes.length,
        });
      }
    }
    packs[source.slug] = output;
    console.log(`${source.slug}: ${output.length} files`);
  }
  if (prepareDirectory) return;
  fs.writeFileSync(
    path.join(root, 'config/brand-logo-packs.json'),
    JSON.stringify(packs, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(
      root,
      'docs/evidence/syn-1113/2026-10-10/official-logo-pack-files.json'
    ),
    JSON.stringify(receipts, null, 2) + '\n'
  );
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
