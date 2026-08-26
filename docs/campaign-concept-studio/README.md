# Campaign Concept Studio

## What this feature delivers

The Campaign Concept Studio is a production-grade workflow for marketing teams:

- Input: short campaign brief, target audience, product details, tone, and desired channels.
- Output:
  - concise campaign concept
  - 3 headline/body copy variants
  - launch checklist
  - channel image prompts + generated image previews

The workflow keeps OpenAI calls server-side in:
`/app/api/campaign-concept-studio/generate/route.ts`.
The browser/UI calls only this endpoint and never invokes OpenAI directly.

## Structure

- `lib/services/campaign-concept-studio.ts`:
  - validates payload
  - uses OpenAI **Responses API** for text generation
  - calls image generation per channel
  - shapes and validates output
- `app/api/campaign-concept-studio/generate/route.ts`:
  - auth-gated endpoint
  - validates request body and returns a consistent payload
- `app/dashboard/campaign-concept-studio/page.tsx`:
  - production UI with loading, empty, and error states
- `app/dashboard/creative-suite/page.tsx`:
  - adds a shortcut card into the creative suite grid for fast access

## Environment variables

Required:

- `OPENAI_API_KEY` (server-side API key)

Recommended:

- `CAMPAIGN_CONCEPT_TEXT_MODEL` (default: `gpt-4o-mini`)
- `CAMPAIGN_CONCEPT_IMAGE_MODEL` (default: `dall-e-3`)
- `CAMPAIGN_CONCEPT_IMAGE_SIZE` (default: `1024x1024`)
- `CAMPAIGN_CONCEPT_IMAGE_QUALITY` (optional for DALL·E family, default: `standard`)
- `CAMPAIGN_CONCEPT_MAX_TOKENS` (default: `1400`)

## Install

From repo root:

```bash
npm install
cp .env.example .env.local
```

Populate `.env.local` with the required variables above.

## Run locally

```bash
npm run dev
```

Open:

- `http://localhost:3000/dashboard/campaign-concept-studio`

## Deploy

1. Set all required environment variables in production host (e.g. Vercel/Render).
2. `npm run build`
3. Deploy as normal Next.js app.

If deploying to Vercel, use the same environment variables in Project Settings → Environment Variables.

## Client/server boundary (important)

- **Client side (React UI):** only posts form data to `/api/campaign-concept-studio/generate`.
- **Server side (route + service):** creates `OpenAI` client, executes text generation and image generation, parses/validates output, and returns serialised JSON.
- API key is never sent to the browser.

## Validation plan

1. **Happy path (manual smoke)**
   - Fill all fields, select 2+ channels, submit.
   - Expect: concept card, 3 variants, checklist, images for all channels where available.

2. **Validation errors**
   - Submit blank fields or no channels.
   - Expect: clear inline validation error before request is sent or 400 response with field errors.

3. **Model fallback behavior**
   - Set invalid `CAMPAIGN_CONCEPT_IMAGE_MODEL` in `.env.local` and restart.
   - Expect a non-blocking image error per channel, while concept and copy are still returned if text succeeds.

4. **Usage observability**
   - Confirm response payload includes `model` and token usage metadata.

5. **Load test quick check**
   - Perform 5 sequential requests.
   - Verify endpoint returns within expected budget and images are capped per channel.

## How to adjust models/prompts later

- **Text model:** set `CAMPAIGN_CONCEPT_TEXT_MODEL`.
- **Image model:** set `CAMPAIGN_CONCEPT_IMAGE_MODEL`.
- **Image size/quality:** set `CAMPAIGN_CONCEPT_IMAGE_SIZE` and `CAMPAIGN_CONCEPT_IMAGE_QUALITY`.
- **Prompt behavior:** edit the structured prompt in:
  `lib/services/campaign-concept-studio.ts` (the `prompt` array inside `generateCampaignConceptStudio`).
- **Schema:** update/extend payload and UI together in:
  `lib/types/campaign-concept-studio.ts`,
  `lib/services/campaign-concept-studio.ts`,
  `app/api/campaign-concept-studio/generate/route.ts`,
  `app/dashboard/campaign-concept-studio/page.tsx`.

## API references used

- OpenAI Responses API: https://developers.openai.com/api/docs/responses
- OpenAI models page: https://developers.openai.com/api/docs/models
