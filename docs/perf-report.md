# White rabbit scene: performance report

Measured by `make perf` (scripts/perf.cjs) on site v0.32.0, in headless Chromium 153.0.8010.12, on 2026-11-09.

## How it is measured

The script serves the site on loopback, enters the scene the way a visitor does (`?rabbit=now`, then a click or tap on the rabbit), and scrolls to six fixed checkpoints. At each one it records 12 frames of three.js's `renderer.info`: draw calls and triangles for the scene and for the whole frame (every postprocessing pass), plus live geometries, textures, and shader programs. Counts are the median frame. Geometries, textures, and programs are the most seen.

The budget holds these counts because they depend on the scene, not the machine. Headless Chromium draws WebGL in software (SwiftShader), so **frame times and the time to the first frame are software-rendered**. Compare them only between runs on the same machine. The scene's adaptive step sees those slow frames too, lowers its pixel ratio, and drops bloom, so each row notes the pixel ratio and postprocessing passes it ran at. A real desktop GPU keeps bloom, which adds about a dozen full-screen draws from the window on.

Scene ready is the time from the catch to the first composed frame.

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

`scripts/perf-budget.json` holds the most each profile may reach at any checkpoint. It was set from v0.31.0's counts with about 10% headroom, rounded up. The desktop's frame calls, textures, and programs also leave room for bloom. A feature that goes past the budget fails `make perf` and needs a deliberate budget change. Frame times are not budgeted, since this runner can't measure them.

| Profile | Scene calls | Scene triangles | Frame calls | Geometries | Textures | Programs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | 419 of 460 | 249,907 of 275,000 | 435 of 500 | 530 of 585 | 70 of 90 | 60 of 75 |
| phone | 293 of 320 | 185,004 of 205,000 | 296 of 325 | 509 of 560 | 59 of 65 | 50 of 55 |

Every profile is within its budget.

## Hidden tabs

The scene draws only from `requestAnimationFrame`, which browsers stop for hidden tabs. The controller suspends the audio device on `visibilitychange` and resumes it on return. Headless pages are always visible, so the script reports the page as hidden through `visibilityState` and the event. The adaptive quality step ignores a frame gap over a second, so returning to the tab doesn't lower quality.

## Running it

```bash
make perf                                   # measure and check the budget
PERF_REPORT=docs/perf-report.md make perf   # also rewrite this report
```

It needs Node's `playwright` package and its Chromium, like `make behavior`, so it stays out of `make check`. A desktop and a phone run take a few minutes. Run it before adding to the room or the yard, and raise a budget only on purpose, in the same change.
