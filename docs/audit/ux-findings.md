# UX Director Audit — Findings

**Date:** 2026-03-26 | **Auditor:** UX Director (ui-ux skill)

## Critical (accessibility blockers)

| File                                         | Line      | Issue                                                                            | Fix                                                      |
| -------------------------------------------- | --------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `components/sandbox/platform-mockups.tsx`    | 59–81     | 8 buttons (message/retweet/like/bookmark/send/more) missing `focus-visible:ring` | Add `focus-visible:ring-2 focus-visible:ring-orange-500` |
| `components/collaboration/CommentsPanel.tsx` | 451       | Icon button with MoreVertical missing `aria-label`                               | Add `aria-label="More options for comment"`              |
| `components/admin/vault-import-dialog.tsx`   | 1245,1288 | Icon buttons in table rows missing `aria-label`                                  | Add descriptive `aria-label` to each                     |
| `components/pr/CoverageFeed.tsx`             | 272       | Button with no `focus-visible` ring                                              | Add `focus-visible:ring-2 focus-visible:ring-orange-500` |

## Moderate (UX friction)

| File                                             | Line        | Issue                                         | Fix                                                      |
| ------------------------------------------------ | ----------- | --------------------------------------------- | -------------------------------------------------------- |
| `components/collaboration/CommentsPanel.tsx`     | 451         | Touch target `p-1` ≈ 24px (min 44px required) | Increase to `p-2.5`                                      |
| `app/dashboard/layout.tsx`                       | 804         | Touch target `p-1` button                     | Increase to `p-2`                                        |
| `components/affiliates/LinkList.tsx`             | 192,217,227 | Icon buttons `p-1` with tiny icons            | Increase to `p-2` with `h-5 w-5` icons                   |
| `components/EmptyState.tsx`                      | 413,418     | Buttons missing `focus-visible` styles        | Add `focus-visible:ring-2 focus-visible:ring-orange-500` |
| `components/dashboard/get-started-checklist.tsx` | 250         | `p-1` icon button                             | Increase to `p-2`                                        |
| `components/RichTextEditor.tsx`                  | 260,314     | Toolbar icons `h-3 w-3` — too small for touch | Increase to `h-4 w-4`, verify focus rings                |
| `components/dashboard/WelcomeCard.tsx`           | 238         | Close button `p-1`                            | Increase to `p-2`                                        |
| `components/FileUpload.tsx`                      | 319         | Icon button `p-1`                             | Increase to `p-2`                                        |

## Low (polish)

| File                                          | Line           | Issue                              | Fix                                   |
| --------------------------------------------- | -------------- | ---------------------------------- | ------------------------------------- |
| `components/scheduling/time-slot-picker.tsx`  | 503,517        | Nav buttons `p-1`                  | Increase to `p-2`                     |
| `components/SearchBar.tsx`                    | 224            | Clear button `p-1`                 | Increase to `p-2`                     |
| `components/sponsors/DeliverableList.tsx`     | 144,154,160    | `p-1.5` on low-opacity text        | Increase to `p-2`                     |
| `components/dashboard/AutoResearchWidget.tsx` | 147            | Close button `p-1.5`               | Increase to `p-2`                     |
| `components/admin/vault-import-dialog.tsx`    | 1004,1021,1032 | `h-7` buttons borderline on mobile | Monitor; increase to `h-8` if flagged |

## Summary

- **Critical:** 4 issues (missing focus rings, missing aria-labels)
- **Moderate:** 8 issues (touch targets < 44px, no focus ring on empty state buttons)
- **Low:** 5 issues (borderline padding, small toolbar icons)
- **Pass:** All forms have loading/error/success states ✓, all SWR hooks have loading spinners ✓, alt text on all images ✓
