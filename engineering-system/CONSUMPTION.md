# Consuming the engineering standard from Pi Dev Ops and other repos

**27/10/2026 | Draft interoperability contract (not yet installed).**

## Single source, version pinned

- **Canonical owner repo:** `CleanExpo/Synthex`, directory `engineering-system/`.
- **Consumer:** `CleanExpo/Pi-Dev-Ops` and other Unite Group projects through existing orchestrator/skill lookup.
- **Reference:** Git remote + **full reviewed commit SHA** + relative canonical file. No unpinned branch HEAD in production job context.
- **Check:** working tree clean, revision exists, expected manifest files present, no cross-project privilege escalation. Offline clients can use an explicitly versioned cache; expose version and retrieval time.
- **Do not copy** whole directories into each project, install scripts globally, or force network fetch on each user request.
- **Do not run arbitrary script from a fetched branch**. Evaluate pin, integrity and approval first.

## Runtime retrieval pseudocode

```
source = {"repo":"CleanExpo/Synthex", "commit":"<reviewed-full-sha>",
  "entry":"engineering-system/README.md", "spec":"engineering-system/SPEC.md"}
assert approved_source(source.repo, source.commit)
bundle = read_pinned_git_objects(source)   # authenticated mirror/cache
assert validate_reference_bundle(bundle)    # paths, integrity, policy
manifest = select_minimum_refs(bundle, linear_task.scope)
emit_context_manifest(manifest, source.commit)
```

Implementation belongs in existing Pi Dev Ops senior harness, not a new agent platform; currently **not wired**.

## Handoff and versioning

Change to spec → focused test + council record → commit/PR → independent review → human merge permission → immutable pinned SHA registered in Pi Dev Ops → one pilot job → measured regression/cost review → portfolio adoption. Old consumers remain on previous SHA until intentionally upgraded.

## Existing references

Pi Dev Ops repo already has `config/harness/`, `app/server/senior_harness_consumer.py`, `app/server/senior_harness_admission.py` and tests. Avoid a second consumer unless those are demonstrably inadequate.
