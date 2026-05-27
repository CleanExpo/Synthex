const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

const repoRoot = join(__dirname, '../../..');
const scriptPath = join(repoRoot, 'scripts/verify-vercel-production-env.js');
const fixturePath = join(repoRoot, 'tests/fixtures/vercel-env-list.json');

describe('verify-vercel-production-env', () => {
  it('does not pass --project as a vercel env ls positional argument', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { buildVercelArgs } from ${JSON.stringify(scriptPath)}; console.log(JSON.stringify(buildVercelArgs({ target: 'production', scope: 'unite-group', project: 'synthex' })));`,
      ],
      { encoding: 'utf8', cwd: repoRoot }
    );

    const args = JSON.parse(output);

    expect(args).toEqual([
      'env',
      'ls',
      '--scope',
      'unite-group',
      '--non-interactive',
      '--format',
      'json',
    ]);
    expect(args).not.toContain('synthex');
  });

  it('reports target counts and required production envs from a fixture without secrets', () => {
    const output = execFileSync(
      process.execPath,
      [scriptPath, '--json-file', fixturePath, '--target', 'production'],
      { encoding: 'utf8', cwd: repoRoot }
    );

    expect(output).toContain('Observed env names for target: 25');
    expect(output).toContain(
      'Target counts: production=25, preview=12, development=5'
    );
    expect(output).toContain('Required: 16/16 present');
    expect(output).toContain('Secret values were not requested or printed.');
    expect(output).not.toContain('postgresql://');
    expect(output).not.toContain('sk_');
  });
});
