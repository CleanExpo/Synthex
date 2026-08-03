# Synthex Prompt Library — v0.1

Thirteen archetypes, four modifiers, and one asset pipeline — parameterised. Each entry is
a template with `{{SLOTS}}`, not a finished prompt. The generator fills slots; the
archetype supplies structure, lighting, and composition that are known to hold up.

Converts cleanly to JSON — each archetype maps to `{id, family, use_for, ratio, slots[],
template, notes}`. Families are `still`, `motion`, and `pipeline`. Modifiers are a
separate shape: `{id, composes_with[], slots[], fragment, notes}` — they have no `ratio`
and are never used alone.

Companion: `synthex-social-pipeline.md` covers strategy and copy.

## How to use

- **Pick by intent, not by looks.** `use_for` is the routing field.
- **Never bake in a brand.** Real brand names go in `{{BRAND}}` and only when Synthex is
  producing for that client. Archetypes 1, 5 and 8 are the ones that tempt this.
- **Identity-reference archetypes** (4, 6, 7, 10) require an uploaded photo and must
  carry the identity-lock block verbatim — it is the difference between a likeness and a
  stranger.
- **Ratio is part of the archetype**, not a preference. Feed ratios are baked in below.
- **Modifiers compose.** Apply them on top of an archetype; check the `composes_with` list
  before reaching for one.

## Shared blocks

**IDENTITY LOCK** — paste verbatim into any archetype using a reference photo:
> Use the uploaded photo as the ONLY identity reference. Preserve facial structure,
> hairstyle, hair colour, skin tone, expression, and body proportions with high fidelity.
> Do not beautify, slim, lighten, or alter the person's features.

**RENDER TAIL** — one line, not a keyword pile:
> Photorealistic, cinematic lighting, shallow depth of field, ultra-detailed textures,
> sharp focus.

*Note: trailing quality-token stacks ("8K, HDR, masterpiece, award-winning, Behance,
ArtStation") are largely inert on current models and cost prompt budget. Keep one short
tail. The description does the work.*

*Do not combine the render tail with modifier M4 (Documentary Restraint) — they pull
against each other. M4 replaces this block.*

**NEGATIVE** — default for all archetypes:
> No text, no watermark, no logo, no border, no distorted hands, no extra limbs.

Override only when the archetype requires typography (3, 5, 12).

---

# MODIFIERS

Techniques that compose with archetypes rather than replacing them. The library previously
buried three of these inside individual entries where they only ever applied once.

## M1. Panel Series
**composes with:** 1, 2, 3, 4, 6, 7, 10

One generation, multiple scenes, one identity held constant across all of them.

> Create a `{{ORIENTATION}}` `{{N}}`-panel composition, `{{ARRANGEMENT}}`. Preserve the
> same facial identity, skin texture, hair, and `{{WARDROBE_ANCHOR}}` across every panel.
>
> **Panel 1:** `{{SCENE_1}}`
> **Panel 2:** `{{SCENE_2}}`

*Notes:* the wardrobe anchor does more work than the identity lock here — describing the
same outfit in each panel is what the model uses to bind the panels as one person. Change
the outfit between panels and you get two people who happen to look alike.

Two panels is reliable, three is inconsistent, four rarely holds. For more than two, run
separate generations against a fixed reference and compose in post.

Each panel needs its own lighting and environment description. Writing them once at the
top and expecting both panels to inherit produces one detailed panel and one vague one.

**Worked example** — archetype 7 with M1 applied, from a working prompt:

> Vertical two-panel composition, one scene above and one below. Same miniature
> professional woman, same beige business suit and white sneakers throughout.
> **Top:** sleeping on a pillow laid across a laptop keyboard, screen showing analytics
> dashboards, warm office light, shallow depth of field.
> **Bottom:** sleeping in an ergonomic office chair wearing a sleep mask, an oversized
> coffee mug beside her marking the scale, blurred workspace, warm golden light.

## M2. Scale Anchor
**composes with:** 1, 6, 7, 8

Any composition asking the viewer to read something as oversized or miniature needs a
familiar object in frame at true size.

> `{{FAMILIAR_OBJECT_A}}` and `{{FAMILIAR_OBJECT_B}}` sit within the frame at natural
> size to establish scale against `{{SUBJECT}}`.

*Notes:* the object must be one whose size nobody debates — a pen, a mug, a coin, a
keyboard key. A chair or a plant fails, because the model can render a small one. Without
this the brain normalises the scene and the scale illusion collapses entirely.

## M3. Palette Lock
**composes with:** all

> Palette limited to `{{THREE_TO_FIVE_COLOURS}}`. No colours outside this set.

*Notes:* three to five entries. Six or more is not a constraint and the model treats it as
a suggestion. This is the single highest-leverage modifier for brand consistency across a
campaign — same archetype, same palette, different subjects, and the set reads as one
family.

## M4. Documentary Restraint
**composes with:** 9, 10, 13

> Documentary realism. No stylisation, no colour grading beyond neutral correction, no
> lens effects. Accurate materials and construction detail.

*Notes:* the counterweight to the render tail. Restoration, technical, and evidentiary
imagery loses credibility the moment it looks produced. Apply this instead of the standard
render tail, not alongside it — they pull against each other.

---

# STILL IMAGE

## 1. Dimensional Break
**use_for:** beverage, FMCG, product launch, scroll-stopping social
**ratio:** 4:5

A hyper-realistic surreal composite on a `{{SURFACE}}`. An oversized `{{DEVICE}}`
dominates the frame, creating a strong dimensional-break illusion. On the screen,
`{{SUBJECT}}` appears in a close-up `{{SCENE_ENV}}`, `{{SUBJECT_ACTION}}`. A real human
hand `{{REAL_WORLD_ACTION}}` toward the screen. The `{{MEDIUM}}` visually breaks through
the display and continues into the scene inside the screen. `{{SCALE_PROP_A}}` and
`{{SCALE_PROP_B}}` sit beside the device to emphasise scale distortion. Warm natural
lighting, soft cinematic shadows, realistic reflections on glass and screen, surreal
commercial advertising look.

*Notes:* the illusion depends on the scale props. Without a familiar object beside the
device, the brain reads it as a normal phone and the effect collapses. Liquids and
particulates break through most convincingly; solids read as pasted. See M2.

## 2. Double-Exposure Editorial Collage
**use_for:** brand identity, values pieces, recruitment, conference keys
**ratio:** 4:5

A premium mixed-media editorial collage portrait of `{{SUBJECT}}` in `{{POSTURE}}`,
facing `{{DIRECTION}}` in profile, expressing `{{EMOTION}}`. Behind the subject, a large
textured `{{ACCENT_COLOUR}}` circular form creates a halo around the head, with painterly
watercolour texture and distressed paper grain. The portrait blends into a double-exposure
landscape within the lower half of the body featuring `{{LANDSCAPE_ELEMENTS}}`. The lower
body dissolves into layered paper textures, transparent photographic fragments,
architectural overlays, grid lines, torn paper edges, and faded editorial graphics.
Palette limited to `{{PALETTE}}`. Minimal off-white gallery background with abundant
negative space. Fine-art poster composition, painterly realism, soft paper grain.

*Notes:* the palette limit is load-bearing — remove it and it renders as muddy collage.
Three to five colours maximum. The halo must sit behind the head, not around the body.

## 3. Studio Milestone Portrait
**use_for:** announcements, anniversaries, certifications, team milestones
**ratio:** 4:5

A professional editorial studio portrait of `{{SUBJECT}}` wearing `{{WARDROBE}}`,
`{{EXPRESSION}}`, positioned beside `{{PROP}}` that spells "`{{WORD}}`". Clean minimalist
solid `{{BACKDROP_COLOUR}}` seamless studio backdrop. High-end editorial photography, soft
studio lighting casting gentle shadows, shallow depth of field, sharp focus.

*Notes:* `{{WORD}}` should be four characters or fewer — longer strings degrade. Physical
lettering (blocks, tiles, signage) renders far more reliably than rendered type. Works for
"ONE", "CERT", "10 YR", and CARSI qualification announcements.

## 4. Real + Illustrated Duo
**use_for:** personality-led social, founder content, training characters
**ratio:** 4:5

[IDENTITY LOCK]

A mixed-media portrait combining a realistic person with a large black-and-white
hand-drawn doodle of the same person. Clean minimalist white studio wall, soft natural
daylight from the left. The real person stands on the left, `{{REAL_POSE}}`, wearing
`{{WARDROBE}}`. On the right, a large hand-drawn illustration of the same person in the
same hairstyle with exaggerated proportions, `{{DOODLE_POSE}}`. Add the handwritten word
"`{{CAPTION}}`" beside the doodle with playful accents — stars, sparkles, motion lines,
sketch marks. Clean black ink line art with white fill, bold outlines, expressive features.
Maintain composition balance between the real person and the illustration.

*Notes:* keep the doodle's hairstyle matched to the photo or the pairing stops reading as
the same person. Caption under three words.

## 5. Multi-Clone Product Collage
**use_for:** tech and equipment launches, service explainers, feature reveals
**ratio:** 4:5

A realistic premium advertisement with a multi-exposure collage composition. Scene:
`{{ENVIRONMENT}}`, with the sky area replaced by a clean `{{ACCENT_COLOUR}}` background
with subtle square grid lines. The same `{{SUBJECT}}` appears three times in one
composition: `{{POSE_1}}`, `{{POSE_2}}`, and `{{POSE_3}}`. The subject wears the identical
outfit in every appearance: `{{WARDROBE}}`. An oversized hand emerges from the centre
holding `{{PRODUCT}}` toward the camera as the primary focus. Add `{{N}}` oversized
floating renders of the same product at the frame edges. Include hand-drawn white doodles —
question marks, curved sketch lines, graphic accents. At the top right, a handwritten
white title reading "`{{TITLE}}`". Soft natural daylight, realistic shadows, clean cutouts,
commercial advertising style.

*Notes:* wardrobe must be described identically for all three clones or they render as
three different people. Three clones is the ceiling; four becomes noise.

## 6. Miniature Diorama Collectible
**use_for:** location content, franchise and territory announcements, event recaps
**ratio:** 4:5

[IDENTITY LOCK]

An ultra-detailed handcrafted 3D diorama of `{{PLACE}}` on a premium circular walnut
display base with an engraved brushed-metal nameplate reading "`{{PLACE_NAME}}`". The
subject stands confidently at the centre, rendered as a premium semi-realistic collectible
figurine — not cartoon or Pixar style — surrounded by a miniature `{{PLACE}}` streetscape.
Include landmarks: `{{LANDMARKS}}`. Add miniature props: `{{PROPS}}`. Handcrafted
environment with `{{TERRAIN_DETAILS}}`. Museum-quality handcrafted resin collectible in
wood, stone, ceramic, glass, fabric, and metal. Warm golden-hour lighting, soft cinematic
shadows, shallow depth of field.

*Notes:* "semi-realistic collectible figurine, not cartoon" is the phrase that keeps the
face recognisable. Five to seven landmarks; beyond that they shrink past legibility.

## 7. Miniature Person, Macro World
**use_for:** relatable workplace themes, burnout and wellbeing, whimsical explainer
**ratio:** 4:5

[IDENTITY LOCK]

An ultra-realistic cinematic macro photograph of a tiny miniature person with an oversized,
highly expressive realistic face and a proportionally small realistic body, `{{ACTION}}`
within `{{MICRO_ENVIRONMENT}}` constructed from oversized everyday objects:
`{{GIANT_OBJECTS}}`. The subject wears `{{WARDROBE}}`. `{{LIGHT_SOURCE}}` casts
`{{LIGHT_QUALITY}}`. The scene sits on `{{SURFACE}}` with `{{SUPPORTING_PROPS}}`.
Background is soft bokeh. Emphasise the dramatic scale difference between the tiny person
and the oversized objects. DSLR macro photography, volumetric lighting, razor-sharp focus.

*Notes:* the oversized-face instruction is what makes expression readable at miniature
scale — drop it and the face renders as an unreadable smudge.

## 8. Premium Product Hero
**use_for:** food, equipment, kit, packaged product
**ratio:** 1:1 or 4:5

An ultra-realistic premium commercial photograph of `{{PRODUCT}}` centred on
`{{SURFACE_OR_PEDESTAL}}` against a `{{BACKGROUND}}` background. `{{GARNISH_OR_CONTEXT}}`
arranged with restraint. Macro detail on `{{HERO_TEXTURE}}`. Studio lighting with
`{{LIGHT_DIRECTION}}`, shallow depth of field, physically accurate materials, realistic
reflections, premium advertisement quality.

*Notes:* one hero texture only. Naming three competing textures splits the model's
attention and all three render soft.

## 9. Before / After Split
**use_for:** Disaster Recovery, RestoreAssist, restoration case studies
**ratio:** 16:9 or 1:1

A single photorealistic interior of `{{ROOM_TYPE}}` divided by a clean vertical seam down
the centre of the frame. Left side: `{{DAMAGE_STATE}}` — `{{DAMAGE_DETAILS}}`, dim
overcast light, desaturated colour, visible `{{DAMAGE_TEXTURE}}`. Right side: the same room
fully restored — `{{RESTORED_DETAILS}}`, clean dry surfaces, warm natural daylight, neutral
accurate colour. Identical camera position, identical furniture placement, identical
architecture on both sides. Documentary realism, no stylisation, accurate building
materials, correct Australian residential construction detail.

*Notes:* "identical camera position and architecture" is the whole archetype — without it
the model renders two different rooms and the comparison is worthless. Keep the seam hard;
gradients read as a filter rather than a transformation. Avoid exaggerating the damage
side — insurance-adjacent content that overstates damage is a credibility risk, not a
creative choice.

## 10. Technical Authority Portrait
**use_for:** CARSI instructors, NRPG credibility, expert positioning, LinkedIn
**ratio:** 4:5

[IDENTITY LOCK]

A professional environmental portrait of `{{SUBJECT}}` in `{{WORK_ENVIRONMENT}}`, wearing
`{{PPE_OR_WORKWEAR}}`, `{{ACTION_OR_STANCE}}`, looking `{{GAZE}}`. `{{EQUIPMENT}}` visible
and in correct working use. Natural light from `{{LIGHT_SOURCE}}` with controlled fill,
shallow depth of field isolating the subject from a softly defocused background. Documentary
editorial photography, authentic workwear detail, no studio gloss.

*Notes:* the credibility comes from equipment being held correctly. Name the equipment
specifically — a generic "meter" renders as a prop. "No studio gloss" prevents the
stock-photo look that undermines technical authority.

---

# MOTION

## 11. Exploded Component Infographic
**use_for:** product anatomy, kit contents, process breakdown, training explainers
**ratio:** 16:9 · **duration:** 10s

Static camera, `{{BACKGROUND}}` background. `{{SUBJECT}}` stays centred throughout.

- **0.0–1.0s** — the complete `{{SUBJECT}}` explodes vertically into aligned floating
  layers: `{{LAYERS}}`. Fast clean separation, then freeze in mid-air.
- **1.0–2.0s** — rounded glass interface panels appear with spring animation around the
  floating components. Thin white connector lines extend from each component to its panel.
  Transparent dark glass, ultra-thin borders, no text.
- **2.0–5.5s** — inside each panel, photorealistic miniature loops play simultaneously:
  `{{PANEL_CONTENT}}`. Components remain motionless. Connector lines stay attached.
- **5.5–6.8s** — loops stop together. Panels fold inward, connector lines retract until
  gone.
- **6.8–8.2s** — components move back simultaneously and reconstruct `{{SUBJECT}}` layer by
  layer, identical to the opening frame.
- **8.2–10.0s** — `{{PAYOFF_ACTION}}`, held in frame.

Cinematic macro, premium studio lighting, physically accurate materials, minimalist UI,
smooth spring motion. No text, no logos, no lens flares.

*Notes:* the reconstruction beat is what makes it feel designed rather than random. The
payoff must physically demonstrate the product's key property. Five to six components
maximum — more and the panels overlap.

## 12. Luxury Commercial Sequence
**use_for:** premium service, brand film, high-consideration offers
**ratio:** 9:16 · **duration:** 10s

Hero shot of `{{PRODUCT}}` resting on `{{PEDESTAL}}` surrounded by `{{ENV_ELEMENTS}}`.
Transition as `{{SUBJECT}}` in `{{WARDROBE}}` moves gracefully toward camera. Cut to macro
close-up as a hand `{{INTERACTION}}`, revealing `{{HERO_TEXTURE}}`. Show `{{APPLICATION}}`.
Finish with close-ups, product-in-hand, and a final hero shot of `{{PRODUCT}}` with
`{{ATMOSPHERE}}`.

Smooth camera push-ins, slow dolly, macro close-ups, soft diffused lighting,
`{{COLOUR_GRADE}}` grading, shallow depth of field, seamless transitions. No text,
subtitles, logos, or graphics.

*Notes:* five beats in ten seconds is the ceiling. A sixth makes every cut feel rushed.
Name the colour grade explicitly — it is what unifies otherwise unrelated shots.

## 13. Process Time-Lapse
**use_for:** restoration jobs, drying and remediation, install and build sequences
**ratio:** 9:16 or 16:9 · **duration:** 8–10s

Locked-off camera on `{{SCENE}}`. Time-lapse through `{{PROCESS_STAGES}}`, with
`{{EQUIPMENT}}` visibly working throughout. Light shifts naturally from `{{START_LIGHT}}`
to `{{END_LIGHT}}` across the sequence, marking passage of time. Camera never moves;
architecture and framing remain constant. Documentary realism, accurate materials, no
stylisation, no speed-ramp effects.

*Notes:* the locked camera does the same job as archetype 9's identical framing — it is the
proof that this is the same space. Once the camera moves, it reads as edited footage rather
than evidence.

---

# ASSET PIPELINES

A different family. Not a prompt: a sequence of tool handoffs producing an interactive
artefact.

## P1. Image → 3D → Interactive Explainer

Produces a browser-based interactive model with labelled hotspots. Suited to CARSI
training modules, equipment explainers, and damage-type walkthroughs.

**Stages**

1. **Design frame** — one image establishing the visual language of the whole set: palette,
   material treatment, lighting, background. Everything downstream inherits from this, so
   it is worth iterating here rather than fixing inconsistency later.
2. **Component images** — one image per object, generated individually against the design
   frame. Batch generation produces a set that does not match.
3. **Image → 3D** — each image converted to a mesh via an image-to-3D service. Output at
   this stage is unusable on the web; see the constraint below.
4. **Scene assembly** — a coding agent given the design frame, the master prompt, and the
   model set, building the three.js scene, camera behaviour, and interaction.
5. **Optimisation pass** — decimation and compression per model, plus on-demand loading.
6. **Annotation layer** — hotspot markers and their explanatory copy, plus context
   illustrations showing where each component sits in the whole.

**The constraint that decides whether this ships**

Raw image-to-3D output runs 120–150 MB per model. A twenty-model scene is roughly 900 MB
and renders around 16fps — which is to say, it does not work. The reported optimisation
brought models to 2–5.5 MB each and the total to under 30 MB, roughly a 97% reduction, with
on-demand loading so nothing loads before it is needed.

*Treat those figures as the reported result of one build, not a benchmark. The ratio is
the useful part: expect the optimisation pass to be most of the work.*

**Why this belongs in the library as a warning, not just a recipe**

The first build looked correct. Every model rendered, every material was right, the design
language held. It was also unshippable, and no visual check would have caught it — the
failure was frame rate and payload, not appearance.

Any quality gate for generated 3D assets has to measure payload and frame rate, not just
whether the thing looks right. A gate that only inspects the render passes a 900 MB scene.

**Slots**

```
P1 {
  subject_domain:   string      // "restoration equipment", "structural drying"
  design_frame:     image_ref
  components:       string[]    // one entry per model
  hotspots:         [{ component, label, copy }]
  target_payload_mb: number     // gate threshold, not aspiration
  target_fps:        number     // gate threshold
}
```

---

## Gaps in v0.1

Deliberately not covered yet, in rough priority order:

1. **Text-bearing formats** — anything requiring accurate rendered copy. Current models are
   unreliable past a few characters. Compose type in post, not in the prompt.
2. **Multi-person group compositions** — identity fidelity degrades sharply past two
   referenced people.
3. **Named-brand product replication** — competitor or partner packaging. Policy question
   before it is a capability question.
4. **Sequential character consistency** — the same person across multiple generated frames.
   This is the blocker for narrative video and is worth solving before adding more
   single-frame archetypes. M1 is a partial answer bounded at two panels.

### P1-specific gaps

- No image-to-3D service is currently wired into Synthex. This pipeline is specified, not
  available.
- Steps 2 and 3 fan out cleanly — one component each, no cross-dependency. Step 4 is the
  barrier. Worth building as a graph rather than a chain if the component count goes past
  about ten.
- The annotation copy in step 6 should route through `nexus-copywriter` rather than being
  generated inline, or the labels drift from the brand voice used everywhere else.
