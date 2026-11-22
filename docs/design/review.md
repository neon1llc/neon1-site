# Review checklist

Run on every visual or interaction change before reporting it. Each item is pass or fail with evidence, not a feeling.

## Before building

- [ ] Placement: does it belong where the person already is? Why not inline, a popover, or a panel? (patterns.md)
- [ ] Reuse: which existing part did you extend? Name it. (components.md)
- [ ] References: 2 to 4 products that solve the same problem and what you took from each. Written in the PR or docs.

## Tokens and rules

- [ ] Sizes are `--fs-*` and spacing is `--sp-*`. No numeric font size without a comment naming why. `make logic` and `layout-contract.test.ts` pass.
- [ ] Helper, caption, and meta text at or below 13px. Titles at or above 15px. Helper never larger than its title.
- [ ] Colors are tokens. No new hex literal outside a token block.
- [ ] Links: internal underlined, outbound bold with the northeast arrow and no underline, in all four looks.
- [ ] Motion uses `--t-*` and `--ease`. Reduced motion and `data-motion="off"` change at once.
- [ ] No inline scripts, styles, or `style=""` on neon1.tech (strict CSP).

## Copy

- [ ] Every line earns its place. No meta, no repeated info, no intro or outro help, no disclaimer outside its one place. (copy.md)
- [ ] Buttons say the action. Errors say what and how to fix. Empty states say what belongs and offer one action.

## Behavior

- [ ] Every state exists: default, hover, focus-visible, active, disabled, loading, empty, error, success.
- [ ] Keyboard only: reachable, visible focus, Escape closes, focus returns.
- [ ] Targets at least 44 by 44 for primary controls on touch.
- [ ] First tap into a field: no zoom, no jump, no covered field. Keyboard opens and closes cleanly.
- [ ] Scrolling past the element, Back and Forward, open and close, resize and rotate.
- [ ] Contrast meets WCAG 2.2 AA on every background in every look. Works at 200% zoom and 320px wide.

## States and feedback

- [ ] Render order is loading, then error, then empty, then content. The error says what failed and offers retry.
- [ ] Empty: a short title that says what is missing, one line of description under 14 words, an action that matches the title. A filter that returns nothing shows plain text and no create action.
- [ ] Loading: delay the spinner 200 to 300ms so quick fetches do not flash. Keep navigation and tab bars in place while a tab loads. A saving button shows a pending state. Size the spinner to the area it fills.
- [ ] Toast for temporary feedback after an action, a few words and gone on its own. Banner for a persistent problem that needs action.
- [ ] Error text names what happened and what to do next, in under 90 characters where a line allows.
- [ ] Components take explicit variants (`danger`), not a pile of boolean props.
- [ ] Anything personalized or automatic shows why and can be reset or turned off.

## Auditing

- Score each finding with a severity (0 cosmetic to 4 blocking) against the usability heuristics, and list the top five fixes first.
- Draft copy as several options and pick one. Mark assumptions in any persona or research summary.
- A static read of the markup is not an accessibility result. Confirm with a keyboard, a screen reader, and a phone.
- Measure whether people finish and understand, not only whether they click.

## Evidence

- [ ] Tested on the matrix in testing.md. Interactions tested, not only screenshots.
- [ ] Self-review with screenshots against the references and against Neo's panel. Would a demanding designer ship it? If not, revise first.
- [ ] Report says exactly what was not covered and why. Never "untested on iPhone".
