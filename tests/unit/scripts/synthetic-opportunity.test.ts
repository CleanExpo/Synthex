/** @jest-environment node */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { BoardInputSchema } from '../../../packages/control-module/src/intake/board-input.schema';
import { CommandPacketSchema } from '../../../packages/control-module/src/ontology/command-ontology.schema';
import { createSyntheticOpportunityWorkflow } from '../../../scripts/offline-opportunity/workflow';
import {
  syntheticFixture,
  fixtureSession,
} from '../../../scripts/offline-opportunity/fixture';

describe('offline synthetic opportunity pathway', () => {
  let workflow: ReturnType<typeof createSyntheticOpportunityWorkflow>;
  const copy = () => JSON.parse(JSON.stringify(syntheticFixture));
  beforeEach(() => {
    workflow = createSyntheticOpportunityWorkflow();
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('Forbidden network');
    });
    jest.spyOn(require('node:http'), 'request').mockImplementation(() => {
      throw new Error('Forbidden HTTP');
    });
    jest.spyOn(require('node:https'), 'request').mockImplementation(() => {
      throw new Error('Forbidden HTTPS');
    });
    jest.spyOn(require('node:net'), 'connect').mockImplementation(() => {
      throw new Error('Forbidden socket');
    });
    jest
      .spyOn(require('node:child_process'), 'spawn')
      .mockImplementation(() => {
        throw new Error('Forbidden process');
      });
    jest.spyOn(global, 'setInterval').mockImplementation(() => {
      throw new Error('Forbidden scheduler');
    });
  });

  it('retains attribution and displays inspiration separately from synthetic portfolio evidence', () => {
    const item = workflow.capture(fixtureSession, syntheticFixture);
    expect(item.fixture.source.url).toBe(
      'https://creator.example.invalid/field-checklist'
    );
    expect(item.fixture.source.capturedAt).toBe('2026-10-07T00:00:00.000Z');
    expect(item.fixture.source.publishedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(item.fixture.creatorClaims).not.toEqual(
      item.fixture.portfolioEvidence
    );
    expect(item.state).toBe('unreviewed');
    expect(() => workflow.promote(fixtureSession, syntheticFixture.id)).toThrow(
      'accepted'
    );
  });

  it('accepts only a draft and emits a schema-valid pending, blocked local packet preview', () => {
    workflow.capture(fixtureSession, syntheticFixture);
    workflow.decide(
      fixtureSession,
      syntheticFixture.id,
      'accept',
      'Review the synthetic hypothesis'
    );
    const result = workflow.promote(fixtureSession, syntheticFixture.id);
    expect(result).toMatchObject({
      status: 'pending',
      executionBlocked: true,
      submitted: false,
    });
    expect(result.proposal).toMatchObject({
      mode: 'synthetic-draft',
      targetBusiness: 'Unite Group field services',
      spendLimitAUD: 0,
      demandValidated: false,
      revenueValidated: false,
      confidence: 0.6,
      suggestedOwner: 'Portfolio operations lead (proposed)',
    });
    expect(result.proposal.customerProblemHypothesis).toBeTruthy();
    expect(result.proposal.assumptions.length).toBeGreaterThan(0);
    expect(result.proposal.uncertainties.length).toBeGreaterThan(0);
    expect(result.proposal.kpi).toMatchObject({
      unit: 'minutes',
      baselineRequirement: expect.any(String),
    });
    expect(result.proposal.successCriteria).toContain('baseline');
    expect(result.proposal.stopCriteria).toBeTruthy();
    expect(result.proposal.nextValidationStep).toBeTruthy();
    expect(BoardInputSchema.safeParse(result.boardInput).success).toBe(true);
    expect(CommandPacketSchema.safeParse(result.commandPacket).success).toBe(
      true
    );
    expect(result.commandPacket.approvalGate).toBe('production_blocked');
    expect(result.commandPacket.scenarioState).toBe('blocked');
    expect(result.boardInput.organizationId).toBe(
      fixtureSession.organizationId
    );
  });

  it.each(['reject', 'request-evidence'] as const)(
    'blocks promotion after %s and prevents bypass by accepting it later',
    decision => {
      workflow.capture(fixtureSession, syntheticFixture);
      workflow.decide(
        fixtureSession,
        syntheticFixture.id,
        decision,
        'Evidence not sufficient'
      );
      expect(() =>
        workflow.promote(fixtureSession, syntheticFixture.id)
      ).toThrow('accepted');
      expect(() =>
        workflow.decide(fixtureSession, syntheticFixture.id, 'accept', 'Bypass')
      ).toThrow('new fixture revision');
    }
  );

  it('creator URL and confidence alone never count as portfolio demand evidence', () => {
    const fixture = copy();
    fixture.portfolioEvidence = [];
    workflow.capture(fixtureSession, fixture);
    workflow.decide(fixtureSession, fixture.id, 'accept', 'Draft review');
    expect(() => workflow.promote(fixtureSession, fixture.id)).toThrow(
      'portfolio evidence'
    );
  });

  it('reuses the existing confidence gate rather than turning acceptance into evidence', () => {
    const fixture = copy();
    fixture.confidence = 0.3;
    workflow.capture(fixtureSession, fixture);
    workflow.decide(fixtureSession, fixture.id, 'accept', 'Draft review');
    expect(() => workflow.promote(fixtureSession, fixture.id)).toThrow(
      'confidence'
    );
  });

  it('identical fixture and promotion retries are idempotent and changed replays fail', () => {
    workflow.capture(fixtureSession, syntheticFixture);
    workflow.decide(
      fixtureSession,
      syntheticFixture.id,
      'accept',
      'Draft review'
    );
    const first = workflow.promote(fixtureSession, syntheticFixture.id);
    expect(workflow.capture(fixtureSession, copy()).state).toBe('accepted');
    expect(workflow.promote(fixtureSession, syntheticFixture.id)).toEqual(
      first
    );
    const fixture = copy();
    fixture.creatorClaims.push('Changed content');
    expect(() => workflow.capture(fixtureSession, fixture)).toThrow(
      'conflicting fixture'
    );
  });

  it('keeps tenant fixtures separate and rejects unauthenticated fixture operators', () => {
    workflow.capture(fixtureSession, syntheticFixture);
    const other = { ...fixtureSession, organizationId: 'synthetic-org-b' };
    expect(() => workflow.inspect(other, syntheticFixture.id)).toThrow(
      'not found'
    );
    expect(() =>
      workflow.decide(other, syntheticFixture.id, 'accept', 'Cross tenant')
    ).toThrow('not found');
    expect(() => workflow.promote(other, syntheticFixture.id)).toThrow(
      'not found'
    );
    expect(() => workflow.capture(other, syntheticFixture)).toThrow(
      'organisation mismatch'
    );
    expect(() =>
      workflow.capture({ ...fixtureSession, userId: '' }, syntheticFixture)
    ).toThrow();
    const otherFixture = { ...copy(), organizationId: other.organizationId };
    workflow.capture(other, otherFixture);
    expect(workflow.inspect(fixtureSession, syntheticFixture.id).state).toBe(
      'unreviewed'
    );
    expect(() =>
      workflow.capture(
        { ...fixtureSession, mode: 'live' } as never,
        syntheticFixture
      )
    ).toThrow();
  });

  it('cannot mutate private review state or cached packets through returned objects', () => {
    const captured = workflow.capture(fixtureSession, syntheticFixture);
    captured.state = 'accepted';
    captured.fixture.portfolioEvidence = [];
    expect(workflow.inspect(fixtureSession, syntheticFixture.id).state).toBe(
      'unreviewed'
    );
    workflow.decide(
      fixtureSession,
      syntheticFixture.id,
      'accept',
      'Draft review'
    );
    const packet = workflow.promote(fixtureSession, syntheticFixture.id);
    (packet as { executionBlocked: boolean }).executionBlocked = false;
    expect(
      workflow.promote(fixtureSession, syntheticFixture.id).executionBlocked
    ).toBe(true);
  });

  it.each(['url', 'capturedAt'] as const)(
    'rejects missing or malformed source %s',
    field => {
      const fixture = copy();
      fixture.source[field] = 'invalid';
      expect(() => workflow.capture(fixtureSession, fixture)).toThrow();
    }
  );

  it('rejects live sources, unknown decisions and blank review reasons', () => {
    const fixture = copy();
    fixture.source.url = 'https://youtube.com/live';
    expect(() => workflow.capture(fixtureSession, fixture)).toThrow();
    workflow.capture(fixtureSession, syntheticFixture);
    expect(() =>
      workflow.decide(fixtureSession, fixture.id, 'publish' as never, 'Action')
    ).toThrow();
    expect(() =>
      workflow.decide(fixtureSession, fixture.id, 'accept', ' ')
    ).toThrow();
  });

  it('dependency graph has no provider, CRM, DB, queue, messaging, publishing, spending or process capability', () => {
    const seen = new Set<string>();
    function inspect(file: string) {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(
        /\b(fetch|XMLHttpRequest|WebSocket|setInterval|setTimeout|require)\s*\(/
      );
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword
        )
          throw new Error('Dynamic import forbidden');
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const specifier = node.moduleSpecifier.text;
          if (!specifier.startsWith('.')) {
            expect(specifier).toBe('zod');
          } else {
            const target = resolve(dirname(file), specifier);
            const path = existsSync(`${target}.ts`)
              ? `${target}.ts`
              : `${target}/index.ts`;
            inspect(path);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    inspect(
      resolve(__dirname, '../../../scripts/offline-opportunity/workflow.ts')
    );
    expect(seen.size).toBeGreaterThan(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
