# Hosting plan: Phill's card on its own address

Prepared 22/10/2026 under Phill's approval to *prepare* the public address. Nothing is deployed,
bought or made public. Going live needs Phill's yes to the address and cost below. Tags as in
README.md.

## Proposed address

**https://card.unite-group.ink**

- `unite-group.ink` is already owned by the Unite-Group Vercel team, bought through Vercel and set to
  auto-renew; its DNS is run by Vercel. `[VERIFIED: Vercel API, team Unite-Group, list_domains 22/10/2026]`
- A wildcard record (`*`) already points every subdomain at Vercel, so `card.` needs no DNS change.
  `[VERIFIED: Vercel API, DNS records for unite-group.ink]`
- The group's main domain, `unite-group.in`, is not visible to this Vercel account (403 forbidden), so
  it cannot be used without someone with access. `[VERIFIED: Vercel API]`
- Other owned domains with Vercel DNS: restoreassist.app, nrpg.business, synthex.social, ato-ai.app.
  `[VERIFIED]` Phill's personal card belongs under the group name rather than one product, and
  Synthex is internal, so `unite-group.ink` is the best fit. `[INFERENCE]`

## Cost

| Item | Cost (AUD) | Evidence |
| --- | --- | --- |
| Domain | **No extra cost.** Already owned; its normal renewal is unchanged | `[VERIFIED: renew: true on the existing domain]` |
| DNS | **No extra cost.** Existing wildcard record | `[VERIFIED]` |
| Hosting plan | **No extra cost.** Uses the existing Unite-Group Vercel team | `[VERIFIED: team exists]`; plan tier not shown by the API `[UNCONFIRMED]` |
| Usage | **Expected under AUD $1 a month.** A single static page (about 52 KB with the logo embedded) and a 386-byte contact file; no functions, database or paid add-ons | The whole team billed about US$0.64 across every project for 30/09–02/10/2026 `[VERIFIED: Vercel billing charges]`; the card's share is `[INFERENCE]` |
| Paid add-ons | **None** | — |

**Total: no extra fixed cost; usage expected under AUD $1 a month.**

## What is built and ready (in `business-card/site/`)

- `index.html`: the card as a normal web page, in hosted mode. Its status panel then reads "Live" for
  save-to-contacts and public access. `[VERIFIED: rendered locally on 22/10/2026]`
- `phill-mcgurk.vcf`: the contact file. Pressing "Save to contacts" fetched it in a local browser test.
  `[VERIFIED: Playwright click downloaded phill-mcgurk.vcf]` Opening straight into Contacts on an
  iPhone or Android is `[UNCONFIRMED until tested on real phones]`.
- `vercel.json`: serves the contact file as `text/vcard` and adds two safety headers.
- `build.py`: rebuilds the bundle from `card.html`, so the preview and the live card never drift apart.
- The page carries `noindex`, so Google won't list Phill's mobile number in search results. Remove it
  if he wants the page findable. `[INFERENCE]`

## What still won't work once it's public

- **Connect / the inbox.** Visitors still send the prepared message from their own email app; no
  assistant inbox is connected (AgentMail needs connecting).
- **The White Rabbit game.** It waits on Rana's permanent hosting.
- **The motion video.** It waits on Phill's real photos and a quoted Higgsfield cost.
- **Reviews.** The rule-safe review flow is designed but not built.
- The status panel on the card says all of this in plain words.

## Going live (only after Phill's yes)

1. Create a Vercel project `phill-card` in the Unite-Group team (static, no build step).
2. Deploy `business-card/site/` to production.
3. Add the domain `card.unite-group.ink` to that project.
4. Check `https://card.unite-group.ink` and `/phill-mcgurk.vcf` both load, then tap Save on a real iPhone
   and a real Android phone.
5. Any git push of this branch goes through the pr-release-gate first.

Rollback: remove the domain from the project, or delete the project. Nothing else is touched.
