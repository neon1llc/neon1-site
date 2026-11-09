# White rabbit scene: performance report

Measured by `make perf` (scripts/perf.cjs) on site v0.32.0, in headless Chromium 153.0.8010.12, on 2026-11-09.

## How it is measured

The script serves the site on loopback, enters the scene the way a visitor does (`?rabbit=now`, then a click or tap on the rabbit), and scrolls to six fixed checkpoints. At each one it waits for the scroll to settle and records 12 frames of three.js's `renderer.info`: draw calls and triangles for the scene itself (the RenderPass, including any shadow map update) and for the whole frame (every postprocessing pass), and the live geometries, textures, and shader programs. Counts are the median frame; geometries, textures, and programs are the most seen.

Those counts depend on the scene, not the machine, so they are what the budget holds. Headless Chromium draws WebGL in software (SwiftShader), so **frame times and the time to the first frame are software-rendered**: useful only for comparing runs on the same machine, never as a phone's or a desktop's real speed. The scene's adaptive step sees those slow frames too and lowers its pixel ratio and drops bloom, so each row notes the pixel ratio and the number of postprocessing passes it ran at; a real desktop GPU keeps bloom, which adds about a dozen full-screen draws to the frame from the window on (the scene's own counts do not change).

Scene ready is the time from the catch to the first composed frame: the rain's stop, the scene's modules, the models and maps, and building the room and the yard.

## Desktop, 1440x900 at 1x

Pointer is fine (the desktop path). Scene ready: 2,002 ms (software-rendered). Bytes fetched after the catch: 5,958 KB.

| Progress | In view | Scene calls | Scene triangles | Frame calls | Frame triangles | Geometries | Textures | Programs | Frame p50 / p95 ms (software) | Pixel ratio, passes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0.05 | at the TV, the landing on its screen | 69 | 137,054 | 71 | 137,056 | 87 | 49 | 31 | 1513 / 1589 | 1, 3 |
| 0.30 | gliding back across the floor, the set and both chairs | 155 | 160,812 | 158 | 160,815 | 172 | 53 | 39 | 2827 / 3037 | 1, 4 |
| 0.45 | turned to the window, the sun in the eyes | 276 | 249,907 | 292 | 249,923 | 376 | 70 | 58 | 1520 / 1727 | 1, 5 |
| 0.70 | walking over, the car on the sill | 419 | 227,337 | 435 | 227,353 | 519 | 70 | 60 | 2517 / 2716 | 1, 5 |
| 0.85 | at the open window, the yard below | 419 | 221,687 | 435 | 221,703 | 521 | 70 | 60 | 2391 / 2653 | 1, 5 |
| 0.95 | out through the opening, the yard and the water | 390 | 158,948 | 406 | 158,964 | 530 | 70 | 60 | 2115 / 2326 | 1, 5 |

Hidden tab: audio running before, suspended while hidden, running after.

## Pixel 7 emulation (412x839 at 2.625x, touch), CPU 4x slower

Pointer is coarse (the phone path: pixel ratio capped at 1.5, the lighter car, no bloom, no antialiasing). Scene ready: 3,234 ms (software-rendered). Bytes fetched after the catch: 5,488 KB.

| Progress | In view | Scene calls | Scene triangles | Frame calls | Frame triangles | Geometries | Textures | Programs | Frame p50 / p95 ms (software) | Pixel ratio, passes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0.05 | at the TV, the landing on its screen | 56 | 127,040 | 58 | 127,042 | 75 | 47 | 31 | 900 / 991 | 1.5, 3 |
| 0.30 | gliding back across the floor, the set and both chairs | 84 | 127,370 | 87 | 127,373 | 102 | 49 | 33 | 691 / 778 | 1.25, 4 |
| 0.45 | turned to the window, the sun in the eyes | 273 (max 274) | 183,106 | 276 | 183,109 | 421 | 59 | 50 | 431 / 487 | 1, 4 |
| 0.70 | walking over, the car on the sill | 220 | 183,909 | 223 | 183,912 | 484 | 59 | 50 | 589 / 650 | 1, 4 |
| 0.85 | at the open window, the yard below | 293 | 185,004 | 296 | 185,007 | 490 | 59 | 50 | 583 / 638 | 1, 4 |
| 0.95 | out through the opening, the yard and the water | 166 | 148,628 | 169 | 148,631 | 509 | 59 | 50 | 558 / 645 | 1, 4 |

Hidden tab: audio running before, suspended while hidden, running after.

## Budget

`scripts/perf-budget.json` holds the most each profile may reach at any checkpoint. It was set from v0.31.0's counts with about 10% headroom, rounded up (the desktop's frame calls, textures, and programs also leave room for bloom, which a real GPU keeps on), so a new feature in the room or the yard that adds draw calls, triangles, textures, or programs past that shows up as a failed `make perf` and gets a deliberate budget change instead of a silent one. Frame times are not budgeted, since this runner can't measure them.

| Profile | Scene calls | Scene triangles | Frame calls | Geometries | Textures | Programs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | 419 of 460 | 249,907 of 275,000 | 435 of 500 | 530 of 585 | 70 of 90 | 60 of 75 |
| phone | 293 of 320 | 185,004 of 205,000 | 296 of 325 | 509 of 560 | 59 of 65 | 50 of 55 |

Every profile is within its budget.

## Hidden tabs

The scene draws only from `requestAnimationFrame`, which browsers stop for hidden tabs, and the controller suspends the audio device on `visibilitychange` and resumes it on return (the rows above show it). Headless pages are always visible, so the script reports the page as hidden through `visibilityState` and the event, as a browser would. The scene's adaptive quality step ignores a frame gap longer than a second, so coming back to the tab doesn't count the time away as one slow frame and lower the quality for the rest of the visit.

## Running it

```bash
make perf                                   # measure and check the budget
PERF_REPORT=docs/perf-report.md make perf   # also rewrite this report
```

It needs Node's `playwright` package and its Chromium, like `make behavior`, so it stays out of `make check`. A desktop and a phone run take a few minutes in software rendering. Run it before adding to the room or the yard, and raise a budget only on purpose, in the same change as what needs it.
