# Patterns

How parts combine. Each follows a proven product pattern; the references are in [DESIGN.md](../DESIGN.md#what-this-was-built-from).

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

## States

Every control and surface defines default, hover, focus-visible, active, disabled, loading, empty, error, and success. Focus is never removed. Loading keeps the layout's size so nothing jumps. Empty says what belongs here and offers the one action. Error is local to what failed.

## Confirm, undo, destroy

Reversible actions happen at once and offer undo. Destructive or outward actions (delete, send, publish) use `useAsk` with the consequence in the question and a button that names the action. Never "Are you sure?".

## Mobile and keyboard

- The first tap into a field must not scroll the page away, zoom, or leave a fixed bar covering it. Text fields are 16px or larger on touch.
- While typing, fixed chrome (bar, Neo launcher) fades out and stays out (`n1-typing`).
- Touch targets reach 44 by 44 for primary controls. Check with a 390px coarse pointer.
- Nothing needs hover. Long-press must not reveal preview copies of hidden content.

## Themes

Two independent choices: family (Sentinel default, Matrix optional) and mode (light, dark, device). Changing one keeps the other. Every new surface is checked in all four looks: Providence (Sentinel light), Desert of the real (Sentinel dark), Awake (Matrix light), Plugged (Matrix dark). Sentinel uses the plain sans and no rain. Matrix keeps the mono labels, rain, and caret.

## Motion

Use the shared lengths and curve. Something that appears eases in; a fold opens and its arrow turns together. Page changes cross-fade only through the browser's own transitions. Reduced motion and `data-motion="off"` change at once. No motion carries meaning that text does not.

A long page scrolls freely: no section snapping, no key or wheel steering, and nothing hidden until an animation shows it. It says where you are with a section index (`js/pace.js`, `css/pace.css`), after the contents rails of long reading pages. Of Linear, Stripe, Vercel, Apple's MacBook Air page, rauno.me, emilkowal.ski, and Oxide, measured at 1440px on 2026-11-24, none snapped the document.
