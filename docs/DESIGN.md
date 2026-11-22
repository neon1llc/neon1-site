# Design

How neon1.tech is designed, and the base that 1NEON and every other neon1 surface inherits: the site, the Knowledge Center and blog, 1NEON, Neo, the admin, and the emails. This is the one design source. The values live in `src/app/public/shared/neon1.css`; this page says why they are what they are and how to use them, and the pages below carry the rest.

| Page | Holds |
|---|---|
| This page | Lineage, tokens (type, spacing, color, radius, motion), looks, links |
| [components](design/components.md) | The parts that exist, by surface, and their known gaps |
| [patterns](design/patterns.md) | Placement, navigation, forms, states, mobile, themes, motion |
| [copy](design/copy.md) | The words on screen |
| [review](design/review.md) | The checklist before reporting a change |
| [testing](design/testing.md) | The browser, device, look, and interaction matrix |

1NEON's `docs/DESIGN.md` lists only what the portal adds.

## Lineage

The site is the parent. `shared/neon1.css` defines the base: fonts, brand colors, the type scale, the spacing scale, helper text, the arrow, folds, and motion. 1NEON loads that file and adds only what is the portal's own (its page title size, its text-field size, its menu rows, its cards), built on the same steps. A component below that does the same again and overrides a step only where it must, with a comment saying why. A new surface starts by inheriting, not by writing sizes.

## Type scale

Every text size is a step. Steps are rem, so a person's own text-size setting scales every page. Pixels are at the default 16px root.

| Step | Size | Use |
|---|---|---|
| `--fs-xs` | 12 | captions, meta, badges, mono labels |
| `--fs-sm` | 13 | buttons, field labels, helper text |
| `--fs-ui` | 14 | menu rows, table rows, secondary body |
| `--fs-md` | 15 | compact body, inputs, card and section titles |
| `--fs-base` | 16 | reading text |
| `--fs-lg` | 18 | lead paragraphs |
| `--fs-xl` | 20 | small headings, large numbers |
| `--fs-2xl` | 24 | headings |
| `--fs-3xl` | 32 | display |

Two rules. Helper, caption, and meta text never exceed 13. A card or section title is never below 15. The landing's headline sizes are fluid `clamp()` values and are the only sizes outside the scale. `scripts/scale.test.cjs` (run by `make logic`) fails on any other size written as a number.

## Spacing scale

`--sp-0` 2, `--sp-1` 4, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 24, `--sp-6` 32, `--sp-7` 48, on a 4px grid. The Knowledge Center, blog, feedback and report-a-bug pages, the chat window, and the not-found page use them. The landing's own spacing is still written in pixels, because its scroll-snapped views were tuned by eye; moving it onto the scale is open work.

## Looks and color

Two independent choices, kept separately so changing one keeps the other: the family (Sentinel is the default, Matrix is optional) and the mode (light, dark, or the device's). Together they give four looks.

| Look | Family and mode | Notes |
|---|---|---|
| Providence | Sentinel, light | Ground `#F2F4F2`, accent `#246F38` |
| Desert of the real | Sentinel, dark | Ground `#0F0A0D`, accent `#79CF91` |
| Awake | Matrix, light | Ground `--paper`, brand `#035704` |
| Plugged | Matrix, dark | Ground `--void`, accent `--neon` `#6CFFA8` |

Sentinel is a plain sans with no rain. Matrix keeps the mono labels, rain, and caret. On the site the choice is `data-site-style` and `data-site-theme` on `<html>`; in 1NEON it is `data-style`, `data-theme`, and `data-look`. Components read semantic tokens (`--accent`, `--text`, `--muted`, `--panel`, `--line`, and for status `--err` and `--warn` on the site, `--red`, `--amber`, and `--ok` in 1NEON) and never a literal. Text contrast meets WCAG 2.2 AA on every ground. Colors outside token blocks are known debt (about 370 literals); new code adds none.

## Shape and targets

Corners: `--glass-r` 8 for panes and chips, 1NEON's `--r-sm` 10 for controls and `--r` 14 for cards. Primary touch targets are at least 44 by 44. Fields are 16px or larger on a touch screen. Focus is a 2px ring on `--focus`, offset 2.

## Links

A link that stays in the product is underlined thinly at 55% of its color and takes the full color on hover and focus. A link that leaves (`a.ext`, `a.out`) is bold, never underlined, and ends in the northeast arrow. Same in every look and mode.

## Components that already inherit

- Helper text: `.helper` is one style for every hint, caption, and status line, and `.helper.warn` is the same line in red. A problem is never different text in the same place.
- Links, arrows, folds, and the wordmark follow the website rules in the corpus design standard.
- Motion uses `--t-fast`, `--t-base`, `--t-slow`, `--t-open`, and `--ease`.

## Adding to it

1. Use an existing step. If none fits, change the design, not the scale.
2. If the scale really lacks a step, add it here, in `shared/neon1.css`, and say why in the commit.
3. A one-off size gets a comment on that line naming the reason. A reviewer should be able to find every exception by searching for the comment.

## What this was built from

Said plainly, so it can be corrected:

- The landing page's layout, header, and hero sizes came from a measured study of ten admired sites (Stripe, Linear, Vercel, Oxide, Raycast, rauno.me, Family, Teenage Engineering, Arc, and Apple's MacBook Air page): their computed fonts, sizes, weights, headers and backgrounds at 1440 by 900.
- 1NEON's features came from a survey of open-source project, CRM, and wiki tools (68 searches, 765 repositories), chosen by what to reproduce or replace.
- Accessibility and navigation come from the adopted corpus standard, Design and accessibility (WCAG 2.2 AA, the Nielsen Norman Group heuristics, and the GOV.UK Design System).
- The type and spacing scales are new in this change. They follow the shape of GitHub Primer, Radix, and Tailwind scales (a short named ladder, rem units, a 4px grid) as I know them. Those sites' current values were not fetched when this was written.
- The patterns and the review checklist follow, from memory and not fetched in this pass: Intercom's messenger and Linear's command menu (help and actions inside the page, not a new page), GitHub Primer and Radix (tokens as a short named ladder, states defined for every control, accessible primitives), Stripe (restraint, density, quiet error states), and the GOV.UK Design System (forms and errors). Check them against the live sites when revisiting.
- Before this change, component sizes in both repos were written line by line, with a `--type` multiplier in 1NEON. That was ad hoc, not a system.
