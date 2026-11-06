# Changelog

Site releases use `v0.MINOR.PATCH` until the first complete release, v1.0.0.

## v0.9.0

- Every view starts right under the header. Views that fit are centered between the header and the bottom of the screen; taller ones scroll from their top. The landing view no longer scrolls a little into the next one, and the work view fits a laptop screen.
- Section links and links opened from another page land exactly on their view.
- Resistance between views is about 20% softer.
- "book a call" opens the booking calendar in a new tab, and the contact button is sized to its text.
- The logo has no glow on the light parts of the page, and its "1" now matches the height of the lowercase letters everywhere.
- Rain: larger, brighter glyphs with longer trails. Words spell slowly and stay sharp enough to read. A new button cycles the characters: katakana, symbols, emoji, mixed.
- Open source: each project opens with a short definition and shows "pre-release" (and its version where there is one). DeployOps is now deploy-ops. 1NEON stands for Needs, Engineering, Operations, Nurture.
- "why neon1" is now "about": how it started, what it stands for, and the slogan.
- Hours in questions match the booking calendar.

## v0.8.0

- Scrolling moves one view at a time. At the edge of a view the page resists, giving a little per scroll, then settles into the next view, fast at first and slowing as it lands. Views taller than the screen scroll normally until their edge. Works with mouse, trackpad, touch, keyboard and the header links, all at the same speed.
- First arrival at a view: the heading fades in, then each piece fades and rises into place in order, once. Later visits fade the whole view in and out with the scroll.
- Work cards sit in one row of equal cards that scrolls sideways (touch, trackpad or the arrow buttons) and fades into both screen edges.
- Contact links go to neon1llc@gmail.com until the neon1.tech mailboxes are live.
- Section headings are in the brand green. The prompt mark is its own chevron, one x-height tall, so its point lines up with the middle of the lowercase letters.

## v0.7.0

- Each section is a view. The first time you reach one, its heading slides in from the direction you scrolled from, then its main pieces follow one by one. After that, views fade with scroll position and hold their fade when you stop.
- On larger screens, scrolling settles at the start of each view (proximity snapping, so long views still scroll freely).
- Motion (motion.dev, MIT, v11.18.2) is self-hosted in /js. Without JavaScript, or with reduced motion, everything shows at once with no snapping.
- Work grows to five cards, three over two: the three client projects, security talks, and small home and family jobs, with a short intro line.

## v0.6.0

- Header links are back top right. The header is fixed, clear over the rain, and turns frosted light once the page below the hero takes over. On phones the links fold into a menu.
- Greener glow (#6CFFA8 over #00E676) in place of the lime cast.
- Plainer copy throughout. The "works together, stays yours" line is gone, services name real jobs, and the quote is explained instead of hidden.
- Nav: services, how it works, open source, book a call.
- Larger, tighter section headings. Services read as one sentence per row. The process is a timeline beside a sticky heading.
- One button system (44px, small corners) and one scroll reveal (fade and rise 8px, once), both off with reduced motion.
- The page background turns light after the hero, so the seam no longer shows a grey band.
- Copy is first person ("I"), since neon1 is one person.
- Recent work: three short client cases (accounting knowledge assistant, dermatology intake, two-office AWS migration), each with one measured result.
- A fourth service row for security training and SOC 2 readiness.
- A questions section: on site and remote work, hours, project length, pricing, training, and what's out of scope.
- The story now includes how neon1 started, at a grade school.

## v0.5.0

- Hero is only the wordmark, "1 is glad to be of service." and a falling scroll cue.
- Navigation collapses into one "menu" button with a full-screen menu (Esc closes, focus returns). The header is invisible over the hero.
- One dark-mode neon (#7CFF9E) for the wordmark, mark, buttons and cue.
- Prices removed from the site; services say who each tier is for. The free call and fixed quote move to the contact band.

## v0.4.0

- Two-mode palette: Matrix dark for the hero, very light grey (#F2F4F2) with document green (#035704) and logo green (#327641) for the rest.
- The wordmark bridges both: Matrix glow on dark, document green with a faint Matrix halo on light (nav and footer).
- The wordmark decodes out of random glyphs on load (skipped with reduced motion).
- Services and open source are now a rate sheet of ruled rows instead of identical cards.
- Footer copy and labels tidied.

## v0.3.1

- Wordmark and tagline return to the v0.1.0 style: system monospace, wide tracking, soft double glow.

## v0.3.0

- Waking up: below the hero, the page fades from the Matrix into a light surface; rain, its controls and the header follow.
- Rain words in five glow colors: Matrix/movie easter eggs (white), neon1 names and slogans (green), tech stack (cyan), offerings (amber), values (violet).
- Grid / free toggle: snapped rows or columns falling at their own speeds.
- Browser console greeting.

## v0.2.1

- Self-hosted Inter (text) and JetBrains Mono (headings), both SIL OFL.
- Matrix code palette (#0D0208, #003B00, #008F11, #00FF41).
- Quieter hero: smaller wordmark, tagline and buttons fade in.
- One button system (primary, ghost, chip); "get in touch" in the nav.
- Brand mark in the nav, full footer with contact, links and version.

## v0.2.0

- New single-page layout: services with rate tiers, how we work, open source, why neon1, contact.
- Lighter Matrix rain with a pause control and reduced-motion support.

## v0.1.0

- The 2025 terminal-style landing page (restored to production on 2026-11-05).
