# Changelog

Site releases use `v0.MINOR.PATCH` until the first complete release, v1.0.0.

## Unreleased

### Changed
- Pradeep's photo on the home page is half its old size, and the client quote moved off the home page (it stays in the case study).
- Tighter wording across the home page: services, process, client work, p.r.o.s.e, about, questions, and contact say the same in about a fifth fewer words. The case studies and questions come trimmed from neon1-corpus.

## v0.66.2

### Fixed
- Scrolling back up a Knowledge Center page, the On this page bar rejoins the page the moment it reaches its place, then shrinks there, so no gap shows above it.

## v0.66.1

### Removed
- The plain line and booking button under the slogan. The first screen stays the wordmark and slogan alone, a curiosity to explore; what neon1 does starts one screen down.

## v0.66.0

### Added
- The first screen says what neon1 does in one plain line under the slogan, "Cloud, AI, and IT help for small businesses, offices, and homes," with a button to book the free 15-minute call.
- About shows Pradeep's photo beside the story, and closes with a client's words: Boris M. of Boris M Tax on the knowledge base project, linked to its case study.

### Changed
- The page description, link preview, and structured data call neon1 a technology practice, without "one-person".
- The p.r.o.s.e rows show neon1-corpus v0.36.0, which adds the short versions of the Terms and Security policy, typical first projects on Services, and the client's words in the accounting case study.

## v0.65.1

### Changed
- About's second paragraph links to the mission and promise page, which puts the whole promise on one page.
- The p.r.o.s.e rows show neon1-corpus v0.35.1.

### Removed
- Two stray screenshots at the root of the repository.

## v0.65.0

### Added
- The short version: posts and Knowledge Center documents that have one (neon1-corpus v0.35.0, `short`) show it in a box between their facts and their text, with the same outline as 1NEON's Next step. It's a section with its own heading, left out of On this page, and it also leads each RSS item, sits under the facts in the PDF, and becomes the page's `abstract` in its structured data.
- Blog posts list their author and minutes to read in the facts row, and their structured data gives the reading time (`timeRequired`). The author moved up from the line at the bottom.

### Changed
- The p.r.o.s.e row for neon1-corpus shows v0.35.0.

## v0.64.3

### Changed
- The Knowledge Center and blog now build their pages from one set of shared parts instead of two near copies: the page header band, cards, breadcrumbs, the facts list (Published and Updated), "On this page", Read next, the rights line, structured data, and the step that writes or checks each folder and its sitemap block. Their pages read the same as before.
- The browser icons in each page's head come from the home page, like the bar and footer.
- Knowledge Center documents' breadcrumbs for search engines start at neon1, like the blog's.
- make frame-check fails if the home page's phone menu lacks any link from its bar, or words it differently.

## v0.64.2

### Fixed
- The Knowledge Center and blog menus now match the home page's word for word, on desktop and phones: "p.r.o.s.e" instead of "tools I'm building", and "1NEON client portal" in the phone menu. Their bar and menu links are read from the home page when the pages are built, so the two can't drift apart again.

## v0.64.1

### Changed
- The home page's structured data names neon1.tech and neon1 LLC as other names for neon1, so a search for "neon1" can match the business and the site to the home page.
- Search results get their own icon: a 192px matrix green mark on the dark ground, listed first, since search engines show one icon to everyone and a light or dark theme can't switch it. Browser tabs still follow the light or dark setting.

## v0.64.0

### Added
- Every blog post ends with "Share this post": Copy link, the device's own share sheet where the browser has one, and links to share on LinkedIn, X, Facebook, Bluesky, Threads, Reddit, WhatsApp, or by email. They're plain links to each service's share page, so no outside script runs on neon1.tech and nothing tracks readers. The links work without JavaScript; js/blog-share.js only reveals the two buttons where the browser supports them.

## v0.63.0

### Changed
- Corpus releases publish on their own. Every build reads the newest neon1-corpus release instead of a tag pinned in the Makefile, and the deploy workflow checks every 15 minutes whether neon1.tech shows that release; when it doesn't, it runs the usual checks, browser tests, PDF printing, and release switch from main. Site versions and tags only move for site changes. /knowledge/corpus.json names the corpus release that's live, and make verify confirms it.
- The Knowledge Center and blog folders are built by make content and no longer committed, so the repository can't fall behind what's live.

### Added
- make static (part of make check) fails if a page script reads a corpus source, or if a built Knowledge Center or blog page lacks its own heading and text, so corpus words always reach readers as static HTML.

### Fixed
- On phones, scrolling down until "On this page" docks under the top bar and back up again quickly no longer leaves an empty gap above it that grew each time. A scroll back down while the bar is easing back now cancels the undock instead of docking a second time, and one spacer holds its place (Knowledge Center and blog).

## v0.62.2

### Changed
- The first blog post tells its opening story directly (neon1-corpus v0.34.2). p.r.o.s.e lists neon1-corpus v0.34.2.

## v0.62.1

### Changed
- The first blog post, from neon1-corpus v0.34.1, is rewritten in the blog's own voice: it opens with a short story, ties in this week's IRS IP PIN deadline, and links its facts inline. p.r.o.s.e lists neon1-corpus v0.34.1.

## v0.62.0

### Added
- The blog at neon1.tech/blog/: posts written in neon1-corpus, like the Knowledge Center, each on its own page with its published date, topic, and who it's for, plus an RSS feed at /blog/feed.xml (make blog, checked by make blog-check). Each post describes itself to search engines as a BlogPosting with its author and dates, and the index as a Blog. Posts are listed in the sitemap and in /llms.txt.
- First post: "Tax preparers are financial institutions, as far as the FTC is concerned," on what the FTC Safeguards Rule asks of a small tax or accounting office before tax season.
- The bar, the menu, and the footer link to the blog, and every page advertises the feed.

### Changed
- The Knowledge Center and the blog share one page shell (scripts/page-shell.mjs), so their bars and menus stay the same.
- Knowledge Center and blog from neon1-corpus v0.34.0; p.r.o.s.e lists neon1-corpus v0.34.0 and neon1-aws-infrastructure v0.5.0.

## v0.61.0

### Added
- The p.r.o.s.e training fold lists There Are No Incidents, incident response training for small businesses with a runbook, playbooks, and tabletop exercises, open on GitHub.
- Every Knowledge Center page describes itself to search engines and AI assistants with structured data: an article (or, for question pages, each question and its answer) with its author, published and updated dates, edition, and license, plus its breadcrumb. The index is a collection page. All of it joins the organization the home page already describes.
- /llms.txt: a plain map of the site for AI assistants, listing every Knowledge Center document with its summary, written from neon1-corpus with the pages.
- IndexNow: after each verified deploy, the home page and the pages that changed are sent to Bing and the other IndexNow engines (make indexnow), so they're re-read within hours. Bing's index also feeds Copilot and ChatGPT search.

### Changed
- robots.txt names the search engines, AI search assistants, and AI training crawlers, each with the same rules as everyone else, so the choice to welcome them is on record.
- Deploys keep the last 5 releases for rollback instead of 10, so older release folders are removed sooner.
- Knowledge Center from neon1-corpus v0.33.0, with a page for There Are No Incidents; p.r.o.s.e lists neon1-corpus v0.33.0.

## v0.60.1

### Fixed
- Knowledge Center from neon1-corpus v0.32.1: dead, moved, and retired source links now point to their current pages, and the measurement standard names DORA's five metrics.

### Changed
- p.r.o.s.e lists neon1-corpus v0.32.1, Ready, Secure, Go v0.1.1, You Have 20 Seconds To Comply v0.1.1, and SOC It 2 Me, Phish Out of Water, and Home Is Where the Smart Is v0.1.2, each with current source links.

## v0.60.0

### Added
- The p.r.o.s.e guides fold lists You Have 20 Seconds To Comply, compliance guides by domain from HIPAA and GxP to PCI DSS, privacy, and accessibility, open on GitHub.
- Knowledge Center: a page for You Have 20 Seconds To Comply (neon1-corpus v0.32.0).

### Changed
- p.r.o.s.e lists neon1-corpus at v0.32.0.

## v0.59.0

### Changed
- On phones, the menu follows the page's theme: over the light part of the home page and on light pages such as the Knowledge Center, it opens on the light surface with dark green links instead of going dark. Over the rain, it stays dark.
- The menu eases open (a fade, with the links lifting into place) and fades out when it closes. With reduced motion, it opens and closes at once.
- Moving to the next section of the home page takes about twice the push: roughly 110px of finger travel on a phone (was 55), and about five wheel notches or a longer trackpad swipe on a computer (was three). The page gives a little more as you push, so you can feel it building.
- p.r.o.s.e lists neon1-1NEON at v0.4.1 and neon1-aws-infrastructure at v0.4.1.

### Fixed
- After leaving the white rabbit's scene in DuckDuckGo on iPhone, the strip under the browser's bottom toolbar no longer keeps a light leftover of the scene: closing the scene asks the browser to repaint the whole window.

## v0.58.0

### Added
- p.r.o.s.e has a second half, "Purposeful, repeatable, open-source education", under the engineering one. Its guides fold holds Ready, Secure, Go and Home Is Where the Smart Is, a household tech handbook, and its training fold holds Phish Out of Water, a security awareness session kit, and SOC It 2 Me, SOC 2 readiness training. All four open on GitHub.
- Knowledge Center: neon1's mission, capabilities, care plan, services agreement, and proposal options, plus a page for each new education project (neon1-corpus v0.31.0).

### Changed
- Each p.r.o.s.e row's arrow sits at the row's end, so the whole row reads as the thing to tap. It still points left when closed and turns down when open.

## v0.57.1

### Fixed
- The phone menu's links sit centered between the logo row and the bottom of the screen. They sat a little low, because the first link has no tall letters and the last one has letters that drop below the line.

## v0.57.0

### Fixed
- A link's northeast arrow never wraps onto the next line by itself. The arrow is drawn on the link's last word, and that word and the arrow stay together while the rest of a long link wraps as text does. This holds on the home page, in the Knowledge Center, and in Neo's replies.

## v0.56.1

### Fixed
- Knowledge Center: architecture diagrams opened on their own now show their colours and labels in every browser, including DuckDuckGo and Safari on phones, and they're narrower and simpler to read on a small screen (neon1-corpus v0.28.1).

## v0.56.0

### Added
- Knowledge Center: State registration, neon1 LLC's public record with the New York Department of State, with how to search it and a facts-checked date (neon1-corpus v0.28.0).
- The footer's copyright line links to the state registration.

### Changed
- neon1 is the name used throughout, and the legal name appears only in the copyright line and legal text.

## v0.55.1

### Fixed
- Every outbound link's arrow is the same drawn arrow, sized to its text, in the site, the Knowledge Center, and Neo's window. It was a font character, so the footer's monospace links showed a smaller, different arrow.

## v0.55.0

### Added
- Knowledge Center: Preview PDF opens a document's PDF in a new tab, in the browser's own viewer, where it can be read, printed, or saved.

### Changed
- Figtree is the reading and interface typeface in place of Inter, on the site, the Knowledge Center, 1NEON, and the PDFs. JetBrains Mono stays for the wordmark, navigation, labels, and code.
- PDFs are set entirely in bundled Figtree and JetBrains Mono, including the running footer, so every printed copy looks the same.

## v0.54.1

### Changed
- The tab icon is the neon1 mark on a transparent background, in brand green when the browser is light and matrix green when it's dark (`favicon.svg`). `favicon-awake.svg` and `favicon-matrix.svg` are fixed versions for 1NEON, which follows its own theme. Browsers without SVG icons keep the dark square.

## v0.54.0

### Changed
- Opening a fold on the home page (p.r.o.s.e, services, and the rest) eases it open, and the section glides up until its heading sits at the top of the screen, so a long fold reads straight down. Scrolling inside an open fold reads it; the next section waits until the fold is closed or read to its end.
- On a desktop, the mouse wheel or trackpad needs a deliberate push to change sections, so a small scroll no longer jumps a whole screen.
- The p.r.o.s.e list shows 1NEON v0.3.0.

## v0.53.0

### Added
- Knowledge Center: "On this page" marks the section you're reading as you scroll. On phones and narrower screens, the folded index docks under the top bar once you scroll past it, easing out to the full width and naming the current section, and eases back into place when you scroll above it.

### Changed
- Knowledge Center documents describe neon1's practice and scope plainly, without underselling it (neon1-corpus v0.27.1).

## v0.52.0

### Added
- Knowledge Center: Where I learn from, the standards bodies and guides behind neon1's practice, and Sources on every standard (neon1-corpus v0.27.0).
- Long documents have an "On this page" index: a column beside the text on wide screens, and a fold under the document's actions on narrower ones.

### Changed
- PDFs follow neon1's letters and proposals: the mark and title as a letterhead, green section bars, green arrows for points, a facts table, and a footer with the slogan and page number. A section that fits on one page moves to the next page instead of splitting, when that wastes little space.
- Tables use the full width on larger screens, long outside links wrap on phones, and document cards on phones are tighter.

## v0.51.0

### Added
- Knowledge Center: How neon1.tech works, a plain walk through every part of the site, 1NEON, Neo, and how a change goes live (neon1-corpus v0.26.0).

### Changed
- Every Knowledge Center document and PDF shows when it was published, and when it was last updated if that's later.
- The p.r.o.s.e rows show the current releases of neon1-corpus, neon1-aws-infrastructure, and neon1-1NEON.

## v0.50.2

### Fixed
- Neo's button and the rain controls share one line at the bottom of the screen, 16px from the edges or clear of the iPhone's home indicator and notch, so neither covers the 1NEON sign-in box in Safari, DuckDuckGo, or Chrome on iPhone.
- On the narrowest phones, the rain controls tighten so they stay clear of "ask Neo" while it shows its label.
- On light pages, Neo's button has a soft shadow, so it reads as floating over the text instead of hiding it.

## v0.50.1

### Changed
- The footer's contact LinkedIn link goes to neon1's company page, which anyone can read without signing in. Pradeep's own profile moves to "elsewhere", and About still links it.

## v0.50.0

### Added
- How neon1 is built, in the Knowledge Center: an AWS-style architecture diagram, sequence diagrams for a visit, a Neo question, and a 1NEON sign-in, the deploy pipeline, the corpus's flow, and a project's four layers (neon1-corpus v0.25.0). Each diagram has alt text, opens full size, and shows its Mermaid source.

### Changed
- Deploys switch the whole site at once. Each release goes up complete under its own folder, then neon1.tech moves every visitor to it in one step, so a page opened mid-deploy can no longer mix a new page with old scripts and come up blank. No CDN invalidation is needed, the last 10 releases are kept, and `make rollback` switches back in seconds.

## v0.49.5

### Changed
- The Knowledge Center's About page uses the same 15-years sentence as the home page (neon1-corpus v0.24.6).

## v0.49.4

### Changed
- About says more about where the work comes from: about 15 years of curiosity and passion for technology and automation.

## v0.49.3

### Changed
- In neon1 p.r.o.s.e, the business list starts with neon1-corpus, then neon1-aws-infrastructure.

## v0.49.2

### Changed
- DeployOps and Ready, Secure, Go are public: their rows link to GitHub with their versions (v0.14.0 and v0.1.0), AWS CLIP shows v0.1.0, and 1NEON shows v0.2.2. The Knowledge Center uses neon1-corpus v0.24.5.
- Moving between sections takes a firmer push (about a third more), on desktop and phones.

### Fixed
- Opening or closing a fold in a section, such as business and tools in neon1 p.r.o.s.e, no longer jumps the page; folds open downward in place.
- A link to a section opened in a new visit lands on the section's top, like the menu, instead of 136px down (72px with reduced motion, as before, now from one offset instead of two).
- Tab and Shift+Tab show each section as focus enters it and ease the page to the focused control, instead of focusing controls that were still invisible.

## v0.49.1

### Changed
- The Knowledge Center and the site's questions use neon1-corpus v0.24.4: the privacy policy says plainly that Amazon Bedrock doesn't keep Neo's questions or use them to train models, and the 1NEON help says the guided walkthrough takes about two minutes.

## v0.49.0

### Changed
- On-site work is within about 30 miles of Queens, NY, on the home page and in the Knowledge Center (neon1-corpus v0.24.3).
- The Knowledge Center's search jumps in with Ctrl+K (Cmd+K on a Mac) instead of a bare "/", which caught speech input and other single keys.
- Checkboxes on forms, templates, and examples are printed marks: they show their state but no longer take focus or clicks, since the page saves nothing.
- On a phone-width screen, Neo's window keeps Tab and Shift+Tab inside it, since it covers the page there.

### Fixed
- The menu scrolls at every screen height (1024 by 600, zoomed text), so every link and the close button are reachable.
- Choosing a section in the menu puts keyboard focus on that section, so the next Tab continues there. Widening the window with the menu open moves focus to the same link in the bar, not to nothing.
- Focus rings use the color that reads on each surface: brand green on the light bar and the case study window, neon on the dark menu.
- The contact link in "Where neon1 started" opened a missing file. It now closes the case study and goes to the contact section, with focus there.
- Scrolling inside the contact message box scrolls the box, not the page, until it reaches its end.
- Each field the contact form flags carries its own message, so a screen reader hears it on every visit.
- A late answer from Neo no longer pulls focus back from wherever you went meanwhile, and the Enter that confirms an input method's candidate no longer sends the question.
- Search lists every document it counts, clearing the box by any means clears the address too, and a search index that failed to load tries again on the next keystroke.

## v0.48.1

### Changed
- "neon1 p r o s e" is now written "neon1 p.r.o.s.e", in the heading and the menu, and its line reads "Purposeful, repeatable, open-source engineering."

## v0.48.0

### Changed
- The white rabbit's walk takes about half the scrolling: about ten quick swipes on a phone, either way. The scroll is spent in proportion to how much the view changes, so the turn to the window, getting up, and the walk over take more of it and the calm glide back from the TV less, and every swipe moves the view about the same amount. The pauses at the window and on the yard still take a real stretch of scrolling.
- Each kind of input has its own measure: a finger, a touchpad or smooth wheel, and a notched mouse wheel (a fixed step per click). The view never turns faster than a set top speed, however hard the flick.

### Fixed
- "follow the white rabbit" no longer shows behind a phone's bottom bar after leaving the rabbit, or over the sections below. It is hidden unless it has keyboard focus.

## v0.47.2

### Changed
- Versioning and releases (edition 1.2) in the Knowledge Center says how a project that shipped before it was tagged marks its earlier milestones, from neon1-corpus v0.24.2.
- neon1 prose shows 1NEON at v0.1.1 and the corpus at v0.24.2.

## v0.47.1

### Changed
- Versioning and releases (edition 1.1) in the Knowledge Center says how each neon1 repository releases, from neon1-corpus v0.24.1.
- neon1 prose shows each repository's current release: 1NEON, the chat, and the AWS infrastructure are now tagged at v0.1.0, and the corpus at v0.24.1.

## v0.47.0

### Changed
- "tools I'm building" is now "neon1 prose": predictable (or purposeful; I decide), repeatable, open-source engineering. It holds two folds, business (the neon1 repositories) and tools (AWS CLIP, DeployOps, and Ready, Secure, Go). Each row has a short description, whether it's public or private, and its release. Public rows open on GitHub in a new tab.
- "send me your use case" has no underline or gray tap flash on phones, and its arrow sits right beside the words.
- A rule now sits above the contact view's "where" row.

## v0.46.0

### Changed
- The first screen is back to the wordmark and tagline alone.
- The bar's "book a call" button is now "contact", which goes to the contact view, where booking, email, phone, and the form are.
- The contact form folds under "send me your use case" below the fit list. It asks less: pick any of the four services (or none), add your own words, say what's going on, then name and email. The starter suggestions and their repeated case links are gone.
- The form's note ends with Morpheus's line: "Remember, all I'm offering is the truth. Nothing more."

## v0.45.1

### Changed
- 1NEON help and the terms use the same wording as the portal for signing in, the demos, and option scores, from neon1-corpus v0.23.1.

## v0.45.0

### Added
- The first screen says what I do and who it's for, with one button to talk through a project and a note that the first 15 minutes are free.
- Knowledge Center search reads every document, not just card keywords. It understands common variants such as MFA, 2FA, and two-factor, or Wi-Fi and WiFi, shows a snippet, and links to the matching section. Nothing you type leaves your browser.
- A "Start here" block above the library, with a few documents for each common reason to visit.
- Square icons for browser tabs, bookmarks, and search results, and a square logo for search engines.

### Changed
- The sections are now called client work and tools I'm building. Each tool says whether it's available now or still in development, who it helps, its limits, and what to do next.
- AWS CLIP is described by what it actually does: account guards and approval checks around the AWS CLI. Its previews leave out argument values, and AWS output is shown unchanged.
- The privacy policy, terms, cookie notice, 1NEON help, password manager guide, and several standards are corrected, from neon1-corpus v0.23.0.
- Templates and forms may now be filled in, adapted, and shared as completed copies.
- Printed templates keep each label with its blank and keep the acceptance section together.
- Links to other neon1.tech pages open in the same tab. Each knowledge page has one main heading.

### Fixed
- The contact form stops waiting after 15 seconds, keeps what you wrote, and tells you plainly if it couldn't confirm the send.

## v0.44.0

### Changed
- The white rabbit keeps its mystery: no help line and no buttons on screen (no "back to the page", no "start the car"). Esc still leaves, scrolling back up still returns to the page, the car still starts when clicked, and screen readers still hear how to move.
- The walk out of the TV only ever moves back; the small dip forward at the start is gone.
- A moment on the window after the turn, so the rise has settled before getting up.
- No more looking right and left out of the window. After the sash goes up there is a pause, then a slow move straight out through the opening, the same way the window looks, to the square view of the yard, held before the white.
- The camera's position, direction, and zoom are eased with monotone curves through every beat, so nothing swings past a beat and back, and speed never stops and starts at a beat.

## v0.43.3

### Changed
- About ends after its two paragraphs; the link to where the name comes from is gone.
- More questions uses the site's usual bold link style.

## v0.43.2

### Changed
- The top bar is back to its earlier layout: the section links, knowledge, book a call, and 1NEON on wide screens, and the full-screen menu below 1040 pixels. The menu now also lists book a call.

## v0.43.1

### Fixed
- The names page now says who the 1 is: Pradeep, neon1's sole owner. From neon1-corpus v0.22.3.

## v0.43.0

### Changed
- Plainer writing throughout, following the new Voice section of neon1's writing standard: say it, back it with evidence, and don't pitch. The services, the process, the projects, and the knowledge center's services, about, FAQ, case studies, and guides lose their soft sell. From neon1-corpus v0.22.1.
- The FAQ answers on cost and on data link to the matching moments in 1NEON's live playback.

### Removed
- The placeholder page at /faqs. neon1.tech/faqs now redirects to the full questions in the knowledge center.

## v0.42.0

### Added
- A contact form. Pick what it's about, start from a common situation if one fits, and send. Messages go straight to neon1's inbox. Each common situation links to the closest case study.
- A More questions link under the home questions, and neon1.tech/faqs, which opens the full list in the knowledge center.

### Changed
- The top bar is quieter. It keeps book a call, 1NEON (now its rings and name with no box), and the menu. Every section is in the menu, at every width.
- The about section is two short paragraphs. Where the name comes from moved to the knowledge center, linked from about.
- Section snapping pushes back less. It still settles on one section per screen.
- The rain's grid and character switches are back beside pause.

### Removed
- The services helper and the optional pre-call brief. The contact form covers both.

### Fixed
- Scrolling without pause no longer stalls at the edge of a section. Before, the page waited for the scroll to stop before moving on.

## v0.41.0

- Fewer controls to work out. The rain on the home page keeps only its pause button, and the grid and character switches are gone.
- Knowledge center documents show one button, Download PDF. The link to each document's source on GitHub moves to the note at the end of the page.

## v0.40.0

- A calmer knowledge center. The Start here row, which repeated six documents shown again below, is gone. Those documents now lead their own shelves instead.
- Cards drop the label that repeated their shelf's name and show only whether there's a PDF.
- The six developer standards (Development, Version control, Versioning, Code style, Testing and review, and Documentation) sit in a For developers fold at the end of How I work. A search still finds them and opens the fold. From neon1-corpus v0.21.0.

## v0.39.1

- A calmer home page. The services note and the contact intro are shorter, and the contact list no longer repeats what the process already says about proposals.
- The home questions skip where, when, and how long, since the contact list right below answers them. Neo and the knowledge center keep the full set.
- DeployOps no longer shows a version number its tags don't match yet, and the footer note is lowercase like its neighbors.

## v0.39.0

- A shorter knowledge center. Writing and client trust were folded together, Where else to get help is now one table, and the longest standards are trimmed. From neon1-corpus v0.20.0.
- Every earlier release in this changelog now has its tag.

## v0.38.0

- The How I work shelf now leads with the two main standards, Writing and Development, followed by new standards for version control, versioning and releases, code style, testing and review, and documentation. From neon1-corpus v0.19.0.
- Each release of the site is now tagged automatically once it's live, so every version in this changelog from here on has a matching tag.

## v0.37.0

- New policy in the knowledge center: How I use AI. It covers where AI tools help in neon1's own work (research, understanding needs, and reviewing writing and code), what stays my responsibility, and how client information is kept out of them. From neon1-corpus v0.18.0.

## v0.36.3

- Every knowledge center document is now at edition 1.0. From neon1-corpus v0.17.0.

## v0.36.2

- The knowledge center's heading is now "Everything neon1", with a plainer introduction.
- Documents written for the knowledge center show edition 0.9 until their final review. From neon1-corpus v0.16.0, which also tightens the wording across the new documents and limits the accessibility statement to what has been checked.

## v0.36.1

- Every knowledge center document now shows its edition, written as X.Y (all at 1.0 to start), on its page and in its PDF footer. From neon1-corpus v0.15.0.

## v0.36.0

- The knowledge center now opens with a Start here row of the most useful documents, then two halves: For you (guides, alternatives, templates, forms, and filled-out examples, useful whether or not you hire neon1) and About neon1 (company, services, how I work, questions, case studies, products, and policies). The shelf bar is grouped the same way, and search hides empty halves.
- From neon1-corpus v0.14.0.

## v0.35.0

- The Alternatives shelf adds an open-source shortlist: the projects I'd look at first for automation, business apps, documents, reporting, monitoring, backup, security checks, infrastructure, AI, and planning, with what each is for and what to check first.
- Where else to get help now quotes only terms read on each provider's own page. From neon1-corpus v0.13.0.

## v0.34.2

- Three use cases join the Guides shelf: one workflow without retyping, a cloud account you can trust, and security awareness for a team or family. Each is labeled as a typical pattern, not a client story. From neon1-corpus v0.12.2.

## v0.34.1

- A glossary joins the Company shelf in the knowledge center: neon1's own names, plus the reliability, security, cloud, and AI terms the documents use. From neon1-corpus v0.12.1.

## v0.34.0

- The knowledge center grows to 60 documents: five more How I work standards (development, design and accessibility, customers, partners, outreach and selling), an accessibility statement, a security disclosure policy, and a new Guides shelf (getting ready for a first call, a family password manager, backups you can trust, before you buy a new tool, and whether you need a business associate agreement).
- Search also matches each document's section headings, so "restore" or "two-step" finds the right guide.
- From neon1-corpus v0.12.0.

## v0.33.0

- New: the knowledge center at [neon1.tech/knowledge](https://neon1.tech/knowledge/). Every public neon1 document in one place, on shelves: the charter, how I work, services, questions, case studies, products, alternatives, templates, forms, filled-out examples, and policies. Search filters them as you type, and `/` jumps to the box.
- Each document has its own page with its edition, when it was first written and last updated, and a branded PDF to download. Forms and templates print with lines to write on and boxes to tick.
- The pages are written from neon1-corpus v0.11.0, the same source Neo and the home page read, and `make check` fails if they drift from it. PDFs are printed in the deploy job, never committed.
- The bar, the menu, and the footer link to the knowledge center.

## v0.32.6

- Tapping into Neo's chat box on a phone no longer zooms the page in. The keyboard still comes up and the box moves into view. Pinch to zoom still works.

## v0.32.5

- When Neo asks someone to slow down, the chat window now waits with them: the send button rests for as long as Neo said, and a question typed meanwhile stays in the box instead of being sent and refused.

## v0.32.4

- The case studies and the questions now come from neon1-corpus, the one place neon1's public words are written, so the site, Neo and the knowledge area all say the same thing. The page reads exactly as before.

## v0.32.3

- neon1's security readiness guide is now called Ready, Secure, Go. The security case study and the projects list use the new name.

## v0.32.2

- The start of the scroll no longer feels stuck. The view now starts moving back from the screen within the first few scrolls, instead of holding on the screen for over a screen's height of scrolling.
- Scrolling while the scene is still loading no longer piles up, so the start can't rush past once it's ready.

## v0.32.1

- A simpler walk. Out of the TV, the view goes straight out and back from the set, drifting a little right and looking at it, until both chairs and the set are in view.
- Then, still on the floor, it turns left to the window in one smooth motion. The gaze rises slowly: a third of the way by the halfway point, the rest after, ending on the window in the sun and the dust.
- Getting up stays as it was. Then a slow walk to the window with a quick glance at the car, squaring up to it, and the sash going up.
- Then the head goes out through the opening: a look straight out, then right and down at the concrete and the greenhouse, then left and a little up to the middle of the lawn, held there before the white and "go touch grass".

## v0.32.0

- Out the window, the yard is in full sun: shade and fallen leaves lie only under and downwind of the street and park trees, so the lawn, the concrete, and the mulch are brighter, and the lawn no longer has leaves across it.
- Coming back to the tab mid-scene keeps the white rabbit's full picture. The time away no longer counts as a slow frame that lowers its sharpness and turns off its glow.
- Fonts, images, models, and the recording keep the same bytes at each address for good, and the deploy keeps the older ones, so a page left open from an earlier release still finds its files.
- The checks catch release numbers that disagree, a changed file at an old address, a shipped asset without its source and license, and baked lighting that no longer matches the room. A measured budget holds the 3D scene's draw calls, triangles, and resources.

## v0.31.0

- The optional pre-call brief can't be sent anywhere: pressing Enter does nothing, even if its script never runs. Its answers stay in the page until you copy or save them.
- An open case study holds focus: Tab and Shift+Tab stay inside it, Esc closes it, focus goes back to the card you opened, and the menu and chat wait until it's closed.
- Each outcome in the chooser lands on its own case study card, and Back and Forward move between them.
- The white rabbit can be followed from the keyboard, with a short help line, a "back to the page" button, and the car's switch while it's in view. Turning on reduced motion mid-scene switches to the still card, and leaving always frees the scene.
- The chat window sends one question at a time and keeps its history within what the assistant accepts, closes cleanly every time, and reminds you not to share private details.
- The footer and both pages show the same version.

## v0.30.3

- The spiky shrub moves to the stone bed's deck end, with the flowers starting just past it. It is fuller, and its outer leaves arch over and down to the plant's foot.

## v0.30.2

- The deck runs left to the left border's soil, in place of the edging that sat between the lawn and the mulch beside it. Its front stairs are centered on the lawn.
- The peach tree stands in the left border, just past the deck's front-left corner.
- The stone bed is planted thick, as in the photos: a crowd of marigolds and cosmos at the deck end, then two staggered rows of daylily leaves, mint, bushy plants, flowers, and a rose on up its length.
- At the bed's far end stands a full, spiky shrub of long, stiff, pointed leaves, like a longer-leafed agave, in one green a little darker than the lawn.

## v0.30.1

- Out of the TV, the view goes straight back as it first did: low on the floor at the screen's height, looking level at the set the whole way, with no rising and no tilting down. It stays low through the turn to the window, then gets up.
- The yard is back to the layout fitted to the photos after the question-mark fix: the C bed starts just past the deck's front, right of its stairs, with the lawn, concrete, greenhouse, and pear where they were. The deck keeps its true 3.56 m depth (7 spindles, the stairs, then 7 more), and the yard behind it moves in with it.
- The deck is 6.6 m wide and centered on the window, as in the photo. From the opening you see its left rail, with mulch and the peach tree beyond it, and its right side and stairs, with the concrete beyond those.
- Head on at the window, the view is wider, like the phone photo of it. It shows the whole window and looks down through the opening to the lawn, the bed, and the back fence.
- The leans to each side also see a little wider, with both sides of the frame in view.

## v0.30.0

- The sample project lives in 1NEON now, at /1NEON/example, in the portal's own frame. The old tour page sends visitors there.
- The home page also links to the 1NEON demo, a working copy of the portal with made-up clients that runs in the browser.

## v0.29.1

- Back from 1NEON to neon1.tech shows the page again. The fade on the way out had stayed on when the browser restored the page.
- Opening Neo no longer puts the cursor in the question box, so phones keep the keyboard down until you tap in.

## v0.29.0

- The yard is rescaled to the photo from the window. Measured from that photo, the back fence is about 14 m from the house, not 28 m, so everything past the deck pulls 14 m closer: the lawn, the concrete, and the stone bed are all about half as long as before.
- The deck is centered on the window, as in the photo. The last view, out through the opening, now shows its floor, its front rail, and the front stairs, with the lawn, the bed, the garden, the trees, and the water beyond.
- The stone bed is the same backward C, fitted between just past the deck's front stairs and the greenhouse.
- The peach tree stands just past the deck's front-left corner. The swing and the squash patch sit between the deck and the greenhouse.
- The leans to each side stand a step back from the window, so both sides of the frame stay in view while they look out to the far trees and the water.
- The yard is drawn from its own plan, shifted as one piece, so its shapes keep their proportions.

## v0.28.2

- The stone bed is one backward C again, with no straight run that made it read as a question mark. It keeps the C's first shape, starting 1.5 m past the deck's front and ending where it always has.
- The deck was still there but hidden: at its true 3.56 m it sits right under the window, below the sill. Now the last view, out through the opening, looks down over the deck's railing and front stairs to the yard, the trees, and the water, like the photo from this window. It opens to a wider view there so everything fits.
- The leans to each side sit farther back and higher, so the frame stays in view while they look out to the far trees and the water.

## v0.28.1

- The lawn is a deeper, living green instead of a dry, sun-bleached one, and the worn path across it is gone.
- At the window, the leans to each side sit lower and look farther out and up, over the deck and the near concrete, to the far trees and the water, with both sides of the window frame still in view.
- The deck is sized by its railing: from the far corner, 7 spindles, the right stairs, then 7 spindles back to the house, at 16 cm spacing. That puts it 3.56 m out from the house.
- The stone bed runs straight from the deck's front before turning into its backward C, and the border by the deck has a few more shrubs.

## v0.28.0

- The sample tour now uses the home page's light bar: the logo, book a call, and 1NEON sit in the same places, and the note that everything is made up sits where the section links are. On phones the note shows as a thin line under the bar, next to the same menu.
- The tour has the home page's footer, and its layer names follow the site's pattern: the N, E, O, or N in brand green and the rest of the word in ink, with no underline.
- The tour's step links and end buttons react on hover like the home page's: book a free call lifts with a shadow, the others fill with light green, and "start the tour again" is now a small up arrow like the case-study arrows.
- One frame for every page: the bar, menu, buttons, light surface, and footer styles live in css/frame.css, and the menu, footer year, and 1NEON fade in js/frame.js. The bar and footer markup is written once in index.html; `make frame` copies it to other pages and `make check` fails if a page drifts.

## v0.27.1

- The stone bed is back to its earlier backward-C shape, starting 1.5 m right of the deck's front stairs, so the concrete on the right is its earlier size again.
- The deck is back to its earlier size (9.35 m out from the house, 12.8 m across), keeping the new railing, posts, spindles, and boards. It is a darker, cooler brownish burgundy, with 1 cm gaps so each board reads.
- At the window, the leans to each side come low and close to the opening, under the raised sash, so they look through the window and down into the yard instead of at the sill.
- The peach tree stands in the left border just past the deck's front-left corner.
- The big andromeda in the back-left corner no longer pokes through the stockade.

## v0.27.0

- Services has a short chooser: pick where it hurts and what's going on, and it points to the right service, a similar case study, and a free call. It's plain radio buttons, so it works without scripts, and nothing is saved.
- Contact shows the fit at a glance: remote from anywhere or on site within about 30 miles, the hours, project sizes, what the first call covers, and what comes after. The FAQ now says on-site work is within about 30 miles.
- An optional brief under the booking button: three questions, a live preview, and copy or save as text. Nothing typed into it is sent or stored.
- A new sample tour at /tour.html walks a made-up bakery project through Needs, Execute, Observe, and Normalize in 1NEON, without signing in or touching any real data. Process links to it.

## v0.26.0

- The assistant is now Neo. Its launcher is a round neon1 mark that stretches to "ask Neo", and the window grows up out of it and folds back into it.
- Neo follows the page: dark over the rain, and light like the header's "book a call" once the page wakes, even while it's open.
- Replies show typing dots, slide up into place, and use real paragraphs, bullet lists, and site-style links with the northeast arrow.
- The footer offers book, email, or call, and the greeting says Neo is automated, in place of the old disclaimer.

## v0.25.1

- The case study Previous and Next buttons work with reduced motion turned on, or when the animation library doesn't load, and jump instead of gliding when motion is reduced.
- The "ask neon1" window scrolls its own conversation with the wheel, trackpad, or touch, without moving the page. On short or zoomed screens the whole window scrolls, so the question box, send, close, and the note under it are always reachable. It steps aside while the menu, a case study, or the white rabbit is open.
- The chat loads after the rest of the page, so if it ever fails to load, the menu, rain controls, and contact links still work.
- The full-screen menu scrolls on short or zoomed screens, so every link stays reachable.
- Turning on reduced motion mid-visit stops the rain.
- The near row of trees in the simple white rabbit view shows again; it had pointed at an image that was never shipped.
- The social preview's description matches the card.
- Deploy checks fail when a page download is cut off or incomplete, and an unchanged security.txt no longer counts as a change.

## v0.25.0

- The deck matches the photo from the window: 6 m out from the house and 9 m across, in a deeper brownish burgundy, with 5/4 x 6 boards running left to right in staggered lengths with thin gaps.
- The deck railing has a wide, flat 2x6 cap, bigger square posts that rise above the cap at the corners and stairs, flush posts of the same size between them, and turned spindles 14 cm apart everywhere. The left side is railed back to the house, the front stairs sit left of center, and the right stairs start 7 spindles in from the front corner.
- The stone bed now starts at the deck's front, just right of the front stairs.
- The left border near the deck has low rounded shrubs, leafy clumps, and a small andromeda along the stockade.
- The grey edging stones run straight and true along their edges, with only the odd one a little off.
- Small plants and small bushes move a little less in the wind.
- At the window, the leans to each side look further down, over the deck and into the yard.

## v0.24.0

- The white rabbit's ending: squared up at the window with the sash all the way up, the view leans left toward the car to look right and down over the concrete and greenhouse, then right to look left and down over the lawn and the stockade, then glides straight in until the frame is gone and only the yard is ahead. It holds there for a pause of scrolling before the white. The trip down to the grass is gone.
- The stone bed is tan split-face retaining block in three courses, as in the photos.
- The lawn has real grass blades, olive green and darker at the roots like the photos, and their tips nod in the wind.
- Trees sway a little more, and lean harder in gusts. Leafy bushes rustle in small clumps instead of swaying.
- The ticking sound that followed the wind is gone.

## v0.23.1

- The "ask neon1" window offers four starting questions, a "new" button to start over, and a line under the question box to book a free call or send an email, so a person is always one click away.

## v0.23.0

- An "ask neon1" button, bottom left, opens a small window that answers questions from this page and neon1's public project pages, and points everything else to a call or hello@neon1.tech. It runs on neon1-chat, at /chat/api on this domain, so the page's strict content security policy is unchanged. Nothing typed into it is stored.

## v0.22.0

- The white rabbit's walk scrolls in a third of the time, 16 screen heights in all.
- Backing away from the TV is one steady glide across the floor, sitting the whole way, with no dips or pauses.
- Trees and plants move in the wind as whole pieces: the trunk holds, the crown rocks and leans in gusts, and the outer limbs bob, instead of the picture rippling like heat haze. The Japanese andromeda no longer glitches at the top.
- The pear and the big trees stand upright.
- The fences match the real yard: white vinyl privacy panels across the back and down the right side, and a weathered cedar stockade down the left.
- Grey scalloped edging stones line the soil side of the lawn's left and back edges and the trellis square's edge toward the lawn.
- Soil, mulch, and concrete edges wander a little instead of running ruler straight, and the back border is red mulch like the left.
- The lawn is a fuller, greener, more textured turf, and the concrete is a lighter grey.
- The stone bed is planted as in the photos: daylily leaves at the house end, cosmos and marigolds crowding the middle, and the bushy plant and a rose out by the trellis.

## v0.21.1

- The stone bed's stones are all grey, each somewhere between a medium dark grey and a darker one, with no light grey or burgundy.

## v0.21.0

- The white rabbit's walk scrolls about 2.6 times longer, 48 screen heights in all.
- Sitting up from the screen stays close to the set, then four even scoots back.
- Outside, the view now looks straight out, pans right to the sidewalk and cross street, then left to the neighbor's, and drops over the deck rail to the lawn, low in the grass with the garden ahead, before the white.
- The swing cushion is one piece for the seat and one for the back, each stitched into three places with a fabric button tufted into the middle of each. The fabric is sun-faded, most of all on the seat.
- The concrete is a slab about an inch above the soil around it.
- More trees line the cross street and the far side of the back street, and about a third of all trees wear mixed autumn leaves in slightly different hues.
- Dandelions and fallen leaves on the lawn are round and leaf-shaped instead of square.

## v0.20.6

- The swing frame's diagonal braces join the legs at the bottom and the top bar at the top, two at each end, instead of floating free.

## v0.20.5

- The soil, in the borders and the stone bed, is a darker, richer brown.
- The left border is covered in red bark mulch, thinning to bare soil in patches and around the base of each plant and the dog house.

## v0.20.4

- Leaves move the most: a fine, quick tremble on top of the crown's slow breathing, and a faint flicker as they turn in the light, stronger in gusts.

## v0.20.3

- Trees no longer sway as a whole: trunks stay still, and the crowns move in patches, each its own way, more at the thin outer and upper twigs. Wind stirs them harder instead of pushing everything one way. Bushes and border plants move the same way.

## v0.20.2

- The pear tree stands centered in its mint circle, with about twice the branches. They jut and turn at angles instead of simply tapering, under a fuller canopy.
- The steady breeze and creek hiss is gone, so no white noise comes in as the view turns to the window. Only the leaves rustling in gusts and the birds remain outside.

## v0.20.1

- The stone bed's stones vary in length only within 80 to 120 percent of a common size. Their colors vary across the bed in dark burgundy, light grey, and dark grey, with dark green moss grown into many of the joints.

## v0.20.0

- The porch swing is built in 3D instead of drawn on cards, so from any angle its top bar runs parallel to the right fence and its seat faces left. It keeps the black frame with dark rust at the feet and the puffy three-seat leaf-print cushion, and it swings about the bar.

## v0.19.9

- The greenhouse's gable frame bars follow the roof line instead of jutting out in a V above each end.

## v0.19.8

- The porch swing's cushion is thick and puffy, stitched into three seats and three backs, in a cream fabric printed with green and light orange leaves on curling stems.

## v0.19.7

- The porch swing's frame is black, with only a little rust in a much darker orange-brown.

## v0.19.6

- The porch swing is rendered turned around, so the frame and the seat agree and the riders face left, instead of a mirrored image.

## v0.19.5

- The white rabbit loads its art by release version, so browsers holding year-long cached copies pick up the current yard instead of an old one.

## v0.19.4

- The pear tree's mint circle is 15% smaller and sits about 2 feet farther back and 1 foot to the left.

## v0.19.3

- The concrete has more cracks, hairline and branching, plus shallow dents and pitted spots.
- The porch swing faces left and stands on the concrete in line with the greenhouse and trellis, past the soil square.
- The mint is a dark, dense crowd, with the outer clumps pushed low and sprawling.
- The asian pear tree is taller and wilder, with uneven branching and clustered leaves.
- The stone bed is built from long, jagged, staggered stones in grey and reddish tones on all four sides, filled with dirt.
- The dog house is half again as wide, with a doorway hung with three plastic flaps, and it faces the yard.
- The left border runs dog house, huge Japanese andromeda, branchy bush, and tall pink rose.

## v0.19.2

- The chairs' arm upholstery no longer pokes through their wooden side boards.

## v0.19.1

- Out of the TV, you first sit back up straight from being hunched at the screen, then scoot back three times, each a small push with a slight dip and a pause after it.
- The whole walk takes half again as much scrolling, so every step and pause lasts longer.

## v0.19.0

- The stone bed is 2.3 times as wide and sits further right, leaving more lawn on the left and a walkable gap beside the pear tree.
- The concrete is one old rough pour, medium dark grey, cracked in places and patched with lighter quick-set cement that has cracked too.
- The pear tree stands straight with a rounded, see-through crown of round leaves and dark red pears, in a smaller circle overrun with mint.
- The greenhouse is bigger, with black door handles, a wooden workbench and swivel chair at the back, a folding table on the left, and a twin bed on the right; the Japanese andromeda stands behind it.
- A square of soil before the greenhouse holds an arched squash trellis, covered in leaves, yellow flowers, and hanging squash.
- The back garden sits down in its soil.

## v0.18.2

- No two plants in the beds and borders stand the same: each is mirrored or not, leans its own way, and grows a little wider or narrower.

## v0.18.1

- A soil border runs down the left fence too: an old worn dog house in the back corner, then a big Japanese andromeda, a smaller bush on long bare branches, and a tall pink rose nearer the house.
- The concrete is a shade darker.

## v0.18.0

- The yard runs back further, and its right side is concrete, parted from the lawn by a curving raised bed of mortared stone planted with a bushy plant, flowers, roses, and daylilies.
- Soil borders run along the right and back fences, where the sunflowers, squash, and cherry tomatoes grow, with a pink crepe myrtle in the back corner.
- An 8 by 12 foot greenhouse stands in the back-right corner of the concrete, its door facing the house, and a tall pear tree rises from a circle of mint cut from the concrete.
- The porch swing sits along the right fence, facing left and swinging side to side.
- The fence is in better repair, with taller 4x4 posts under pyramid caps at the corners and along each run.
- The deck's front stairs are further left, and the street trees stand outside the yard.

## v0.17.2

- The walk starts hunched at the TV's height and scoots back three times, the view dipping as each push begins and leveling as it carries back, sitting up straighter each time.
- The room is wider, so the window is farther off from where you sit.
- The dust stirs more gently in the gusts and more quickly when you move through it.
- Outside the window, the view holds on the yard for a long look before the white.

## v0.17.1

- The window looks down from a true second story.
- The deck is on the left now, built heavy and painted deep mahogany: 2x4 floor boards running left to right on a deep rim and 6x6 posts, a railing with a flat 2x4 cap and turned spindles between capped 4x4 posts, a wide flight of stairs down toward the garden, and a second flight off the right side.

## v0.17.0

- The swing set is now a three-seat porch swing on a matte black A-frame, with silver bolts, a little rust, and a one-piece seat-and-back cushion, swaying on its springs.
- The sunflowers are spread out, and their stalks arc and droop, some hanging their heads.
- The walk: scooting back from the TV in three shoves until both chairs are in view, turning slowly to the window through a moment of sun in the eyes, a pause, getting up with a dip and tilt, walking over with each step's bob and a glance at the car, squaring up to a window already a little open, a step closer as it opens the rest of the way, and out. The pauses are longer.

## v0.16.2

- The lawn is built from a photographed grass texture, with thicker and thinner clumps, gentle rolls in the ground that catch the sun, softer mowing stripes, and darker grass in the shade of the fence and beds.
- The garden sits level along the back fence from every angle.

## v0.16.1

- The sunflowers grow in their own raised bed beside the squash and tomatoes.

## v0.16.0

- The yard has edges: a taller white fence around the back and both sides, a neighbor's two-story house past the left fence, and a cross street past the right.
- A weathered wooden deck sits below the window with railings, a gate left ajar at the top of the steps into the yard, and a second flight down at its end.
- The garden runs along the back fence: wilting sunflowers, a raised bed with two lattice trellises where squash vines climb, flower, hang long squash, and run on along the fence, and cherry tomatoes in wire cages.
- The garden sways with the wind, and the swing drifts on its chains.

## v0.15.4

- The yard looks lived in: an old rusted swing set and a late-season sunflower bed, leaning and nodding among weeds, rendered from real models; a fence that sags, leans, weathers, and misses a picket here and there; and a lawn with drier and lusher patches, clover, a worn path, bare earth under the swing, dandelions, and fallen leaves.

## v0.15.3

- The window's sashes no longer clip against the frame at their edges, and below the raised sash the opening is clear to the outside.

## v0.15.2

- The quarry pond is at its true size: about 0.9 by 1.3 km, so the walkway around it runs near 1.85 miles, with the near bank past a strip of park and the wooded far shore a kilometer off.

## v0.15.1

- Past the road is a neighborhood park around an old quarry pond: a skewed loop of water with a stone rim and a gravel walkway around it, trees beyond, a few ducks paddling about, and the sun reflected in the water.

## v0.15.0

- The white rabbit becomes a walk: out of the TV, sitting back, turning in the chair to the window, standing, walking over at an angle to see the car, stepping square to the window, raising the sash with the scroll, and going out through it into the white.
- Below the second-story window is a lakefront: a fenced lawn with a swing set and sunflowers, autumn trees, a sidewalk, a two-way road, another sidewalk, a pebble shore, and a wide lake with the sun glittering on it, all moving in the same wind.
- Facing the sun brings a real glare: a hot core, a soft glow, a faint streak, and lens ghosts, in place of the hazy wash.
- Dust drifts in groups on the room's air, sparkling in the sunbeams: larger and softer up close, finer far off, some as tiny fibres, and stirred by gusts through the open window.

## v0.14.6

- Wide screens no longer stretch the chairs at the sides of the view.
- The chairs' carved front posts are wider and start at the cushion's edge, centered on the head and leg, in darker, aged walnut.
- The window's lower sash slides, with its lock on top of the meeting rail and the keeper on top of the upper sash's rail, and the glass is clear.
- The glitch after the catch crackles with electric zaps instead of beeps.
- Coming back to the browser, the first touch rebuilds the sound if it went quiet.

## v0.14.5

- The number reads (424) 32-neon1, in the brand's lowercase.

## v0.14.4

- Contact invites what's on your mind or an opinion on your operations, with the email and number as links.
- Links in running text look the same across the site: dark brand green, bold, and an arrow, with no underline.
- The footer lists the phone number last, after LinkedIn.

## v0.14.3

- Each process step's dot lines up with its green number.

## v0.14.2

- The window's lower sash is raised about 40%, so the opening below it looks straight out at the trees.
- The glitch sounds play again as soon as the rabbit is caught; the room's sounds still wait for the scroll.
- On phones, the first touch after coming back to the browser brings the sound back, engine included.
- The rug is a thin shag that eases down to the floor at its edges, and its strands lie flat and splay under every leg.
- The TV's glass reflects the window as a soft, curved highlight that moves with the view.

## v0.14.1

- Catching the white rabbit no longer washes the landing brown or pushes the hero down, on phones in either orientation and on desktops.
- The car's ignition is a third shorter, and its idle no longer loops audibly: it drifts and lopes like a real engine.
- The sound comes back after you leave the browser and return.
- The trees toss harder when the wind gusts.
- Each chair's side is one wooden piece with its carved front post, and the rug has a thick, fuzzy pile that dents under every leg.

## v0.14.0

- The white rabbit is a full room: a rendered sky, clouds, and trees moving in the wind past a double-hung sash window, baked light, and photographed leather, walnut, rug, and plaster.
- A credited 2019 coupe (CC BY 4.0) waits outside in pearl black, with black rims, red calipers, and smoked side markers that glow white at ignition.
- Sound starts once the view leaves the TV: a tube hum, static with the snow, and wind, leaves, birds, and a creek through the glass. There is no toggle.
- Without motion or WebGL, a silent card opens a window out of the dark as you scroll.
- The copy no longer says New York outside the footer, and About introduces Pradeep by name.

## v0.13.6

- Email goes to hello@neon1.tech, and security reports to security@neon1.tech.

## v0.13.5

- The contact section and footer list neon1's number: (424) 32-NEON1, or (424) 326-3661.

## v0.13.4

- The note under services is down to three short sentences.

## v0.13.3

- Services read lighter: shorter lines in smaller type, with less space between them.

## v0.13.2

- Footer column titles are level-three headings, so the page's heading order has no gaps.

## v0.13.1

- The white rabbit's room: a rounded vintage tube TV with a domed glass screen, knobs, and a grille, on a walnut table between two tufted leather wingback chairs, with brand-green moulding, wainscot walls, and an oak floor with a rug.

## v0.13.0

- Scripts and styles moved out of the page into their own files, so the site can run under a strict Content Security Policy.
- Footer links to the privacy policy, browser storage notice, and terms, and the footer now says "No ads or trackers" rather than promising no storage at all.
- A skip-to-content link, case study buttons named after their case, card arrows on phones, darker service text for contrast, and rain controls that leave the tab order once they fade out.
- The phone menu keeps focus inside itself while open and closes if the window widens past it.
- The rain stops drawing once it's scrolled out of sight, the section scroller rests when the page is still, and turning on reduced motion mid-visit hands scrolling back to the browser.
- A descriptive title, a canonical link, link-preview text and image, and structured data for the practice.
- robots.txt, sitemap.xml, and a security.txt contact.
- The accounting case labels its MCP server as next, matching the full case study. The projects section says which projects are public or private, and the about section names who runs neon1.

## v0.12.8

- The rain sizes itself to its own box rather than the window, so an on-screen keyboard or a zoom no longer leaves a dense band of stuck rain.

## v0.12.7

- Glass panes share one roomier padding, used by the landing's wordmark pane and the not-found page, whose pane now magnifies the rain like the landing's.
- Pinch-zooming no longer scrambles the rain or the hero; they wait until the page is back at normal scale.

## v0.12.6

- Unknown paths get a real not-found page, with a 404 status: the rain behind a glitching 404 and a way home. The glitch is shared with 1NEON.

## v0.12.5

- The rabbit's glitch lets the rain run a little longer before its last stutter.

## v0.12.4

- The four stages are named as actions on what's needed: Needs, Execute, Observe, and Normalize.

## v0.12.3

- Catching the white rabbit now glitches the rain: a hard freeze, a dropped-frame jump with one flicker, and uneven stop-start stutters before it holds still.
- The rabbit is drawn white, as a white rabbit should be.

## v0.12.2

- Menu links glow in the logo's neon, and the header turns dark with the menu open, even over the light page.

## v0.12.1

- The white rabbit's window: a blue sky with puffy clouds drifting past a visible sun. When the sun is out, warm light shafts stream into the room, a sunlit patch lands on the floor, and dust glints in the beams; when a cloud covers it, the room cools again.
- The "currently private" note sits to the right of the lock.

## v0.12.0

- The white rabbit: now and then a 🐇 falls in the rain. Catch it, and scrolling pulls you back out of an old TV into a sunlit room, ending on "go touch grass". Scrolling up plays it back into the screen. three.js loads only after a catch, and reduced motion gets a short crossfade instead.
- Services lead with business workflows and technology for small to medium businesses, then cloud and AI engineering, networks, devices, and spaces, and security awareness and readiness.
- How it works is now process and comes before case studies. About is in the nav.
- The fourth stage is Normalize: handoff, training, retiring the old setup, and cleanup.
- Proposals come with estimates rather than fixed prices, and a new question covers how data and accounts are treated.
- About speaks to close to 15 years of interest in technology and automation, and to leaving people knowing their options.
- Xenoss links to its site from the case studies.
- The logo is a real link to neon1.tech, for bookmarking, and still springs back to the top.
- The 1NEON button fades the page out and hands over to the portal, which fades itself in.
- The hero pane has more room, and the rain is lighter so the content reads first.
- The rabbit favicon, the typed easter eggs, and the scroll cue are gone.

## v0.11.1

- Open source shows formal names: AWS CLIP, DeployOps, neon1 Ready, and 1NEON. A public project shows the case-study arrow on hover and opens in a new tab; a private one shows a lock that says "currently private" on hover or tap.
- The case studies intro puts Need, Execution, Observation, and Next on a line of their own.
- The logo and nav links keep their place when the header turns light.
- Nav items stay on one line with centered text, and fold into the menu below 960px wide.
- In landscape on notched phones, the header and page run edge to edge, with content kept clear of the notch.

## v0.11.0

- A 1NEON button in the top bar, and in the phone menu, opens the client portal at neon1.tech/1NEON.
- The rain, its glass lens, its controls, the fonts, and the brand colors now live in `shared/`, so 1NEON uses the same files as the site instead of copies.
- Rain settings (grid or free, characters, and pause) carry over between the site and 1NEON.
- A paused rain keeps the glass panes in step while scrolling.

## v0.10.1

- Rain words only form from a drop that has fallen from the top, so they read as part of the rain.
- Case-study cards are a little wider, with one-line titles and result lines, even spacing, and dividers that line up across cards.
- The case-study panel animates with the browser's own compositor and no background blur, so it stays smooth on slower machines.
- Case-study copy: an MCP server for the accounting assistant, EHR filing by patient ID and MRN for the dermatology portal, neon1-ready for keeping security talks current, and on-demand support for home tech.
- neon1-ready joins open source.
- New default rain, "text": Latin, Greek, Cyrillic, Hebrew, Arabic, Devanagari, Thai, kana, Hangul, and CJK, weighted like the original neon1 rain. The cycle is now text, katakana, numbers, symbols, emoji, faces, mixed.
- Rain words hold about 0.75 seconds less before fading.
- Glass panes over the rain act as lenses: clear black, with the rain behind each pane magnified about 15% and bent at a thin rim, drawn on a canvas layer so it works the same in every browser. They cover the logo, each header link, the book-a-call button (keeping its green border), the rain controls, and the hero wordmark and tagline sit on blurred glass panes with one shared radius. The header returns to plain once it turns light.
- About focuses on why neon1 exists and the habits behind it, with a fuller nod to Neo and Andrew.
- The rain falls about 25% slower. For now, rain words are only neon1's own names, slogans, values, and offerings; Matrix, movie, and tech-stack words are commented out.
- The hero pane has equal space above the wordmark and below the slogan.
- Scrolling back up into a tall view (like services) lands with its last lines fully on screen, not hidden by the header offset.

## v0.10.0

- "work" is now "case studies": six cards, adding a grade-school community project. Each card shows Need, Execution, Observation, and Next as four short lines, keeps its result line, and opens its full case study from a brand-green ↗ in its corner, or a click anywhere on the card. The open panel closes with ↙ in the same corner.
- A case study opens by growing out of its card into a panel over the page and shrinks back into the card when closed (×, Esc, or a click outside). The page stays where it was.
- Rain drops keep falling after a word, trails are shorter, and the rain is a little softer.
- Scroll resistance between views is cut in half.
- Opening the site with a section link lands on that view in every browser, even if fonts load late.

## v0.9.3

- How it works has five steps: Listen, Propose, Decide, Build, Hand over. Proposals give a few options with a fixed price, effort, and what each gets you, and the hand-over includes checking results.
- Pricing in questions, services, and about follows the same options-based approach.
- 1NEON: "1 portal. Needs. Execution. Observation. Next."

## v0.9.2

- On touch screens each view leaves room at its end for browser toolbars that sit over the page (DuckDuckGo, Safari), so the last lines aren't hidden.
- Touch scrolling follows the finger directly, which removes the stutter in Chrome on phones.
- Resistance between views is about 20% softer again.

## v0.9.1

- Every list of three or more uses a comma before the final "and" or "or".
- Views size themselves to the browser's visible height, so they end at the bottom edge in Safari, DuckDuckGo, Chrome and Firefox, on desktop and phone. Text no longer enlarges in phone landscape.
- neon1 marks: "neon" is set 1.3x so its letters match the height of the "1", at a lighter weight so the strokes match. All marks use the self-hosted JetBrains Mono so they look the same in every browser.
- Rain words can start anywhere on screen, use the same weight as the rain, and appear more often. Values and offerings are most common, then neon1's names and slogans (in neon1 green), then Matrix words. All other words share one gold.
- Rain characters: katakana, numbers, symbols, emoji, faces, mixed. Every glyph is centered in its cell, and emoji are sized to match the text.
- Contact: the email link sits at the end of the sentence. Footer links are lowercase.

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
