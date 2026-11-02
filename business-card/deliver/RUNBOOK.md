# Runbook: from "Stripe says paid" to "proof sent to the buyer"

Stage 1, written 26/10/2026. A person does every step. The computer only builds the card and the
checklist. Nothing here sends email, takes money, or puts a card on the internet.

**Who is who**

- **Phill** makes the decisions marked "Phill decides".
- **The builder** is whoever Phill asks to build cards. It can be Phill.

## What each card costs (to check the payment)

| What they bought                                        | Price   |
| ------------------------------------------------------- | ------- |
| Ready-made card (one of the nine ready-made films)      | AUD 249 |
| Made-for-you card (a custom film, made after the proof) | AUD 449 |
| Each extra business on the card                         | AUD 199 |

## Step 1. Stripe says paid (the builder)

1. Open the payment in the Stripe dashboard.
2. Write down three things: which card they bought, how many extra businesses, and the buyer's email.
3. Make up an order reference, like `UG-20261026-01`. Letters, numbers and dashes only.
4. Keep the Stripe payment ID in your own notes. **Never put payment details in the order file.**
   The builder script refuses any field it does not know.

## Step 2. Ask the buyer for their details (the builder)

Email the buyer from your own email. Ask for:

1. Their name, exactly as it should show on the card.
2. One short line under the name, like "Owner, Sample Plumbing Co".
3. The email for the card.
4. The phone for the card, or "no phone". (Visitors don't see the phone on the card. It goes into the
   contact they save.)
5. Every business: its name, its website (must start with `https://`), and one short line about it.
   The first business is the main one. Each extra one must have been paid for.
6. Their logo, as a PNG or JPEG file. It must be their own logo. (A JPEG is fine from the buyer; you turn it
   into a PNG in Step 3, because the builder only takes PNG.)
7. Optional: their main brand colour (like `#1FA2D6`) and where it came from.
8. Ready-made only: which of the nine films they want. The nine are portal, blueprint, forge,
   constellation, ink, rewind, skyline, origami and magnet. (The showroom's tenth edition is Phill's own
   and is never offered to a buyer.)

Wait for their answers. **Never guess a missing answer.** If something is missing, ask again.

## Step 3. Fill in the order file (the builder)

1. Make a folder for this order **outside the repository**, like `~/card-orders/UG-20261026-01/`.
   Buyer details never go into the repository.
2. Copy `business-card/deliver/sample/sample-order.json` into that folder as `order.json`.
3. Put the buyer's logo in the same folder.
4. Re-export the logo as a fresh PNG. This makes it small (about 256 pixels wide, under 120 KB) and rebuilds the
   picture, so no hidden EXIF, GPS, author, comment or thumbnail data from the buyer's file comes along. On a Mac:
   `sips -s format png -Z 256 logo.jpg --out logo-256.png`
   On another computer use an equivalent re-encode (open the logo, then Export or Save As a new PNG). The builder
   only takes a PNG, and rebuilds it from its pixels again, but the re-export is the step that counts: tick it in
   PROOF.md.
5. Change every value in `order.json` to the buyer's answers:

| Field                           | What goes in it                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `order_ref`                     | Your reference from step 1                                                             |
| `tier`                          | `ready-made` or `made-for-you`                                                         |
| `film`                          | Ready-made: one of the nine film names. Made-for-you: exactly `custom, pending proof`  |
| `buyer_name`                    | Their name                                                                             |
| `role`                          | The short line under the name                                                          |
| `email`                         | The card's email                                                                       |
| `phone`                         | `{"display": "0400 555 123", "tel": "+61400555123"}`, or `null` for no phone           |
| `businesses`                    | A list. Each one has `name`, `url` and (if they gave one) `note`                       |
| `extra_businesses`              | How many extra businesses they paid for. This must be the number of businesses minus 1 |
| `logo_file`                     | The logo's file name, like `logo-256.png`                                              |
| `brand_colour`, `colour_source` | Optional, and always together. Delete both if they gave no colour                      |

The full rules are in `order.schema.json`.

## Step 4. Build the card (the builder)

From the repository folder, run:

```
python3 -I business-card/deliver/build_order.py ~/card-orders/UG-20261026-01/order.json ~/card-orders/UG-20261026-01/built
```

- **If it says `REFUSED`**, read every line. Each line names the field that is wrong. Fix
  `order.json` and run it again. If the `built` folder already has files in it, delete that folder
  first or pick a new name.
- **If it says `Built ... files`**, go to step 5.

What you get in the `built` folder:

- `card/` is the card. This folder, and only this folder, would ever go on the internet.
- `PROOF.md` is your checklist.
- `brand-kit.json` and `order.json` are records of what was built. They never go on the internet.

## Step 5. Read PROOF.md (the builder)

It tells you:

- the listed total, so you can check it matches what Stripe says was paid
- every business and link on the card
- the film: which ready-made film, or **FILM PENDING** for made-for-you
- what is still missing
- the boxes to tick before anything goes public

## Step 6. Look at the card yourself (the builder)

1. Run: `python3 -m http.server 8000 --bind 127.0.0.1 --directory ~/card-orders/UG-20261026-01/built/card`
2. Open http://127.0.0.1:8000 in Chrome.
3. Look at it at phone size (Chrome DevTools, phone view) and at full desktop size.
4. Check that:
   - the film plays when the card opens (ready-made only)
   - the name and the line under it are right
   - every business shows, and each "Visit site" opens the right website
   - "Save to my phone" downloads the contact file
5. Stop the server with Ctrl+C.

`card/preview.html` opens on its own without a server, but it does not play the ready-made film.

## Step 7. The film

- **Ready-made:** the film in the card is the showroom copy. **It ends on the Unite-Group logo, not
  the buyer's.** Phill decides whether ready-made cards ship like that or with a copy that ends on the
  buyer's logo. Until Phill decides, do not send the card to be hosted.
- **Made-for-you:** the film is not made yet. The card opens on the buyer's logo until it is.
  Making the film is a separate job: real images only, from the buyer's own website and photos,
  through the approved image and video tools, with Phill's OK on any cost. When the film is made and
  the buyer has approved it, add it to `brand-kit.json` and build again.

## Step 8. Send the proof to the buyer (the builder)

1. Take screenshots of the card at phone size.
2. Email the buyer from your own email with the screenshots and their details exactly as written in
   `PROOF.md` (name, line, email, phone, every business and link).
3. Ask them to reply "approved" or to say what to change.
4. If they want changes, change `order.json` and go back to step 4, using a new empty `built` folder.

**This is where Stage 1 stops.**

## What is NOT automated yet

- Nothing reads Stripe. A person checks every payment by hand.
- Nothing emails the buyer. A person sends every email.
- No order form fills in `order.json`. A person types it from the buyer's answers.
- The made-for-you film is not made by this script.
- **Hosting is not done.** Where buyer cards live, and on what web address, is an open decision
  for Phill. This runbook does not pick a host or a domain. Until there is an address, the saved
  contact has no link back to the card, and the card's QR code has nowhere useful to point.
- The "Worked with us? Leave a review" button says "Not connected yet" until the buyer's Google
  Business Profile is connected. Nothing in the order connects it.
- Nobody has yet tried "Save to my phone" from a buyer card on a real iPhone or Android phone.
