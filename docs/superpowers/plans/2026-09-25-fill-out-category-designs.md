# Fill Every Section-Picker Category to 4 Designs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every category in the Page Builder's Section-picker popup should offer at least 4 real, visually distinct designs — 14 of the 16 categories currently have 1-3. Add 34 new Puck components (construction pack) across those 14 categories, matching existing sibling conventions exactly.

**Architecture:** All new components live in `frontend/src/app/admin/page-builder/packs/construction/index.tsx` (where every existing sibling in these categories already lives), registered in `typedComponents`, added to the matching category's `components` array in `typedCategories`, and (only if a component itself has multiple visual variants, which none of these do — each is a standalone sibling design) an entry in the pack's `variants` map. No backend/API changes.

**Tech Stack:** React/Next.js, TypeScript, `@puckeditor/core`, Tailwind CSS.

**Conventions confirmed from existing sibling components (apply to every new one):**
- Wrap content in `<section className={... + padY[padding]}>` → `<div className={wrap}>...</div>` using the file's existing shared `padY` (`{sm:'py-8', md:'py-14', lg:'py-24'}`) and `wrap` (`'mx-auto max-w-6xl px-4 md:px-8'`) lookups — don't redefine these, they're module-level already.
- Every component has a `padding` field (`{type:'select', options:[{label:'Small',value:'sm'},{label:'Medium',value:'md'},{label:'Large',value:'lg'}]}`, default `'md'`) and (unless the design genuinely has no background variation) a `background` field (`select`, e.g. `white|muted|dark|accent`), with a small `bgCls`/matching text-color-class lookup in the render body driven by that field.
- Any image field uses the shared `imageField('Label')` custom field (already imported/available in this file via `frontend/src/app/admin/page-builder/packs/image-field.tsx`) — never a plain `{type:'text'}` URL field for new components, even though some older siblings still use that (don't "fix" the old ones, just don't repeat the pattern).
- Real Unsplash photo URLs for any placeholder default image content: `https://images.unsplash.com/photo-<id>?w=<w>&h=<h>&fit=crop&auto=format` (add `&crop=faces` for portraits/headshots). Pick ids already used elsewhere in this file for visual consistency where a similar subject is needed (construction sites, team portraits, etc.) — search the file for `images.unsplash.com` to find ones already in use, reuse rather than inventing new arbitrary ids.
- Repeatable content ("4 stats", "3 cards", etc.): use flat numbered fields (`item1Title/item1Text`, `item2Title/item2Text`, ...) matching the numbered-field convention already used by the majority of siblings in these categories (`statNValue/statNLabel`, `memberNName/Role/Image`, `faqNQuestion/Answer`, etc.) — this is the dominant, simplest pattern and what reviewers will expect; only reach for Puck's native `type:'array'` field (as `ConstructionProjectsSlider`/`ConstructionTestimonialsSlider` already do) when a task explicitly calls for a carousel/array-native design below.
- `defaultProps` must be real, branded, construction-industry copy in the Subhadra Group's voice (see any existing sibling's defaultProps for tone) — never Lorem ipsum or generic placeholder text.
- Component `label` (shown in the picker's badge) should be a short, human title distinct from its React component name, matching the style of existing labels ("Stats & Experience Strip", "Founder", "Our Brands (Tabbed Categories)").
- Every new component key must be globally unique across the whole app (not just this file) — `composePacks` throws on collision. All names proposed below are already checked against the existing component list and are unique; if an implementer needs to adjust a name, keep the `Construction` prefix and verify uniqueness with `grep -rn "ComponentName" frontend/src/app/admin/page-builder/packs/`.
- Register each new component in TWO places: `typedComponents` (the big object literal where every existing component lives) and the matching category's `components` array in `typedCategories` (~line 8330, already read in a prior session — grep `const typedCategories` to relocate if line numbers have shifted).
- After each task: `cd frontend && npx tsc --noEmit` (zero errors) and `npx next lint --file src/app/admin/page-builder/packs/construction/index.tsx` (clean) — there is no meaningful automated test for a visual-only Puck component's render output in this repo's test setup (confirmed: no existing sibling in this file has a dedicated render test), so verification here is type-check + lint + a careful read-back of the JSX, not a new test file. Note this plainly in each task's report — it is not a shortfall, it matches how every existing component in this file is verified.
- After the LAST task in a work session, run `docker compose build frontend && docker compose up -d frontend` from the repo root so the running app actually serves the new components (this app runs as a built Docker image, not a live-reloading dev server — confirmed earlier this session, forgetting this step is why an earlier round of popup changes appeared to do nothing).

**Priority order (ascending — categories needing fewest new designs first):** Counters (+1) → Call to Action (+1) → About (+2) → Blog Posts (+2) → Team (+2) → Testimonials (+2) → Video (+3) → Featured Projects (+3) → Sectors (+3) → Brands (+3) → FAQ (+3) → Clients (+3) → Forms (+3) → Social Media (+3).

---

## Task 1: Counters — add `ConstructionMilestoneTimeline` (+1, category now at 4)

**Files:** Modify `frontend/src/app/admin/page-builder/packs/construction/index.tsx` (add the component near `ConstructionStatsStrip`/`ConstructionSafetyRecord`, register in `typedComponents` and the `counters` category's `components` array).

**Design:** A horizontal 4-milestone timeline — distinct from the two existing stat-grid strips (no big numbers-only grid; this is a chronological "our journey" strip with a year + short label under each of 4 dots on a connecting line). White/light background by default.

**Fields:** `padding` (select, default `'md'`), `background` (select `white|muted`, default `'white'`), `eyebrow` (text, e.g. "Our Journey"), `heading` (text), then `milestone1Year`/`milestone1Label` through `milestone4Year`/`milestone4Label` (all text).

**Default content (real, branded):** eyebrow "Our Journey", heading "Two Decades of Growth", milestones e.g. 1996 "Founded in Vijayawada", 2008 "First commercial VRF installation", 2015 "500+ projects delivered", 2024 "Andhra Pradesh's trusted engineering partner" (adapt wording to match this file's existing tone/company-name conventions — check a nearby sibling's defaultProps for the exact phrasing style, e.g. "30+ years" claims elsewhere, keep numbers plausible/consistent with those).

**Render layout:** `wrap` div → eyebrow (small uppercase, muted) + heading (bold, text-2xl/3xl) → below, a flex row of 4 items, each a dot (small filled circle, connected by a horizontal line — a `border-t` on a shared flex container with each item's dot as a `-mt` offset circle is a simple CSS way to do this, or a `grid grid-cols-4` with a shared `<div className="absolute ... border-t">` line behind — implementer's call on the simplest correct CSS, doesn't need to be pixel-perfect, just clearly read as a timeline) → year (bold) + label (smaller, muted) under each dot.

- [ ] **Step 1:** Add the component (fields, defaultProps, render) to `typedComponents`, following the conventions above.
- [ ] **Step 2:** Register `ConstructionMilestoneTimeline` in `typedCategories.counters.components` (alongside `ConstructionStatsStrip`, `ConstructionSafetyRecord`).
- [ ] **Step 3:** `cd frontend && npx tsc --noEmit` — zero errors.
- [ ] **Step 4:** `cd frontend && npx next lint --file src/app/admin/page-builder/packs/construction/index.tsx` — clean.
- [ ] **Step 5:** Commit:
  ```bash
  git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
  git commit -m "feat(page-builder): add Milestone Timeline design to the Counters category

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
  ```

---

## Task 2: Call to Action — add `ConstructionUrgencyBanner` (+1, category now at 4)

**Design:** A thin, single-line urgency banner — bold short headline + one CTA button + phone number, all on one row (not a centered block like `ConstructionQuoteCTA`, not a plain tagline like `ConstructionTaglineStrip`, not fixed-position buttons like `ConstructionFloatingActions`).

**Fields:** `padding` (select, default `'sm'` — this is meant to be thin), `background` (select `accent|dark`, default `'accent'`), `headline` (text, short — e.g. "Limited slots this month"), `ctaLabel`/`ctaHref` (text), `phoneNumber`/`phoneLabel` (text).

**Default content:** headline "Only 3 install slots left this month — book your site survey today", ctaLabel "Book a Survey", ctaHref "#quote", phoneNumber a plausible Indian business number matching format used elsewhere in this file (grep an existing sibling's `phoneNumber` default for the exact format/digits convention), phoneLabel "Call now".

**Render layout:** single flex row, `justify-between` or `justify-center gap-6` on wider screens, headline left-ish, CTA button + phone right-ish; wraps to stacked on narrow (`flex-col sm:flex-row`).

- [ ] **Step 1:** Add the component to `typedComponents`.
- [ ] **Step 2:** Register in `typedCategories.cta.components`.
- [ ] **Step 3:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 4:** `npx next lint --file src/app/admin/page-builder/packs/construction/index.tsx` — clean.
- [ ] **Step 5:** Commit (same message pattern as Task 1, describing this component/category).

---

## Task 3: About — add `ConstructionTimelineHistory` + `ConstructionLeadershipGrid` (+2, category now at 4)

**`ConstructionTimelineHistory`:** Same "chronological milestones" concept as Task 1 but styled as an About-section history (vertical stacked list with a connecting line down the left, not horizontal — differentiate from Task 1's Counters timeline so the two don't feel identical; e.g. 4 rows, each with a year badge on the left and a 1-2 sentence description on the right). Fields: `padding`, `background` (`white|muted`), `eyebrow`, `heading`, `entry1Year`/`entry1Text` … `entry4Year`/`entry4Text`.

**`ConstructionLeadershipGrid`:** 3-4 leadership photo cards in a grid — photo (`imageField`), name, title, one-line bio. Distinct from `ConstructionFounder`'s single pull-quote layout and `ConstructionAboutSplit`'s badge/checklist split. Fields: `padding`, `background`, `eyebrow`, `heading`, `leader1Photo`(imageField)/`leader1Name`/`leader1Title`/`leader1Bio` … through `leader3` (3 is fine, "3-4" in the design note above is implementer's judgment call — 3 keeps it simple and matches most other 3-item grids in this file).

Both need real branded defaultProps (construction-company leadership names/titles/bios — invented but plausible, matching the Subhadra Group branding used elsewhere).

- [ ] **Step 1:** Add `ConstructionTimelineHistory` to `typedComponents`; register in `typedCategories.founder.components`.
- [ ] **Step 2:** Add `ConstructionLeadershipGrid` to `typedComponents`; register in `typedCategories.founder.components`.
- [ ] **Step 3:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 4:** `npx next lint --file src/app/admin/page-builder/packs/construction/index.tsx` — clean.
- [ ] **Step 5:** Commit both components together (one category, one commit).

---

## Task 4: Blog Posts — add `ConstructionNewsTicker` + `ConstructionCaseStudyGrid` (+2, category now at 4)

**`ConstructionNewsTicker`:** Compact "Latest News" list — 4 short headline + date rows, no images, tight vertical spacing (a simple `<ul>`-like stack, not a grid) — distinct from the existing 3-card image grid (`ConstructionBlogPosts`) and the single case-study split (`ConstructionFeaturedProject`). Fields: `padding`, `background`, `eyebrow`, `heading`, `news1Headline`/`news1Date` … `news4Headline`/`news4Date`.

**`ConstructionCaseStudyGrid`:** 3-card case-study grid — each card: `imageField`, client name, one result stat (e.g. "40% faster completion"), short description, link label/href. Distinct from `ConstructionBlogPosts` (which has category+title+date, no stat/client/link) by centering each card on a measurable result. Fields: `padding`, `background`, `eyebrow`, `heading`, `case1Image`(imageField)/`case1Client`/`case1Stat`/`case1Description`/`case1LinkLabel`/`case1LinkHref` … through `case3`.

- [ ] **Step 1:** Add `ConstructionNewsTicker`; register in `typedCategories.blogpost.components`.
- [ ] **Step 2:** Add `ConstructionCaseStudyGrid`; register in `typedCategories.blogpost.components`.
- [ ] **Step 3:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 4:** `npx next lint --file ...` — clean.
- [ ] **Step 5:** Commit both together.

---

## Task 5: Team — add `ConstructionOrgChart` + `ConstructionTeamStats` (+2, category now at 4)

**`ConstructionOrgChart`:** Simple 2-tier hierarchy — 1 top card (e.g. "Managing Director") centered, 3 cards below it in a row (department heads), connected by simple lines/spacing, not photos-heavy — text-forward (name + role), one small photo per card is fine via `imageField` but keep it compact. Fields: `padding`, `background`, `heading`, `topName`/`topRole`/`topPhoto`(imageField), `report1Name`/`report1Role`/`report1Photo` … through `report3`.

**`ConstructionTeamStats`:** Hybrid — a small stat row (team size, years of combined experience, certifications count — 3 stats) ABOVE or beside 3 highlighted crew photo cards (photo + name + years-with-company). Distinct from `ConstructionTeamCrew`'s plain 4-photo grid and `ConstructionCertificationsBadges`'s 6-badge grid by combining a stat callout with photos. Fields: `padding`, `background`, `stat1Value`/`stat1Label`, `stat2Value`/`stat2Label`, `stat3Value`/`stat3Label`, `crew1Photo`(imageField)/`crew1Name`/`crew1YearsWithUs` … through `crew3`.

- [ ] **Step 1:** Add `ConstructionOrgChart`; register in `typedCategories.team.components`.
- [ ] **Step 2:** Add `ConstructionTeamStats`; register in `typedCategories.team.components`.
- [ ] **Step 3:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 4:** `npx next lint --file ...` — clean.
- [ ] **Step 5:** Commit both together.

---

## Task 6: Testimonials — add array-based `ConstructionTestimonialsCarousel` + `ConstructionVideoTestimonials` (+2, category now at 4)

**`ConstructionTestimonialsCarousel`:** One large single-quote-at-a-time carousel using Puck's native `type:'array'` field (same pattern as `ConstructionTestimonialsSlider`/`ConstructionProjectsSlider` already in this file — copy their array-field structure exactly, don't reinvent it) — each array item: `imageField('Photo')`, `quote` (textarea), `name`, `role`. Render shows the FIRST array item large/prominent (a real carousel's JS interactivity is out of scope — a static "first slide" render matching how `ConstructionProjectsSlider`'s preview/render already handles its array data, check that component's render function for the exact pattern to mirror) with small dot indicators below for visual completeness, distinct from the existing 3-static-cards (`ConstructionTestimonials`) and existing photo-slider (`ConstructionTestimonialsSlider`) by being single-large-quote-focused, not multi-card.

**`ConstructionVideoTestimonials`:** 3 video-thumbnail testimonial cards — each: `imageField('Thumbnail')`, a play-icon overlay (reuse whatever play-button visual treatment `ConstructionVideo` already uses — check that component's render for the exact icon/overlay markup and mirror it), client name, short quote caption. Fields: `padding`, `background`, `heading`, `testimonial1Thumbnail`(imageField)/`testimonial1Name`/`testimonial1Quote` … through `testimonial3`.

- [ ] **Step 1:** Read `ConstructionTestimonialsSlider`'s or `ConstructionProjectsSlider`'s existing array-field render code first (whichever is closer in shape) to confirm the exact array-field + render pattern before writing `ConstructionTestimonialsCarousel` — this is the one task in this plan using a field type (`type:'array'`) that most other tasks don't, get the shape right by copying a working example, not guessing at Puck's array field API.
- [ ] **Step 2:** Add `ConstructionTestimonialsCarousel`; register in `typedCategories.testimonials.components`.
- [ ] **Step 3:** Add `ConstructionVideoTestimonials`; register in `typedCategories.testimonials.components`.
- [ ] **Step 4:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 5:** `npx next lint --file ...` — clean.
- [ ] **Step 6:** Commit both together.

---

## Task 7: Video — add `ConstructionVideoGrid` + `ConstructionVideoSplitStats` + `ConstructionVideoReel` (+3, category now at 4)

**`ConstructionVideoGrid`:** 3 video thumbnails in a grid (no single hero video) — each: `imageField('Thumbnail')`, play-icon overlay (mirror `ConstructionVideo`'s existing play-button markup), title, a small duration badge (text, e.g. "2:15"). Fields: `padding`, `background`, `heading`, `video1Thumbnail`(imageField)/`video1Title`/`video1Duration` … through `video3`.

**`ConstructionVideoSplitStats`:** Video thumbnail (with play overlay) on one side, 3 stat callouts on the other side — distinct from the Counters-category components by being framed as "why watch this video" stats next to the actual video, not a standalone stat strip. Fields: `padding`, `background`, `thumbnail`(imageField), `videoUrl`, `heading`, `stat1Value`/`stat1Label`, `stat2Value`/`stat2Label`, `stat3Value`/`stat3Label`.

**`ConstructionVideoReel`:** A single portrait/vertical-aspect video card (think Instagram Reel/YouTube Shorts framing) with a caption overlay at the bottom — distinct aspect ratio and framing from the wide/horizontal `ConstructionVideo`. Fields: `padding`, `background`, `thumbnail`(imageField), `videoUrl`, `caption`.

- [ ] **Step 1:** Add `ConstructionVideoGrid`; register in `typedCategories.video.components`.
- [ ] **Step 2:** Add `ConstructionVideoSplitStats`; register in `typedCategories.video.components`.
- [ ] **Step 3:** Add `ConstructionVideoReel`; register in `typedCategories.video.components`.
- [ ] **Step 4:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 5:** `npx next lint --file ...` — clean.
- [ ] **Step 6:** Commit all three together.

---

## Task 8: Featured Projects — add `ConstructionProjectsGridCards` + `ConstructionProjectShowcaseSplit` + `ConstructionProjectMapStrip` (+3, category now at 4)

**`ConstructionProjectsGridCards`:** Static 3-4 project grid (not a slider) — each card: `imageField`, title, category tag, one stat (e.g. sq. ft. or completion year). Fields: numbered `project1Image`(imageField)/`project1Title`/`project1Category`/`project1Stat` … through `project3` (3 is fine).

**`ConstructionProjectShowcaseSplit`:** One large featured-project split — big image one side (`imageField`), title/description/2-3 stats the other side. Fields: `image`(imageField), `title`, `description`, `stat1Value`/`stat1Label`, `stat2Value`/`stat2Label`.

**`ConstructionProjectMapStrip`:** Horizontal strip of 4 project location "pins" — each a small thumbnail (`imageField`) + city/area name tag, laid out as a simple horizontal row (no real map/geo library — this is a visual metaphor via tags, not an actual map integration, which is explicitly out of scope). Fields: `heading`, `location1Thumbnail`(imageField)/`location1City` … through `location4`.

- [ ] **Step 1:** Add `ConstructionProjectsGridCards`; register in `typedCategories.featuredprojects.components`.
- [ ] **Step 2:** Add `ConstructionProjectShowcaseSplit`; register in `typedCategories.featuredprojects.components`.
- [ ] **Step 3:** Add `ConstructionProjectMapStrip`; register in `typedCategories.featuredprojects.components`.
- [ ] **Step 4:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 5:** `npx next lint --file ...` — clean.
- [ ] **Step 6:** Commit all three together.

---

## Task 9: Sectors — add `ConstructionSectorsTabbed` + `ConstructionSectorsIconRow` + `ConstructionSectorsSplitFeature` (+3, category now at 4)

**`ConstructionSectorsTabbed`:** Reuse the tab pattern already established by `ConstructionOurBrands` (Brands category) — read that component's field/render shape first and mirror its tab-switching structure (fields for `tabNLabel` + tab body content) — 3 sector tabs (e.g. Residential/Commercial/Industrial), each with a short description.

**`ConstructionSectorsIconRow`:** Compact horizontal row of sector names with small icons, no images — 4-5 items, single line/wrap. Fields: `sector1Icon`(select, reuse whatever icon-select options an existing component in this file already offers, e.g. `ConstructionFeaturedProject`'s `scopeNIcon` select — mirror its options list) + `sector1Label` … through `sector5`.

**`ConstructionSectorsSplitFeature`:** One large "featured sector" (image + description, `imageField`) on one side, a simple list of 3-4 other sector names on the other side. Fields: `featuredImage`(imageField), `featuredTitle`, `featuredDescription`, `otherSector1` … `otherSector4` (plain text labels).

- [ ] **Step 1:** Read `ConstructionOurBrands`'s tab implementation before writing `ConstructionSectorsTabbed` — mirror its structure, don't reinvent tabs.
- [ ] **Step 2:** Add `ConstructionSectorsTabbed`; register in `typedCategories.sectors.components`.
- [ ] **Step 3:** Add `ConstructionSectorsIconRow`; register in `typedCategories.sectors.components`.
- [ ] **Step 4:** Add `ConstructionSectorsSplitFeature`; register in `typedCategories.sectors.components`.
- [ ] **Step 5:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 6:** `npx next lint --file ...` — clean.
- [ ] **Step 7:** Commit all three together.

---

## Task 10: Brands — add `ConstructionBrandsLogoGrid` + `ConstructionBrandsCarousel` + `ConstructionBrandsSpotlight` (+3, category now at 4)

**`ConstructionBrandsLogoGrid`:** Actual brand LOGO images (not text names like the existing `ConstructionOurBrands`) — a grid of 6 logos via `imageField` each. Fields: `heading`, `logo1`(imageField) … `logo6`(imageField).

**`ConstructionBrandsCarousel`:** Array-based horizontal logo strip using Puck's `type:'array'` field (mirror the array pattern from Task 6/`ConstructionProjectsSlider` again) — each item: `imageField('Logo')`. Render shows all logos in a horizontal flex row (a real scrolling carousel's JS is out of scope — static row is fine, matching how this repo already treats "slider" components as static-render-of-first-or-all-items in the admin preview).

**`ConstructionBrandsSpotlight`:** One large "featured brand partner" logo (`imageField`) + description, plus a smaller row of 3-4 other brand logos below. Fields: `spotlightLogo`(imageField), `spotlightDescription`, `otherLogo1`(imageField) … `otherLogo4`(imageField).

- [ ] **Step 1:** Add `ConstructionBrandsLogoGrid`; register in `typedCategories.brands.components`.
- [ ] **Step 2:** Read the array-field pattern again (same reference as Task 6) before writing `ConstructionBrandsCarousel`.
- [ ] **Step 3:** Add `ConstructionBrandsCarousel`; register in `typedCategories.brands.components`.
- [ ] **Step 4:** Add `ConstructionBrandsSpotlight`; register in `typedCategories.brands.components`.
- [ ] **Step 5:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 6:** `npx next lint --file ...` — clean.
- [ ] **Step 7:** Commit all three together.

---

## Task 11: FAQ — add `ConstructionFAQAccordionCategories` + `ConstructionFAQTwoColumn` + `ConstructionFAQWithContact` (+3, category now at 4)

**`ConstructionFAQAccordionCategories`:** FAQs grouped into 2 labeled categories (e.g. "Pricing", "Process"), 3 Q/A pairs each — a static (non-interactive-accordion, matching this file's convention of static-render Puck components — check `ConstructionFAQ`'s existing render, it's likely a plain list not a real collapsible accordion; mirror that same "static, always-expanded" convention rather than building real accordion JS behavior) grouped list. Fields: `category1Label`, `category1Faq1Question`/`Answer`, `category1Faq2Question`/`Answer`, `category1Faq3Question`/`Answer`, then the same set for `category2`.

**`ConstructionFAQTwoColumn`:** 6 Q/A pairs laid out in two columns (3 per column) — denser than the existing flat-4 `ConstructionFAQ`. Fields: `faq1Question`/`Answer` … `faq6Question`/`Answer`.

**`ConstructionFAQWithContact`:** 3 Q/A pairs on one side, a "still have questions?" contact CTA panel (heading + button) on the other side. Fields: `faq1Question`/`Answer` … `faq3Question`/`Answer`, `contactHeading`, `contactCtaLabel`/`contactCtaHref`.

- [ ] **Step 1:** Read `ConstructionFAQ`'s existing render first to confirm the static (non-JS-accordion) convention before writing the 3 new ones.
- [ ] **Step 2:** Add `ConstructionFAQAccordionCategories`; register in `typedCategories.faq.components`.
- [ ] **Step 3:** Add `ConstructionFAQTwoColumn`; register in `typedCategories.faq.components`.
- [ ] **Step 4:** Add `ConstructionFAQWithContact`; register in `typedCategories.faq.components`.
- [ ] **Step 5:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 6:** `npx next lint --file ...` — clean.
- [ ] **Step 7:** Commit all three together.

---

## Task 12: Clients — add `ConstructionClientsTestimonialStrip` + `ConstructionClientsMarquee` + `ConstructionClientsCaseHighlight` (+3, category now at 4)

**`ConstructionClientsTestimonialStrip`:** 3 client logo + one-line-quote pairs — bridges the Clients and Testimonials themes but is its own component in the Clients category (not registered under `testimonials`). Fields: `client1Logo`(imageField)/`client1Quote` … through `client3`.

**`ConstructionClientsMarquee`:** A longer logo row (6-8 logos via `imageField`, or use the array pattern again if that reads cleaner — implementer's call, flat numbered fields are simpler and consistent with most of this plan, prefer that unless it feels unreasonably repetitive at 8 items, in which case use the array pattern from Task 6). Static row render (no real marquee-scroll JS needed, matches this repo's "slider" convention of static admin-preview render).

**`ConstructionClientsCaseHighlight`:** One client spotlight — logo (`imageField`) + one result stat + a short quote, plus a smaller row of 3-4 other client logos below. Fields: `spotlightLogo`(imageField), `spotlightStat`, `spotlightQuote`, `otherLogo1`(imageField) … `otherLogo4`(imageField).

- [ ] **Step 1:** Add `ConstructionClientsTestimonialStrip`; register in `typedCategories.clients.components`.
- [ ] **Step 2:** Add `ConstructionClientsMarquee`; register in `typedCategories.clients.components`.
- [ ] **Step 3:** Add `ConstructionClientsCaseHighlight`; register in `typedCategories.clients.components`.
- [ ] **Step 4:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 5:** `npx next lint --file ...` — clean.
- [ ] **Step 6:** Commit all three together.

---

## Task 13: Forms — add `ConstructionSimpleContactForm` + `ConstructionQuoteRequestForm` + `ConstructionContactSplitMap` (+3, category now at 4)

**`ConstructionSimpleContactForm`:** Just a clean contact form — name/email/phone/message fields + a submit button — no FAQ attached (distinct from the existing `ConstructionLeadFormFAQ`, which combines a form with 5 FAQ pairs). **Important:** this is a Puck-editor PREVIEW/render only — check how `ConstructionLeadFormFAQ`'s existing render handles its form (does it actually submit anywhere, or render a static non-functional form markup for visual purposes?) and mirror that exact convention; do not build new form-submission logic/backend wiring, that's out of scope for this plan. Fields: `heading`, `submitLabel`.

**`ConstructionQuoteRequestForm`:** A form styled for quote requests — adds a project-type select (`residential|commercial|industrial`) and a budget-range select, plus a short message field — next to a small trust-badges row (reuse copy/style conventions from wherever "trust" badges already appear elsewhere in this file, e.g. near `ConstructionHero`'s trust-avatar/stat row, for visual consistency). Mirror the same static-form-markup convention as above. Fields: `heading`, `submitLabel`, `trustText`.

**`ConstructionContactSplitMap`:** Form on one side (reuse the simple contact form fields from above), address + business-hours text on the other side (no real map/geo integration — a static placeholder image or a simple styled block standing in for "map", consistent with `ConstructionProjectMapStrip`'s Task 8 note that real map integration is out of scope). Fields: `heading`, `submitLabel`, `address`, `businessHours`.

- [ ] **Step 1:** Read `ConstructionLeadFormFAQ`'s existing render to confirm the static-form-markup convention (no real submission wiring) before writing the 3 new ones.
- [ ] **Step 2:** Add `ConstructionSimpleContactForm`; register in `typedCategories.contact.components`.
- [ ] **Step 3:** Add `ConstructionQuoteRequestForm`; register in `typedCategories.contact.components`.
- [ ] **Step 4:** Add `ConstructionContactSplitMap`; register in `typedCategories.contact.components`.
- [ ] **Step 5:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 6:** `npx next lint --file ...` — clean.
- [ ] **Step 7:** Commit all three together.

---

## Task 14: Social Media — add `ConstructionSocialFeedGrid` + `ConstructionSocialFollowBanner` + `ConstructionSocialVideoHighlights` (+3, category now at 4)

**`ConstructionSocialFeedGrid`:** A grid of 3-4 mock "social post" preview cards — each: `imageField`, caption text, a platform-icon indicator (select: `instagram|facebook|linkedin|youtube` — implementer's call on whether to render an actual icon per platform via `lucide-react`'s available social icons, or a simple text badge if no matching icon exists in this repo's icon set; check `lucide-react`'s exports used elsewhere in this file first). Fields: `post1Image`(imageField)/`post1Caption`/`post1Platform`(select) … through `post3` or `post4`.

**`ConstructionSocialFollowBanner`:** A bold "Follow us" banner — big platform icon buttons (reuse whatever social-icon rendering approach Task 14's first component settles on) + a follower-count stat. Distinct from the existing plain-handle-strip `ConstructionSocialMedia` by being visually bold/CTA-styled rather than a quiet text strip. Fields: `heading`, `followerCount`, `followerLabel`, plus the same `facebookHandle`/`instagramHandle`/`linkedinHandle`/`twitterHandle` fields the existing `ConstructionSocialMedia` already uses (for consistency — check that component's exact field names and reuse them verbatim).

**`ConstructionSocialVideoHighlights`:** 3 short-video/reel thumbnail cards with platform badges — reuse the play-icon-overlay convention from the Video category tasks (`ConstructionVideo`'s existing markup) plus a small platform badge per card. Fields: `highlight1Thumbnail`(imageField)/`highlight1Platform`(select)/`highlight1Caption` … through `highlight3`.

- [ ] **Step 1:** Check `ConstructionSocialMedia`'s exact existing field names (`facebookHandle` etc.) and `ConstructionVideo`'s play-icon markup before writing these three, to reuse both conventions exactly.
- [ ] **Step 2:** Add `ConstructionSocialFeedGrid`; register in `typedCategories.socialmedia.components`.
- [ ] **Step 3:** Add `ConstructionSocialFollowBanner`; register in `typedCategories.socialmedia.components`.
- [ ] **Step 4:** Add `ConstructionSocialVideoHighlights`; register in `typedCategories.socialmedia.components`.
- [ ] **Step 5:** `npx tsc --noEmit` — zero errors.
- [ ] **Step 6:** `npx next lint --file ...` — clean.
- [ ] **Step 7:** Commit all three together.

---

## Task 15: Final rebuild and verification

- [ ] **Step 1:** `cd frontend && npx tsc --noEmit` (whole project) — zero errors.
- [ ] **Step 2:** `cd frontend && npx vitest run` — no regressions (same pre-existing 3-failure baseline in `template-engine-website-stage.test.tsx` is acceptable, nothing else should fail).
- [ ] **Step 3:** From repo root: `docker compose build frontend && docker compose up -d frontend` — the running app must actually serve all 34 new components.
- [ ] **Step 4:** Spot-check in a real browser (or ask the user to): open the Section-picker popup for each of the 14 categories touched by this plan and confirm exactly 4 (or more, with a working "Show all" toggle) designs appear, each rendering without visual breakage.

## Self-Review

**Spec coverage:** all 14 under-4 categories from the audit have a task; each task's new-component count matches the audit's "need" column exactly (Counters+1, CTA+1, About+2, Blog Posts+2, Team+2, Testimonials+2, Video+3, Featured Projects+3, Sectors+3, Brands+3, FAQ+3, Clients+3, Forms+3, Social Media+3 = 34 total). Categories already at/above 4 (Hero, Top Header, Header, Services, Footer, Tagline Strip) are correctly excluded.

**Placeholder scan:** every task specifies exact field names, a concrete visual layout description, and realistic default-content guidance — no TBD/TODO. Tasks that depend on reading an existing sibling's code first (array-field pattern, tab pattern, form-markup convention, icon-set check) say so explicitly as their own first step, which is a real instruction (find and mirror existing code), not a placeholder for missing design.

**Type/signature consistency:** every new component follows the same `{label, fields, defaultProps, render}` shape already used by every existing sibling in this file (confirmed via the `ComponentPack`/Puck type shape check during design). Every new key is checked for global uniqueness against the existing component list.

**Scale note:** this is an unusually large plan (34 new components across 14 tasks) by design — the user explicitly confirmed wanting all of them built, in ascending-need priority order, after being shown the real scope. Each task is independently shippable (its own commit, its own category fully reaches 4+ designs) so the work can pause and resume cleanly between any two tasks.
