# Template Engine — KDL Starter Kit
# Module 15 Design Document (Design-System / Multi-Platform Theming Engine)

**Author:** Claude (Cowork) — for approval by Prasanna (web@f9tech.com)
**Date:** 2026-07-13
**Status:** SPEC READY v1.0 — Implementation-ready. Assign as one Paperclip task pointing at this file.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (`.agents/USER_MANAGEMENT_ARCH.md`).
**Source of truth:** the uploaded prototype `template-engine.html` (2746 lines). Its embedded schema (`BASE_TABS`, `PANE_OVERRIDES`, `EXTRA_TABS`, `PLATFORMS`) IS the field catalogue — port it verbatim; do not re-invent field lists.
**Goal:** one admin screen defines the entire visual system — colors, typography, layout, and every component — for **4 platforms × their devices × dark/light themes**, persisted through the **existing Application Settings tables** (`types` / `categories` / `setting_fields`) plus one thin value table, and consumed by web + native clients as resolved design tokens.

---

## Read Scope (TOKEN RULE — read ONLY your phase + step)

| Working on | Read |
|---|---|
| Phase A (schema + seed) | §Mapping, §Schema, §Dimensions, §Field-type map, §Seed generator, Phase A steps |
| Phase B (values API + tokens) | §Schema, §API, §Token resolution, Phase B steps |
| Phase C (frontend) | §Frontend, §API, Phase C steps |
| Review / E2E | whole doc + §Known Risks |

Base facts (all phases): `Type`, `Category`, `SettingField` models ALREADY EXIST in `backend/prisma/schema/core.prisma` but are **unseeded** and have **no CRUD/module**. The current `settings` module only serves the `app_settings` key/value store — do NOT touch it. Prisma singleton, Zod validation, `successResponse`/`errorResponse`, `requirePermission`, `writeActivityAsync`, module-loader + `moduleGate`, `<ModuleGuard>` are all in place (see `CLAUDE.md`).

---

## What this module IS

An **admin design-system configurator**. It is not "a settings page"; it is a theming engine whose output is a set of **design tokens** (CSS custom properties + a JSON theme object) that every KDL client (web app, TV, Android, iOS) reads to render a consistent, brand-controlled UI. The admin edits values in a native-feeling settings UI (already prototyped); the backend stores them; a resolver endpoint compiles them into ready-to-consume tokens per platform + theme.

The prototype confirms the intended persistence in its own comments:
- Header comment: *"pane = Type, group = Category, field = SettingField (maps 1:1 to KDL types / categories / setting_fields tables)"*.
- Save handler comment: `// → POST /api/setting-fields/values { platform, type_id, values[] }`.

---

## Already built — do NOT rebuild

`Type` / `Category` / `SettingField` prisma models (columns: `Type{name,slug,is_active}`, `Category{name,slug,type_id,is_active}`, `SettingField{field_name,slug,input_type,value,alt_text,options,type_id,category_id,sort}`). RBAC + permission middleware. Activity logging. Module loader + manifest install. Admin shell, `<ModuleGuard>`, `DataTable`, axios/query client, Zustand. **Extend these — add nothing that already exists.**

---

## Data model decision (approved 2026-07-13)

1. **Leave `setting_fields` columns untouched.** Encode the platform / device / theme dimensions in the globally-unique `slug` (slug is `@unique`).
2. **Add ONE new thin table `SettingValue`** to hold the saved value per field (defaults live on `SettingField.value` from the seed; `SettingValue` holds edited overrides).
3. **Types are per-platform** (panes differ by platform), Categories per-platform-pane-group, SettingFields per concrete field instance.

### Slug convention (deterministic, re-derivable)

```
Type.slug          = {platform}.{paneId}                         e.g. webapp.buttons  · tv.buttons
Category.slug      = {platform}.{paneId}.{sectionSlug}[.{tag}]   tag = device or theme when the group repeats
SettingField.slug  = {platform}.{paneId}.[{tag}.]{sectionSlug}.{fieldSlug}
```

`sectionSlug` / `fieldSlug` = `lowercase → non-alphanumeric collapsed to "_"` (the prototype's `slug()` fn, line 646). `tag` = a device id (`desktop`, `tv_4k`, `iphone_v`, …) or a theme (`dark`/`light`) — matching the prototype's per-section `mode`/device tag. This mirrors the prototype's field key `f.k = [mode__]slug(sec)__slug(label)` (line 1314), prefixed with `{platform}.{paneId}` for global uniqueness.

### New model (`core.prisma` extension)

```prisma
model SettingValue {
  id         String   @id @default(cuid())
  platform   String                     // webapp | tv | android | ios  (denormalized for fast per-platform load)
  field_id   String   @unique
  value      String                     // stringified; JSON for imglist/fonts/multiselect
  updated_by String?
  updated_at DateTime @updatedAt
  created_at DateTime @default(now())

  field SettingField @relation(fields: [field_id], references: [id], onDelete: Cascade)

  @@index([platform])
  @@map("setting_values")
}
```

Add the back-relation `setting_values SettingValue[]` to `model SettingField`. No other schema change.

---

## Dimensions reference (port exactly from `PLATFORMS`, lines 659–676)

| Platform | id | Devices (device ids) | Themes |
|---|---|---|---|
| Web App | `webapp` | desktop, laptop_h, laptop_v, tablet_h, tablet_v, mobile_h, mobile_v | dark, light |
| TV | `tv` | tv_720p, tv_1080p (×1.5), tv_4k (×3), tv_8k (×6) — `scale` multiplies px defaults | dark focus |
| Android | `android` | phone_v, phone_h, tablet_v, tablet_h | dark, light |
| iOS | `ios` | iphone_v, iphone_h, ipad_v, ipad_h | dark, light |

Device sections are authored once against base tags `desktop/laptop/ipad/mobile` and re-mapped per platform via `from`; TV `scale` multiplies numeric px values (`scaleField`, lines 684–697) so higher resolutions seed with correctly enlarged defaults. Themes apply only to sections tagged `dark`/`light`; untagged sections are theme-agnostic.

### Panes per platform (Type rows)

- **Web App:** 11 base panes — `branding` (Theme Color), `typography`, `layout`, `navigation`, `buttons`, `forms`, `tables`, `cards`, `popup`, `alerts`, `images`.
- **TV:** 11 base (relabelled/re-sectioned via `PANE_OVERRIDES.tv`) **+ 26 extra** (`EXTRA_TABS.tv`): dimensions, search, controls, lists, surfaces, icons, details, playback, progress, recommendations, emptystates, onboarding, accessibility, motion, gestures, assets, customcomponents, tokens, leanback, guidelines, androidtv, tvos, firetv, roku, tizen, webos.
- **Android (Material 3):** 11 base (overridden) **+ 9 extra**: tokens, bottomnav, fab, chips, appbar, tabs, emptystates, onboarding, assets.
- **iOS (HIG):** 11 base (overridden) **+ 7 extra**: tabbar, sidemenu, tokens, collections, emptystates, onboarding, assets.

`PANE_OVERRIDES` (lines 707–996) replace/append/patch a base pane's sections, labels and defaults per platform; `EXTRA_TABS` (lines 999–1226) splice platform-only panes in after a named anchor pane (`after:`). The seed MUST apply overrides and splices exactly as `perDeviceAll` / the build loop does (lines 1280–1307).

---

## Field-type → `setting_fields.input_type` map

Every prototype field constructor maps to one `input_type` string. `options` (JSON) carries choices/min/max/step/unit; `alt_text` carries the prototype hint (3rd/4th constructor arg).

| Prototype ctor | `input_type` | `options` JSON payload |
|---|---|---|
| `C` color | `color` | — |
| `N` number | `number` | `{ unit }` |
| `SL` slider | `slider` | `{ min, max, unit, step }` |
| `SE` select | `select` | `{ choices[] }` |
| `TG` toggle | `toggle` | — (value `"true"`/`"false"`) |
| `TX` text | `text` | — |
| `PW` password | `password` | — |
| `RA` radio | `radio` | `{ choices[] }` |
| `MS` multiselect | `multiselect` | `{ choices[] }` (value = JSON array) |
| `FI` / `{t:'file'}` | `file` | — (value = media id / url) |
| `TA` textarea | `textarea` | — |
| `{t:'fonts'}` | `fonts` | value = JSON `[{type,name,src}]` |
| `{t:'imglist'}` | `imglist` | value = JSON `[{name,w,h,fit}]` |

Approx. field volume in the prototype: color ×542, number ×416, toggle ×234, select ×198, slider ×152, text ×55, radio ×6, textarea ×2, multiselect ×1, plus 12 file, 8 imglist, 1 fonts. Do NOT hand-list these — generate them (below).

---

## Seed generator (schema-driven — approved)

Create `backend/src/modules/template-engine/seed.js` that **imports the prototype's schema definition** (port `BASE_TABS`, `PANE_OVERRIDES`, `EXTRA_TABS`, `PLATFORMS`, the `C/N/SL/…` constructors, `slug`, `scaleField`, `perDeviceAll` build logic into a small ESM module, e.g. `template-engine/schema/index.js`). Then walk it once:

```
for each platform P in PLATFORMS:
  build P's pane list = base panes (with PANE_OVERRIDES[P] applied) + EXTRA_TABS[P] spliced after anchors   // reuse prototype logic
  for each pane T:
    upsert Type   { slug: `${P}.${T.id}`, name: T.label, is_active:true }
    for each section [name, fields, tag] in T.sections:
      upsert Category { slug: `${P}.${T.id}.${slug(name)}${tag?'.'+tag:''}`, name, type_id, is_active:true }
      for each field F (index i):
        upsert SettingField {
          slug: `${P}.${T.id}.${tag?tag+'.':''}${slug(name)}.${slug(F.l)}`,
          field_name: F.l, input_type: <map>, value: String(F.v),
          options: JSON({choices|min|max|step|unit|…}), alt_text: F.h ?? null,
          type_id, category_id, sort: i
        }
```

Rules: **idempotent** — upsert on `slug`; safe to re-run; never duplicate. Apply `scaleField` for TV devices before writing defaults. `is_system: true` semantics via manifest `core:false` (module is uninstallable but its Types/Categories are owned by this module — cascade-clean on uninstall). Emit a summary line (`X types, Y categories, Z fields`). This one script is the single source of truth; the frontend reads the same schema for rendering, so UI and DB never drift.

---

## API (new module `template-engine`)

Base prefix `/api/template-engine`. All routes: `moduleGate('template-engine')` → `authenticate` → `requirePermission('template-engine', <action>)`. Zod-validate every body/query. Every mutation `writeActivityAsync` (PII-safe).

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /schema?platform=` | `view` | Panes→groups→fields tree for a platform (from Types/Categories/SettingFields), merged with saved values — drives the admin UI. |
| `GET /values?platform=&type=` | `view` | Saved values (falls back to field default) for one pane, keyed by field slug. |
| `POST /values` | `edit` | Body `{ platform, type_id, values: [{ field_id|slug, value }] }`. Upsert into `setting_values` (validate each value against its field's `input_type`/`options`; reject unknown fields). Matches the prototype save contract. Invalidate token cache for that platform. |
| `POST /reset` | `edit` | Body `{ platform, type_id }` → delete `setting_values` rows for that pane (restore seed defaults). |
| `GET /tokens?platform=&theme=&device=` | `view` (public-readable variant, see below) | Resolved design tokens — see next section. |

Register the permission module via the manifest `permissions:["template-engine"]` (actions `view`,`edit` auto-registered — never hand-edit seeders). `GET /tokens` also needs an **unauthenticated public read** path so client apps can boot their theme before login; expose it through `optionalAuthenticate` and mark the compiled token output as public (like `app_settings.is_public`), OR mirror it into a public `app_settings` key on save. Prefer `optionalAuthenticate` + a `template_engine.tokens_public` app_setting flag (default true).

---

## Token resolution (the payload clients actually consume)

The prototype computes a template token per field (`f.tok`, line 1319): `{{platform_[theme_][section_]label}}`. `GET /tokens` compiles the saved/default values for a platform (+ optional theme/device) into:

1. **CSS** — `:root{ --{token}: {value}; }` for the requested theme, and `[data-theme="light"]{…}` for the light set, so a client can drop one `<style>`/`.css` and use `var(--…)`.
2. **JSON** — nested `{ pane: { group: { field: value } } }` for native (Android/iOS/TV) clients that don't use CSS.

Resolution rules: value = `setting_values.value` if present else `SettingField.value`; TV numeric px already scaled at seed time; `imglist` fields emit CSS classes (`.thumbnail-image{width;height;object-fit}` — see prototype image preview, lines 1783+); `fonts` fields emit `@font-face`/Google-font `<link>` hints. Cache compiled output in Redis (`te:tokens:{platform}:{theme}`, TTL 600s); invalidate on any `POST /values`/`/reset` for that platform. Never block on cache miss — recompute.

---

## Frontend

Port `template-engine.html` into `frontend/src/app/admin/template-engine/page.tsx`, wrapped in `<ModuleGuard slug="template-engine">`; nav entry comes from the manifest only. Keep the prototype's UX verbatim — platform bar, macOS-style grouped sidebar, per-pane live device previews (phone/TV/browser frames), dark/light toggle, per-pane dirty tracking, footer Save/Reset. Rewire:
- Replace the in-memory `state`/`saved` with `useQuery(GET /schema?platform=)` for load and `useMutation(POST /values)` for Save (per active platform + pane, exactly matching the prototype's per-pane save). Reset → `POST /reset`.
- Preserve `localStorage` only for UI prefs (active platform/pane/theme) — never as the store of record.
- All API calls through `lib/axios.ts`; auth state from `auth.store`.

---

## Steps (phased; each gate is an exit-code check — never self-assess)

### PHASE A — schema + seed
| # | Task | Gate |
|---|---|---|
| A1 | Add `SettingValue` model + `SettingField.setting_values` back-relation to `core.prisma`; migrate | `npx prisma validate` exit 0; `npx prisma migrate dev` clean |
| A2 | Port prototype schema (`BASE_TABS`/`PANE_OVERRIDES`/`EXTRA_TABS`/`PLATFORMS` + `C/N/…`, `slug`, `scaleField`, build loop) into `modules/template-engine/schema/` as ESM | `vitest`: schema builds all 4 platforms; pane counts = webapp 11 / tv 37 / android 20 / ios 18 |
| A3 | `seed.js` generates Types/Categories/SettingFields (idempotent upsert on slug, TV scaling, input_type map) | `vitest`: re-run yields 0 duplicates; spot-check `webapp.buttons.desktop.primary_button.background_color` exists with correct default |

### PHASE B — values API + tokens
| # | Task | Gate |
|---|---|---|
| B1 | `module.json` (`slug:"template-engine"`, `apiPrefix:"/api/template-engine"`, `permissions:["template-engine"]`, nav entry `Template Engine`/`Palette` icon), routes/controller/service/schema; `GET /schema`, `GET /values` | `vitest`: schema tree shape; routes behind gate+authenticate+requirePermission |
| B2 | `POST /values` (per-field validation vs input_type/options, activity log) + `POST /reset` | `vitest`: valid upsert; invalid color/enum rejected 422; reset restores default |
| B3 | `GET /tokens` — CSS + JSON compile, Redis cache + invalidation, public flag via `optionalAuthenticate` | `vitest`: token for changed field reflects saved value; light+dark blocks present; `curl` returns CSS |

### PHASE C — frontend + E2E
| # | Task | Gate |
|---|---|---|
| C1 | Port UI to `admin/template-engine/page.tsx` under `<ModuleGuard>`; wire load/save/reset to API; keep previews | `tsc` strict; RTL: platform switch, dirty→save, reset |
| C2 | Review → E2E (edit a Web App button color → Save → `GET /tokens` shows it; disable→re-enable module leaves no orphaned Types/values) → docs | PASS + Playwright exit 0; disable/enable round-trip clean |

---

## Known Risks

- **Slug length / uniqueness:** deep tokens (e.g. `tv.playback.progress_bar.buffered_color`) are long; keep `slug` `@unique` and index it — never truncate. Collisions surface as seed upsert conflicts → fail loud, don't silently overwrite across platforms.
- **Value volume:** thousands of `setting_fields` rows across 4 platforms. Seed in `createMany`/batched upserts inside a transaction; `GET /schema` must query by `type_id` (one pane) not all fields at once.
- **Theme vs device tags:** a section is tagged with EITHER a theme (`dark`/`light`) OR a device — the prototype never mixes them in one tag slot. Preserve that; don't invent a combined dimension.
- **TV scaling drift:** scaling happens once at seed time. If a client also scales, values double. Document that `/tokens` returns already-scaled px for TV.
- **Public tokens leak:** only the compiled visual tokens may be public — never expose raw `setting_fields`/admin endpoints unauthenticated.
- **Uninstall cleanliness:** uninstalling the module must cascade-remove its Types/Categories/SettingFields (and thus `setting_values`), leaving no orphans (manifest checklist item).
- **Do not fork the schema:** UI and seed MUST import the same schema module. Two copies WILL drift.
