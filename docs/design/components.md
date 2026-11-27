# Components

What already exists. Extend one of these before building another. Class names are the real ones in `shared/neon1.css`, `shared/chat.css`, `css/frame.css`, and 1NEON's `app.css` and `ui.tsx`.

## Shared (neon1.tech and 1NEON)

| Part | Where | Notes |
|---|---|---|
| Top bar, logo | `.n1-bar`, `.n1-inner`, `.n1-logo` in `shared/neon1.css` | 64px, same boxes on every page. `scripts/frame.py check` fails if a page's bar or footer differs from `index.html`. |
| Legal strip | `.legal` in `shared/neon1.css` | The foot every surface ends in: theme choice, copyright and policy lines with backslashes between links, and report bug \ feedback level with Neo's launcher. The site, 1NEON's public screens, and the dev and admin sign-ins use it; each supplies `--muted`, `--text`, `--line`, `--glow`, `--mono`. |
| Wordmark | `.wm` with `.ne` and `.one` | Branding only: the bar's logo, the landing hero, the footer mark. The 1 keeps the surrounding size and weight and "neon" is scaled up and lightened to meet it (DESIGN.md, Wordmark). Everywhere else `neon1` is plain text at the text's size, lowercase. Never redrawn, stretched, or recolored. |
| Helper text | `.helper`, `.helper.warn` | One style for every hint, caption, and status line. A problem is the same line in red. |
| Required mark | `.req` | After the label, sans face at the label's size. |
| Arrow | `.arr`, `.arr-next`, `.arr-mixed` | Drawn, not typed. One shape and one bold stroke everywhere; never override `--arr-t`, never use a chevron glyph, icon, +/− or the browser's triangle. The northeast outbound arrow is a separate mark. |
| Disclosure size | `--arr-fs`, `--arr-fs-sm` | Anything that opens or closes uses `--arr-fs` on rows of reading text and larger, `--arr-fs-sm` in controls and small labels. A fixed icon size apart from the title's size, as in Radix and GitHub Primer. |
| Expandable | `.n1-fold` on a `<details>`, plus `.n1-more` for a small label | Arrow and panel move, reverse, and settle together on `--t-open`. Eased by `js/fold.js` or `js/views.js`. |
| Motion | `--t-fast`, `--t-base`, `--t-slow`, `--t-open`, `--ease` | Zero under reduced motion and `data-motion="off"`. |
| Appear | `.n1-appear` | Errors, results, and panels ease in from just above. |
| Input caret | `shared/caret.js`, `--n1-caret` | Matrix only. Sentinel keeps the browser caret. |
| Neo | `.n1chat`, `.n1chat-launch` in `shared/chat.css` | The assistant window and its launcher. The bar for in-context help (see patterns). |
| Rain, glass | `#rain`, `.glass`, `.rainctl` | Decoration. Pauses on request and stops when hidden. |

## Buttons and links

- Buttons: `.btn` with `.btn-primary`, `.btn-ghost`, `.chip`, `.btn-danger`. A button does something.
- Links go somewhere. A link that stays in the product is underlined thinly at 55% of its color and takes the full color on hover and focus. A link that leaves (`a.ext` on the site, `a.out` in 1NEON, `.n1chat-link` in Neo) is bold, never underlined, and ends in the northeast arrow. Same in every look and mode. Do not restate it per theme.
- Outbound marks are added by the site's build scripts. Do not hand-write an arrow.

## 1NEON

| Part | Where | Notes |
|---|---|---|
| Shell | `Shell.tsx`, `.shell`, `.side`, `.shell.mini` | Persistent side rail, 53px mini rail on a phone, sticky context bar, phone bottom tab bar. Rows shorten with window height so the open menu fits. |
| Dialog, ask, toast | `Dialog`, `useAsk`, `useToast` in `ui.tsx` | Confirm with `useAsk`; an action with choices gets its own dialog on `Dialog` (`MemberActs.tsx`). |
| Action button | `Act` in `Act.tsx`, `.act` | A record's actions: icon, then its name on the first press, then it acts. See patterns. |
| Arrow | `Arr` in `ui.tsx`, `.arr` | The one drawn arrow; `dir` turns it. Never a font glyph or icon arrow. |
| Empty state | `Empty` in `ui.tsx` | One line and, where it helps, one action. |
| Badges and progress | `LayerBadge`, `Rings`, `OnionProgress`, `Health`, `Trend` | Layer greens `--l1` to `--l4` hold 4.5:1 against the badge text. |
| Palette, row menu, bell | `Palette.tsx`, `RowMenu.tsx`, `Bell.tsx` | The in-context controls the menu does not need to carry. |
| Fields | `input`, `textarea`, `select` | `--fs-input`, 16px on a touch screen so iOS never zooms. |
| Public bar, footer | `PublicBar.tsx`, `PublicFooter.tsx` | Match the site's. |

## neon1.tech

- Landing: scroll-snapped views, fluid `clamp()` headline sizes (the only sizes outside the scale), spacing still in px.
- Knowledge Center: `.kc-toc` ("On this page"), `.kc-crumbs`, `.kc-card`, `.kc-shelves`. Its index and bar are the model for any long-document navigation.
- Blog, feedback, report a bug, not found: use `--sp-*`.
- Case panel, phone menu, footer: share the bar's tokens.

## Email

Table based, light, one template (`factmail.ts`). The logo is nested bordered `div`s and text, never an image, so Gmail's iOS color inversion recolors it with the words. Outlook for Windows ignores `border-radius` and gets the mid-green PNG from `/shared/mail`. No inline attachments. Brand colors and the lockup match the site. Test in Gmail iOS, Gmail web, Apple Mail, and Outlook, in light and dark.

## Admin

Eleven bookmarkable sections grouped Needs, Execute, Observe, Normalize. Desktop side rail. On a phone, four frequent destinations in a safe-area-aware bottom bar and a Menu that opens a native modal with all eleven. Links use `aria-current="page"`, not a tablist. It inherits the portal's tokens and patterns and adds none.

## Known gaps (fix when touched)

- 1NEON `.btn` is 36px tall and several rows and filters are 40px. Primary controls should reach 44px on a touch screen.
- Colors: about 370 literals outside token blocks. New code uses tokens only.
- The landing's spacing is px, not `--sp-*`.
