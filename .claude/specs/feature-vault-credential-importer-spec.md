---
id: spec-001
type: feature
title: Vault Credential Importer — Word Document to Vault
created: 2026-03-15
status: In Progress
author: claude
---

# Vault Credential Importer — Specification

## 1. Vision & Goals

- **What**: Upload a Word document (.docx) containing usernames, passwords, and service names. AI parses, cleans, and categorises the credentials into a structured review table. User approves/edits entries, then bulk-imports them into the encrypted Vault.
- **Why**: The owner has years of credentials stored in Word documents in inconsistent formats. Finding and using specific credentials is time-consuming and error-prone. The Vault can store and serve credentials securely, but has no way to import from existing documents.
- **Success criteria**:
  - Upload a .docx → receive a structured preview of extracted credentials within 10 seconds
  - AI correctly identifies service name, username/email, password, URL (where present), and suggested category
  - User can edit any field, delete rows, and add missing entries before importing
  - Approved credentials are encrypted and stored in the vault, accessible per-org
  - Zero credential values appear in server logs or audit trail (only secret names)

## 2. Target Users

- **Who uses this**: Multi-business owner (admin/owner role only)
- **User story**: As a business owner, I want to upload my existing Word document of credentials so that the system can organise and store them securely, and automatically use them in workflows without me having to hunt for them.
- **Edge cases**:
  - Document has inconsistent formatting (mixed delimiters: ":", "=", "-", space-separated)
  - Multiple accounts for the same service (e.g., two Facebook accounts)
  - Credentials mixed with other text/notes
  - Empty or malformed rows
  - Passwords containing special characters
  - No service name identifiable (fallback to "Unknown — review required")

## 3. Technical Design

### Approach
1. **File upload** — Owner uploads .docx via Admin → Vault tab → "Import from Document" button
2. **Server-side parsing** — `mammoth` converts .docx to plain text server-side (never stored)
3. **AI extraction** — OpenRouter (via vault-injected key) sends text to Claude to extract structured credentials
4. **Preview API response** — Returns array of `{ service, url, username, password, category, confidence }` — passwords are returned as-is for review (HTTPS only, never logged)
5. **Review UI** — Editable table with show/hide password toggles, category dropdowns, delete buttons
6. **Vault import** — On confirmation, calls existing vault POST endpoint for each approved row

### Files to modify/create
```
NEW:  app/api/admin/vault/import-doc/route.ts       — parse + AI extract endpoint
NEW:  app/api/admin/vault/import-doc/confirm/route.ts — bulk create vault entries
NEW:  components/admin/vault-import-dialog.tsx        — upload + review UI
MOD:  components/admin/vault-manager.tsx              — add "Import from Document" button
MOD:  lib/vault/vault-service.ts                     — add bulkCreate method (if not exists)
```

### Data model
No schema changes required. Uses existing `vault_secrets` table.

Each imported credential creates one vault secret per field (username + password stored as separate secrets, or combined as a structured JSON value — TBD at implementation).

**Recommended approach**: Store as a single secret with `category: 'credential_pair'` and value as JSON `{ username, password }`. This keeps related credentials together and searchable by service name.

### API contracts

**POST /api/admin/vault/import-doc**
```
Request: multipart/form-data { file: .docx, organizationId: string }
Response: {
  entries: Array<{
    id: string (temp UUID for review)
    service: string
    url: string | null
    username: string | null
    password: string
    category: 'social_media' | 'email' | 'hosting' | 'banking' | 'api_key' | 'other'
    confidence: 'high' | 'medium' | 'low'
  }>
  rawLineCount: number
  extractedCount: number
}
```

**POST /api/admin/vault/import-doc/confirm**
```
Request: {
  organizationId: string
  entries: Array<{ service, url, username, password, category }>
}
Response: { created: number, skipped: number, errors: string[] }
```

### AI Extraction Prompt Design
System prompt instructs Claude to:
- Extract ALL credential entries (even partial ones)
- Normalise service names (e.g. "FB" → "Facebook", "IG" → "Instagram")
- Infer category from service name
- Flag low-confidence extractions
- Return valid JSON array only — no prose
- Never hallucinate credentials that aren't in the text

### Dependencies
- `mammoth` npm package — .docx to text conversion (need to add)
- Existing `VaultService` — encryption + storage
- Existing vault AI key injection — OpenRouter key for extraction call
- Existing `verifyAdmin` — owner-only auth gate

## 4. Design & UX

### UI Flow
1. Admin → Vault tab → "Import from Document" button (top right, next to "Add Secret")
2. Modal opens: drag-and-drop or file picker (accepts .docx only)
3. Upload triggers extraction — loading spinner "Reading document..."
4. Review table appears with all extracted entries:
   - Columns: Service | URL | Username | Password (masked) | Category | Confidence | Actions
   - Low-confidence rows highlighted in amber
   - Password column: masked by default, eye icon to reveal per-row
   - Each cell is editable inline
   - Delete row button per entry
   - "Add row" button for manually adding missed credentials
5. "Import X credentials to Vault" button — disabled until at least 1 row present
6. Success state: "X credentials imported" with link to vault list
7. Error state: per-row errors shown inline

### Error states
- Invalid file type → "Only .docx files are supported"
- File too large (>10MB) → "File too large. Maximum size is 10MB"
- No credentials found → "No credentials detected. Try a different document or add entries manually"
- AI extraction failure → fallback to regex-based extraction with lower confidence scores
- Partial import failure → "X of Y credentials imported. Failed entries shown below"

## 5. Business Impact

- **Metrics affected**: Vault usage, credential coverage, time-to-onboard
- **Cost**: ~1 OpenRouter API call per import (minimal cost, <$0.01 per doc)
- **Priority**: High — owner has immediate need, no current alternative
- **Security uplift**: Moves credentials from unencrypted Word docs to AES-256-GCM encrypted vault

## 6. Implementation Steps

1. **Install mammoth** — `npm install mammoth @types/mammoth` (30 min)
2. **Build extraction API** — `/api/admin/vault/import-doc/route.ts` with mammoth parse + AI extract (2 hrs)
3. **Build confirm API** — `/api/admin/vault/import-doc/confirm/route.ts` with bulk vault insert (1 hr)
4. **Build review UI** — `vault-import-dialog.tsx` with editable table, password masking, confidence indicators (3 hrs)
5. **Wire into vault manager** — Add "Import from Document" button to existing vault UI (30 min)
6. **Type check + test** — `npm run type-check`, manual test with sample .docx (1 hr)
7. **Commit + deploy** (30 min)

**Total estimate: ~8 hours**

## 7. Documentation

- **User docs**: Admin → Vault → "Import from Document" — tooltip explaining process
- **Code comments**: AI prompt design rationale, credential pair JSON structure
- **Changelog entry**: `feat(vault): add Word document credential importer with AI extraction`

## 8. Status

- **Current phase**: Draft — awaiting approval
- **Blockers**: None
- **Last updated**: 2026-03-15
