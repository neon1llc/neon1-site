# Patterns

How parts combine. Each follows a proven product pattern; the references are in [DESIGN.md](../DESIGN.md#what-this-was-built-from).

## Words for a screen

Use these words in reviews, issues, and docs so a note points at one thing:

- **Window**: everything the browser shows. Its height changes as the phone browser's own top and bottom bars show and hide; size to it with `dvh`, never `vh`.
- **Section**: one of a product's places, opened from its menu or phone tab bar (1NEON's Home, Board, Projects, Files, People). On the site, a part of the landing page with its own heading.
- **Section area**: the part of the window a section's content scrolls in, inside the fixed chrome (top bar, side rail, phone tab bar, safe areas). A thing sized to fit "on screen" fits the section area.
- **Card**: a bordered box of content in a section.
- **Card head**: a card's title, and its one line of description when it has one, over the card's rule.
- **Card group**: a labeled group inside one card, such as Overdue in Coming up, or Passkey in Two-step verification.

## Placement first

Before adding a page, a menu entry, or a new surface, ask where the person already is. Pick the first that works:

1. Inline: a line, a field, or a fold in the page.
2. Popover or row menu: a small choice tied to one thing.
3. Panel: Neo's window, the item panel. Help, questions, and actions about the current page belong here.
4. Its own page, only for a task with its own goal that people return to.

The menu is full. A new entry needs a reason a panel cannot meet. Reuse before building: Neo's panel, the Knowledge Center's "On this page", and the shared footer already solve problems that look new. References: Intercom's messenger and Linear's command menu for in-context help, GitHub Primer for deciding when a thing is a page.

## Navigation

- Back and Forward return to the place left, even after visiting a page twice. A link to a section goes to that section. Restore scroll.
- Name the current place: `aria-current="page"`, one clear active row.
- Phone: a menu that fits or scrolls, a bottom bar for the few frequent destinations, safe-area padding on every fixed edge. Collapsing to a mini rail must clip the content, not shrink the rail around full-width rows.
- Menus open toward available space. Focus returns to the control that opened a dismissed menu. Escape closes.

## Forms

One question per field, a visible label, the right phone keyboard, `.req` for required. A wrong field loses nothing. The error says what went wrong and how to fix it, in `.helper.warn` under the field, not in a toast. After submit, say it was received and what happens next, once. Reference: GOV.UK Design System.

## Cards

One rule for every boxed card on the site, 1NEON, and the admin, so spacing comes from the convention, not from per-card fixes.

- Padding is `--pad-card` on all four sides: `--sp-4` on phones, `--sp-5` from 720px. The content sits on it: the last child adds no margin, so the bottom inset matches the top.
- Headings use line-height 1.25 (`shared/neon1.css`). Body leading above a title reads as extra top padding.
- A note under a card's buttons is its own line, `--sp-3` below them.
- The head's rule (under the title, or under title and description in a `.card-top`) runs edge to edge of the card. Rules between rows inside the card stay inset, so the head's line reads as the card's own. A dialog's head takes the same rule.
- A card on a grid of set sizes (1NEON Home) keeps its size: what doesn't fit scrolls inside it, with the head held at the top and a fade at the bottom edge until the end. A long line scrolls sideways in its own list, with its date or key held in place. At either end the same swipe moves the page (overscroll chains), so a card never traps it.
- A project's key never breaks across lines.
- Cards in a grid row stretch to the tallest. A card that ends in a link row pins it to the bottom, so the links line up across the row.

References: Surge AI's site (one line height and generous, even insets), Linear and Vercel (a short gap ladder of 4, 8, and 12), and Radix Themes' Card (padding on a single step).

## Actions on a record

A control that acts on a record (suspend, deactivate, resend, archive, mark all read, retry) is a button, never text that looks like a link. It's the action button (`Act` in 1NEON's `components/Act.tsx`): a small round icon, which opens sideways to its name on the first press and acts on the second. One is open at a time; Escape, a press elsewhere, or opening another closes it. Danger actions turn red once open. References: iOS swipe actions (reveal, then confirm), GitHub Primer's IconButton with its label on demand, Linear's inline row actions.

A major action's second press opens its own dialog (1NEON's `components/MemberActs.tsx` for people): who or what it's for, what happens and what stays, the action's choices (an access level on reactivating, a banner message on suspending), and a stop with the reason when the action can't go through (the last admin). Cancel, Escape, and the backdrop change nothing; the safe button takes focus.

Text inside a sentence that does something ("To use admin actions, confirm it's you") stays inline text, and so do steps in a sign-in flow ("Use a different email").

## Control padding

One rule for padding inside controls, in tokens: `--ctl-px` inside a full-size control (a button), `--ctl-px-sm` inside a small one (a small button, a chip, a segment), and `--ctl-inset` between a group's edge and what it holds (a segmented switch), equal on every side so the pressed segment sits evenly in its track. On touch a group and its control together make the 44px target.

## States

Every control and surface defines default, hover, focus-visible, active, disabled, loading, empty, error, and success. Focus is never removed. Loading keeps the layout's size so nothing jumps. Empty says what belongs here and offers the one action. Error is local to what failed.

## Confirm, undo, destroy

Reversible actions happen at once and offer undo. Destructive or outward actions (delete, send, publish) use `useAsk` with the consequence in the question and a button that names the action, or the action's own dialog when it has choices (see Actions on a record). Never "Are you sure?".

## Mobile and keyboard

- The first tap into a field must not scroll the page away, zoom, or leave a fixed bar covering it. Text fields are 16px or larger on touch.
- While typing, fixed chrome (bar, Neo launcher) fades out and stays out (`n1-typing`).
- Touch targets reach 44 by 44 for primary controls. Check with a 390px coarse pointer.
- Nothing needs hover. Long-press must not reveal preview copies of hidden content.
- A board is one surface the finger pans in any direction at once, like a map: on a phone it scrolls both ways inside itself, no taller than the section area, with no column snapping.

## Themes

Two independent choices: family (Sentinel default, Matrix optional) and mode (light, dark, device). Changing one keeps the other. Every new surface is checked in all four looks: Providence (Sentinel light), Desert of the real (Sentinel dark), Awake (Matrix light), Plugged (Matrix dark). Sentinel uses the plain sans and no rain. Matrix keeps the mono labels, rain, and caret.

## Motion

Use the shared lengths and curve. Something that appears eases in; a fold opens and its arrow turns together. Page changes cross-fade only through the browser's own transitions. Reduced motion and `data-motion="off"` change at once. No motion carries meaning that text does not.

A long page scrolls freely: no section snapping, no key or wheel steering, and nothing hidden until an animation shows it. It says where you are with a section index (`js/pace.js`, `css/pace.css`), after the contents rails of long reading pages. Of Linear, Stripe, Vercel, Apple's MacBook Air page, rauno.me, emilkowal.ski, and Oxide, measured at 1440px on 2026-11-24, none snapped the document.

A highlight eases: what a pointer rests on, or a finger presses, shifts its background, text, and border over `--t-hover` (200ms), in and out. On touch a pressed row takes the same highlight a pointer gives it.

One arrow: the shared `.arr` shape (1NEON's `Arr`) at `--arr-fs`, the size of the landing's code and resources folds, for every disclosure, pager, dropdown, and a card's open or close (turned to point right, down, northeast, or southwest). A browser's own select draws the same polygon. The outbound link's northeast arrow is a separate mark at its own size.
