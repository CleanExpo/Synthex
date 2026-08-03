# Client-specific Auto Label Pipeline

**Date:** 3 August 2026

## Decision

Build the pipeline as a tenant-isolated assistance layer over Synthex's existing one-paste Context Field. Each incoming source or note receives transparent labels derived from that organisation's saved Client Profile, Brand Operating System, and optional explicit workflow taxonomy.

Labels organise context and suggest a specialist queue. They do not select a goal, grant a capability, approve work, publish, spend, or replace the evidence state.

This is a credible way to reduce intake friction because it removes the need to sort every item before receiving value. It should not yet be described as a proven retention or productivity improvement; that requires production measurements.

## External research

### Confidence needs a review path

Amazon SageMaker Ground Truth's automated labelling flow establishes a confidence threshold from validated data, auto-labels items above that threshold, and sends low-confidence items to people. For text classification, its system seeks a threshold corresponding to at least 95% expected label accuracy. The transferable pattern is thresholded automation rather than silent automation. [Amazon SageMaker automated data labelling](https://docs.aws.amazon.com/sagemaker/latest/dg/sms-automated-labeling.html)

Google Document AI supports client-defined classes, iterative corrections, and confidence scores. Its guidance describes using low confidence to trigger manual review and warns that the classifier should be evaluated against human-labelled ground truth. [Google Document AI custom classifier](https://docs.cloud.google.com/document-ai/docs/custom-classifier), [custom extractor confidence guidance](https://docs.cloud.google.com/document-ai/docs/custom-extractor-overview)

### Correction and explanation are part of the product

Microsoft's 18 Human-AI Interaction guidelines were validated with 49 design practitioners across 20 AI-infused products. The guidelines include efficient correction, scoping services when uncertain, and granular feedback. A label that cannot be understood or corrected is therefore incomplete interaction design, not merely a model-quality issue. [Microsoft Research guidelines](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/), [HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)

Google's People + AI Guidebook treats feedback and control as necessary for personalising AI output and improving the experience over time. It also notes that the product must explain when user actions are used as feedback. [PAIR feedback and control](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/)

NIST's AI Risk Management Framework treats validity, transparency, explainability, privacy, and accountability as lifecycle concerns. Its playbook recommends explanations tailored to the user's role, knowledge, and skill. [NIST AI RMF FAQ](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-faqs), [NIST AI RMF Playbook](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf)

## Existing Synthex fit

Synthex already has the correct insertion point:

- The authenticated Idea Explorer accepts websites, social pages, documents, constraints, and notes in one batch.
- The quick intake already distinguishes broad source types without forcing a manual interview.
- Context is organisation-isolated, versioned, and stored as canonical Markdown.
- Client-specific context already exists in `ClientProfile`, while operating rules and method names exist in `BrandOperatingSystem`.
- `Organization.settings` can hold an explicit `autoLabelPipeline` policy without a new database migration.

The initial pipeline therefore uses deterministic matching. This keeps the first label immediate, explainable, available without a model provider, and cheap. A model can later suggest labels only for unmatched content, behind the same confidence and review contract.

## Pipeline contract

```text
One-paste intake
    → source safety and evidence-state checks
    → load the active organisation's label policy
    → match source type and client workflow terms
    → apply high-confidence navigation labels
    → mark goals, risks, and uncertain matches “Check”
    → persist labels with policy version, confidence, reason, and route
    → expose labels to research as navigation-only metadata
```

The policy is assembled in this order:

1. Generic source labels, such as Website, Reference, Social channel, and Constraint.
2. An explicit `Organization.settings.autoLabelPipeline` taxonomy when configured.
3. Otherwise, labels derived from the active Client Profile's audiences, needs, offers, proof, competitors, goals, channels, and constraints.
4. Workflow-stage labels derived from the Brand Operating System output sections.

An explicit taxonomy is the mechanism for a genuinely specialised process. Example:

```json
{
  "autoLabelPipeline": {
    "name": "Restoration intake v3",
    "version": 3,
    "autoApplyThreshold": 0.8,
    "suggestThreshold": 0.55,
    "labels": [
      {
        "id": "process-site-assessment",
        "name": "Site assessment",
        "dimension": "workflow",
        "matchAny": ["moisture inspection", "site assessment"],
        "sourceKinds": [],
        "routeTo": "assessment-queue",
        "requiresReview": false
      }
    ]
  }
}
```

## How this reduces stickiness

The intended reduction is cognitive and procedural:

- The client can paste mixed information once instead of deciding where every item belongs.
- Familiar client terminology appears in the workspace instead of Synthex architecture terms.
- A visible route connects an item to the specialist process without converting it into an instruction.
- Confidence and reasons make uncertain classification inspectable.
- Risk and goal labels always remain review suggestions, preventing convenience from silently expanding authority.

## Measurement plan

The feature should be considered successful only when production telemetry shows improvement in:

- median time from opening intake to a usable Context Field;
- percentage of users who complete one-paste intake without switching to manual sorting;
- batch abandonment rate;
- proportion of labels marked `Check`;
- correction or dismissal rate by label and policy version;
- downstream reroute rate, showing labels sent work to the wrong specialist stage;
- time from intake to the first approved direction;
- retention after the first completed client workflow.

No label content should be used for cross-client training or taxonomy transfer without separate authority. Corrections must remain organisation-scoped and auditable.

## Next product increment

Add a compact correction control that lets an authorised client user dismiss or replace a suggested label. Store that correction against the policy version and use it to tune the tenant's matcher. Only after enough corrections exist should a model-assisted fallback be evaluated against a held-out, human-labelled set.
