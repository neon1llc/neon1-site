# Test matrix

Verify on dev with the real build, signed in where the surface needs it. A pass needs every row for the surface under change.

## Browsers and devices

| Class | Engine | Minimum |
|---|---|---|
| Desktop | Chromium (Chrome or Edge) | 1280 by 900, plus 1024 by 600 and 1920 wide for bars and rails |
| Desktop | WebKit (Safari) | 1280 by 900 |
| Phone | iPhone WebKit emulation | 390 by 844, touch, mobile, deviceScaleFactor 2 |
| Phone | Chrome mobile emulation | 390 by 844 and 360 wide |
| Small | any | 320 wide, and 480 by 320 landscape |

Playwright is installed in the repos that use it (`scripts/behavior.cjs` in neon1-site is the model: `open({ viewport, hasTouch, isMobile, reducedMotion })`). Its browsers are cached under `~/Library/Caches/ms-playwright`. Run with `--trace off`.

## Looks and modes

Providence, Desert of the real, Awake, Plugged (see patterns.md). Also device mode with the system in light and in dark, and `reducedMotion: reduce` once.

## Interactions, not only screenshots

- First tap into a field, keyboard open and close, typing, submit, a wrong field.
- Scroll past the element and back. Back and Forward. Open and close menus, folds, panels, dialogs.
- Keyboard only through the whole flow.
- Rotate and resize while open.
- Long-press and text selection on a phone.
- Neo: open from the launcher, type, close, and the panel docked beside the rail.

## Automated checks that must stay green

- neon1-site: `make check`, including `make logic` (scale test, theme test, link checks) and `frame-check`.
- 1NEON: the web tests, including `layout-contract.test.ts` and the theme paint test.
- Touch-target probe at 390px with a coarse pointer, and the link-underline audit.

## Signed-in dev

Use a browser session on dev, not a forged key. The free test account covers the free surfaces. Never commit cookies, tokens, or storage state.

## Reporting

Say what you ran, on which engine, size, look, and mode, and what you did not cover and why. Attach screenshots for what changed. Evidence from source review is not a runtime pass.
