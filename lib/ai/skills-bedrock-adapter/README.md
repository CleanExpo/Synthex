# lib/ai/skills-bedrock-adapter — SPEC (not yet built)

Status: **specification** · Track C pilot · 2026-04-27

This directory will house the Skills-to-Bedrock adapter: a fourth `AIProvider`
implementation that loads Synthex SKILL.md files and invokes Anthropic Claude
on AWS Bedrock (Sydney `ap-southeast-2`).

The build is gated on:

1. **VG-159** — confirmation that Bedrock cross-region inference can be pinned
   to `ap-southeast-2` for AU data residency. Direct-in-region only; no spillover
   to `us-east-1` or `eu-central-1` permitted.
2. **VG-160** — verification that the SKILL.md → Anthropic Skills JSON adapter
   pattern preserves the foundation-discipline R-1 through R-7 contract.
3. **AWS account creation** — two accounts mandated by the Track C Pilot Proposal:
   `synthex-nexus-prod` and `external-client-client-prod`. Cross-account read denied at S3
   bucket policy level.
4. **Dependency install** — `npm install @aws-sdk/client-bedrock-runtime js-yaml`
   (~330 KB bundle impact, tree-shakeable when env-gated).

## File structure (planned)

```
lib/ai/skills-bedrock-adapter/
├── index.ts                 # Public exports: SkillsBedrockAdapter class
├── bedrock-provider.ts      # Implements AIProvider for AWS Bedrock Converse API
├── skill-loader.ts          # Loads SKILL.md from filesystem or S3, parses frontmatter
├── skill-compiler.ts        # SKILL.md → Anthropic Skills format
├── types.ts                 # SkillDefinition, SkillContext, IsolationViolationError
├── config.ts                # Env vars + region pinning
└── __tests__/
    ├── skill-loader.test.ts
    ├── skill-compiler.test.ts
    └── bedrock-provider.test.ts
```

## Key interfaces

```ts
export interface SkillDefinition {
  name: string;
  description: string;
  operates_in?: string[];          // ["nexus"] | ["external-client"] | []
  consumes_from?: string[];        // foundation file references
  foundation_authority?: string;   // e.g., "ceo-foundation.md#H-1"
  instructions: string;            // Compiled system prompt
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
}

export interface SkillContext {
  skillName: string;
  operationScope: 'nexus' | 'external-client' | 'shared';
  foundationReferences: Map<string, string>;
  invokedAt: Date;
  accountId: string;               // AWS account for isolation check
}

export class SkillsBedrockAdapter implements AIProvider {
  readonly name = 'AWS Bedrock + Anthropic Skills';
  readonly models: ModelPresets;

  constructor(config: {
    bedrockRegion?: string;          // default from BEDROCK_REGION env
    skillsSourceS3?: string;         // S3 path to skills bucket
    skillsSourceFilesystem?: string; // fallback: .claude/skills
    accountId: string;               // AWS account for isolation
    operationScope: 'nexus' | 'external-client'; // which skills are accessible
  });

  loadSkills(skillNames: string[]): Promise<Map<string, SkillDefinition>>;
  compileSkill(skillPath: string): SkillDefinition;
  resolveFoundationReferences(skill: SkillDefinition): Promise<SkillContext>;

  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  stream(request: AICompletionRequest): AsyncGenerator<string, void, unknown>;
}
```

## Adapter pseudo-code (canonical)

Per `.claude/scratchpad/track-c-pilot-proposal.md`:

```ts
async function invokeSkillOnBedrock(
  skillName: string,
  invocationRequest: WorkflowRequest,
  account: 'nexus' | 'external-client',
): Promise<SkillOutput> {
  const skill = await readSkillFromS3(skillName, account);
  const foundationContext = await readFoundationContext(account);
  const systemPrompt = `${skill.body}\n\nCanonical foundation context:\n${foundationContext}\n\n[R-1..R-7 discipline applies]`;

  const response = await bedrock.invokeModel({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    region: 'ap-southeast-2',
    system: systemPrompt,
    messages: [{ role: 'user', content: invocationRequest.prompt }],
  });

  return parseSkillOutput(response);
}
```

## Cross-client isolation (mandatory)

1. **File-system boundary** (dev/test): `skill.operates_in === ["external-client"]` cannot
   load when adapter constructed with `operationScope: 'nexus'`.
2. **AWS account boundary** (prod): separate accounts, separate S3 buckets,
   bucket policy denies cross-account reads, IAM principal scoped.
3. **Aid Rule preservation** (VG-155): adapter never autonomously assesses
   RestoreAssist content. brand-voice-enforce gate runs externally.

## Reuse opportunities (from lib/ai audit 2026-04-27)

- Inherit `AIProvider` interface from `lib/ai/providers/base-provider.ts`.
- Extend `lib/ai/model-registry.ts` with `provider: 'bedrock'` discriminator.
- Replicate Anthropic provider's BedrockRuntimeClient caching pattern.
- Reuse error mapping (UnrecognizedClientException, ThrottlingException).
- Reuse `THINKING_EFFORTS` enum — Bedrock Converse supports `thinking` param.
- Once a `skill-orchestration` intent is added to `lib/ai/task-routing.ts`,
  leverage the existing fallback-chain mechanism.

## Non-goals

- Skill orchestration (that's the senior-strategist skill's job)
- Deterministic gates (that's `lib/ai/content-evaluator.ts`)
- Aid Rule compliance enforcement (that's brand-voice-enforce + technician workflow)

## Next concrete steps

1. CEO authorisation on Track C pilot (per VG-159, VG-160)
2. AWS account creation (synthex-nexus-prod, external-client-client-prod)
3. `npm install @aws-sdk/client-bedrock-runtime js-yaml`
4. Implement skill-loader.ts (filesystem path first, S3 second)
5. Implement skill-compiler.ts with foundation-reference resolution
6. Implement bedrock-provider.ts with isolation checks
7. Wire `bedrock` into `lib/ai/providers/index.ts` factory
8. Add Bedrock entries to `lib/ai/model-registry.ts`
9. Smoke test end-to-end: senior-strategist skill → Bedrock → output cites foundation

This README is the canonical spec until the build lands. Update VG-159 / VG-160
in `.claude/memory/verification-gates.md` when each gate flips.
