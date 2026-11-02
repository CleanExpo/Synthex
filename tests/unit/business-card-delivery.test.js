/**
 * Required Synthex CI bridge: exercise the real paid-card Python builder.
 *
 * The repository's required "Unit Tests" GitHub job runs Jest, not pytest.
 * Keep these E2E builder-contract checks in the discovered Jest root so PR
 * checks cannot remain green when the Python builder fails on Linux.
 * Source files, buyer data and artefacts are always synthetic; no API calls.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../..');
const BUILDER = path.join(REPO, 'business-card/deliver/build_order.py');
const SAMPLES = path.join(REPO, 'business-card/deliver/sample/orders');
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

function runBuilder(orderPath, output) {
  return spawnSync(PYTHON, ['-I', BUILDER, orderPath, output], {
    encoding: 'utf8',
    timeout: 20000,
    cwd: REPO,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
}

describe('Synthex paid Business Card Python fulfilment acceptance', () => {
  let scratch;
  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'synthex-card-accept-'));
  });
  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test.each([
    ['ready-made', 'A.json', 'edition-skyline.mp4', 'SAMPLE-PC-0001'],
    ['made-for-you', 'B.json', null, 'SAMPLE-PC-0002'],
  ])(
    '%s order produces private proof and correct media',
    (tier, input, requiredFilm, reference) => {
      const out = path.join(scratch, 'built');
      const result = runBuilder(path.join(SAMPLES, input), out);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).not.toMatch(/REFUSED/);
      const proof = fs.readFileSync(path.join(out, 'PROOF.md'), 'utf8');
      expect(proof).toContain(reference);
      expect(proof).toContain(tier);
      const html = fs.readFileSync(path.join(out, 'card/index.html'), 'utf8');
      expect(html).toContain('Sasha Sampleton');
      expect(html).not.toContain("Phill's personal notes");
      expect(fs.existsSync(path.join(out, 'card/preview.html'))).toBe(true);
      expect(fs.existsSync(path.join(out, 'brand-kit.json'))).toBe(true);
      if (requiredFilm) {
        expect(
          fs.statSync(path.join(out, 'card/media', requiredFilm)).size
        ).toBeGreaterThan(100000);
        expect(proof).not.toContain('FILM PENDING');
      } else {
        expect(proof).toContain('FILM PENDING');
        expect(
          fs
            .readdirSync(path.join(out, 'card/media'))
            .some(name => name.endsWith('.mp4'))
        ).toBe(false);
      }
    }
  );

  test('missing buyer identity fails closed without an output card', () => {
    const source = JSON.parse(
      fs.readFileSync(path.join(SAMPLES, 'B.json'), 'utf8')
    );
    delete source.buyer_name;
    const input = path.join(scratch, 'B.json');
    fs.writeFileSync(input, JSON.stringify(source));
    // No source logo is needed: required-field rejection must happen first.
    const out = path.join(scratch, 'built');
    const result = runBuilder(input, out);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/missing required field 'buyer_name'/);
    expect(fs.existsSync(path.join(out, 'card/index.html'))).toBe(false);
  });

  test('the current Python pytest suite remains present and discoverable', () => {
    const content = fs.readFileSync(
      path.join(REPO, 'business-card/deliver/test_build_order.py'),
      'utf8'
    );
    expect(content).toContain(
      'test_logo_that_grows_past_the_limit_when_cleaned_refuses_with_nothing_built'
    );
    expect(content).toContain(
      'test_ready_made_order_builds_card_with_film_links_and_contact'
    );
  });
});
