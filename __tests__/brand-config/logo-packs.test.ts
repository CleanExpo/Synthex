import fs from 'node:fs';
import path from 'node:path';
import packs from '../../config/brand-logo-packs.json';
import sources from '../../config/brand-logo-sources.json';
import crypto from 'node:crypto';

const root = path.join(__dirname, '../..');

describe('complete offline logo packs', () => {
  it('uses the NRPG Group shield instead of the rejected legacy NRP badge', () => {
    const source = sources.find(item => item.slug === 'nrpg')!;
    const bytes = fs.readFileSync(path.join(root, source.primary.path));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(
      source.primary.sha256
    );
    expect(source.primary.sha256).not.toBe(
      '5a661ed9e9ce13a3e7a1ef71143b87bf6ea070822f012507c891ad7cdb232bd6'
    );
    expect(source.primary.url).toContain('nrpg-logo-full.png');
    expect(
      fs.readFileSync(path.join(root, 'public/logos/nrpg/primary.svg'), 'utf8')
    ).toContain('NRPG National Restoration Professionals Group');
  });
  it('uses present Synthex icons in the installed-app manifest', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8')
    );
    expect(
      manifest.icons.some(
        (icon: { purpose: string }) => icon.purpose === 'maskable'
      )
    ).toBe(true);
    for (const icon of [
      ...manifest.icons,
      ...manifest.shortcuts.flatMap(
        (shortcut: { icons: unknown[] }) => shortcut.icons
      ),
    ]) {
      expect(fs.existsSync(path.join(root, 'public', icon.src))).toBe(true);
    }
    expect(fs.readFileSync(path.join(root, 'public/icon.svg'))).toEqual(
      fs.readFileSync(path.join(root, 'public/logos/synthex/icon.svg'))
    );
  });
  it('covers all eight requested business identities', () => {
    expect(Object.keys(packs).sort()).toEqual(
      [
        'ra',
        'dr',
        'nrpg',
        'carsi',
        'synthex',
        'unite',
        'ccw',
        'john-coutis',
      ].sort()
    );
  });

  it.each(Object.entries(packs))(
    '%s has deployable SVG, browser and app icons',
    (_slug, files) => {
      for (const file of files) {
        const bytes = fs.readFileSync(path.join(root, file));
        expect(bytes.length).toBeGreaterThan(0);
        if (file.endsWith('.svg')) {
          const svg = bytes.toString('utf8');
          expect(svg).toContain('viewBox=');
          expect(svg).not.toMatch(
            /<script|<foreignObject|<image|\bon\w+=|(?:href|src)=["']https?:/i
          );
        }
        if (file.endsWith('.ico')) {
          expect(bytes.readUInt16LE(2)).toBe(1);
          const count = bytes.readUInt16LE(4);
          expect(count).toBe(4);
          for (let index = 0; index < count; index++) {
            const entry = 6 + index * 16;
            const size = bytes.readUInt32LE(entry + 8);
            const offset = bytes.readUInt32LE(entry + 12);
            expect(offset + size).toBeLessThanOrEqual(bytes.length);
            expect(bytes.subarray(offset, offset + 8)).toEqual(
              Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
            );
          }
        }
        if (file.endsWith('.webmanifest')) {
          const manifest = JSON.parse(bytes.toString('utf8'));
          expect(manifest.start_url).toBeUndefined();
          expect(manifest.scope).toBeUndefined();
          expect(
            manifest.icons.some(
              (icon: { purpose: string }) => icon.purpose === 'maskable'
            )
          ).toBe(true);
          for (const icon of manifest.icons) {
            expect(icon.src).not.toContain('/');
            expect(
              fs.existsSync(
                path.join(path.dirname(path.join(root, file)), icon.src)
              )
            ).toBe(true);
          }
        }
      }
    }
  );
});
