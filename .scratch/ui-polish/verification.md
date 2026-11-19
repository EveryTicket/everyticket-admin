# UI polish implementation verification

Inspection date: 2026-11-19. Chromium with mocked administrator authentication and API responses; no production mutations.

## Baseline and reproduction

- Original `bun run test:e2e`: **32 passed** before implementation.
- Original `bun run validate`, replayed against an untouched `git archive HEAD` in `/private/tmp/ui-polish-baseline`: **passed**, including 75 unit tests, both TypeScript projects, lint and production build. The initial workspace validation overlapped the addition of regression tests and caught errors in those new tests; these were implementation harness errors, not pre-existing application failures.
- Ran the two HIGH regressions against that untouched source with a separate local server on port 4174. Both failed for the expected reasons: X removed the dialog during the deferred mutation (UI-01), and reduced-motion animation keyframes contained `translate: 0px 8px` (UI-02). The isolated harness used a separate dependency cache and an explicit filesystem allow-list for the shared installed dependencies; these are temporary harness settings, not repository changes.
- Intermediate browser runs caught and corrected opener focus restoration, ambiguous selectors after replacing Confirm labels, an expired animation inspection window, and a later-loaded carousel textarea border override. Native dialog tabbing can visit browser chrome, reported by Chromium as body focus; the containment assertion permits that while rejecting focus on background application controls.
- Some local server starts were rejected with sandbox `EPERM`; reruns with local-server permission succeeded. The initial isolated baseline also needed its dependency cache separated from the workspace cache.

## Findings

| ID | Result | Sources | Before → after / evidence |
| --- | --- | --- | --- |
| UI-01 | **Fixed** | `src/features/admin/components.tsx:46`, `src/features/live/action-form.tsx:10`, `src/features/live/record-page.tsx:133`, `src/features/live/records.tsx:111`, `src/features/carousel/carousel-page.tsx:298` | Explicit pending interface guards X, native Escape and Cancel. A synchronous submission guard prevents duplicates. Dialogs remain mounted during mutation and cache refresh; delayed failures preserve values and allow retry. Success closes once; native dialog cleanup restores focus and body scrolling. Carousel removal uses the same policy and a synchronous guard. Deferred mutation, duplicate submission, recovery, success toast and focus regressions cover this. |
| UI-02 | **Fixed** | `src/features/admin/admin.css:1512` | Translating entrance is scoped to no-preference. Reduce gets opacity-only keyframes. Both preference paths inspected; translating/scaling/filter keyframes are absent under reduce. Normal entrance replayed at 10% speed using Web Animations playback control. See [motion sample](evidence/motion-midpoint.png). |
| UI-03 | **Fixed** | `src/features/live/live.css:10`, `src/features/live/overview.css:56`, `src/features/admin/admin.css:20` | Shared muted text changed from `#84798b` (3.91–4.13:1) to `#685e70` (5.81–6.13:1). Covers collection headings/subtitles, detail labels/IDs, metric descriptions and helpers. |
| UI-04 | **Fixed** | `src/features/admin/admin.css:2815`, `src/features/live/live.css:26`, `src/features/carousel/carousel.css:20` | Enabled controls retain real borders at `#87788f`, 4.11:1 against white. Login, filters, action inputs and upload controls inspected. Focus outlines and forced-colors boundaries remain visible; [forced colors](evidence/forced-colors.png). |
| UI-05 | **Fixed** | `src/features/live/action-form.tsx:70` | Stable field/error/helper IDs, actionable errors, aria-invalid and aria-describedby, first-error focus, integer/non-negative amount validation, retained server errors and values. Programmatic associations and keyboard focus verified; actual screen-reader output **Not verified**. [Validation](evidence/fee-validation.png). |
| UI-06 | **Fixed** | `src/features/admin/admin.css:2824`, `src/features/live/live.css:175` | Interactive text controls have at least 24px targets, with 44px mobile Sign out, back links and record actions. Measured dimensions below. |
| UI-07 | **Fixed** | `src/features/live/records-components.tsx:71`, `src/features/live/live.css:188`, `src/features/live/record-detail.tsx:126` | All seven collections use stacked rows below 650px, with explicit mobile amount/date labels and visible View details. Filters and pagination remain outside scrolling content. Desktop retains semantic tables. Payment attempts have their own named keyboard-scrollable region and a cue only when overflowing. [320px](evidence/collection-320.png), [wide detail](evidence/detail-mobile.png). |
| UI-08 | **Fixed** | `src/layouts/dashboardLayout.tsx:132`, `src/features/live/live.css:142` | Desktop sidebar retained; compact mobile header is 65px high at 320/390px. Labeled Menu opens native dialog navigation with all ten destinations and active state; navigation closes it. Keyboard opening, tab containment, Escape, focus restoration and scroll restoration checked. [Menu](evidence/mobile-menu.png). |
| UI-09 | **Fixed** | `src/features/live/actions.ts:172`, `src/features/live/record-page.tsx:143`, `src/features/live/action-form.tsx:168` | Confirmation shows identity, ID/reference, loaded amounts, and consequence; buttons name the operation. Refund approval/execution and external transfer recording have distinct copy. Fee replacement distinguishes the selected historical version from the global active rule, read through the existing active-rule endpoint when opening the dialog. [Confirmation](evidence/context-dialog.png). |
| UI-10 | **Fixed** | `src/features/live/action-form.tsx:28` | Mode controls explicit kobo/basis-point labels, examples and previews. Switching retains the integer. Empty/invalid values show an instructional state. Browser requests still send 250 integer kobo or basis points and `2099-11-11T09:30:00.000Z` for 10:30 Lagos. Fee mode defaults are scoped to fee forms so unrelated payloads gain no fields. |
| UI-11 | **Fixed** | `src/features/live/record-detail.tsx:96`, `src/features/live/record-detail.tsx:235` | Recognized Event media fields become descriptive HTTP/HTTPS links with noopener/noreferrer. Invalid/non-web schemes remain text. Previews require an explicit known image MIME type; failed previews retain their link. Keyboard links, unsafe-scheme rejection, video link and image-error fallback tested. |
| UI-12 | **Fixed** | `src/features/live/action-form.tsx:59`, `src/features/admin/admin.css:2829` | Duplicate form heading removed. Intro, contextual panel, fields, errors and footer have consistent spacing; fieldless confirmations retain meaningful content. [Dialog](evidence/context-dialog.png). |
| UI-13 | **Fixed** | `src/features/carousel/carousel.css:79`, `src/features/carousel/carousel-page.tsx:168` | Opaque JPEG previews/thumbnails have the exact 1px inset black-at-10% outline. Conservative classification: JPEG guarantees opacity; PNG/WebP alpha is unknown and remains unframed, preserving transparent artwork. No decoding dependency. Pale JPEG and PNG inspected together; dimensions, containment and corner radius retained. [Image surfaces](evidence/carousel-surfaces.png). |

## Measurements and visual inspection

Rendered browser samples (sRGB WCAG relative luminance):

| Surface | Foreground / boundary | Background | Contrast |
| --- | --- | --- | --- |
| Original muted text | `#84798b` | white / `#faf8fb` | 4.13 / 3.91:1 |
| Updated muted text, detail labels, descriptions/helpers | `#685e70` | white / `#faf8fb` | 6.13 / 5.81:1 |
| Enabled input boundary | `#87788f` | white | 4.11:1 |
| Server error | `#85334b` | `#fcebf0` | 7.11:1 |
| Retained ordinary table values | `#7a6d83` | white | 4.84:1 |

Browser computed collection heading pair: `rgb(104, 94, 112)` / `rgb(250, 248, 251)`. Search input boundary/background: `rgb(135, 120, 143)` / white. Shared control boundaries also inspected visually on login/action forms and carousel, including its later-loaded stylesheet.

Measured browser target rectangles: Sign out **42.91 × 44px** and View details **62.64 × 44px** at both 320px and 390px. At 768px and 1440px they are **42.91 × 24px** and **62.64 × 24px** respectively. Shared back links use the same 24/44px minimum-height rule. The compact header measures 65px at phone widths.

Inspected screenshots cover 320px, 390px, 768px and 1440px, desktop dialogs, validation, forced colors, pale/transparent carousel surfaces, long unbroken record references/email addresses, and wide detail tables. At 320/390px, each collection exposes View details inside the viewport without horizontal scrolling. Populated and empty records, list loading/error/retry, URL filters/pagination, return links, CSV output and refreshed action availability remain covered by the original suite.

Zoom uses a 720 CSS-pixel viewport and 2x device scale to model a 1440px desktop at 200%; [zoom layout](evidence/zoom-desktop.png). This is layout emulation, not a physical browser zoom-control test.

## Limits

- **Not verified:** actual VoiceOver/NVDA or other screen-reader announcement output; this environment's browser automation verifies labels, invalid/error associations and focus, not assistive-technology speech.
- **Not verified:** physical touch devices and other browser engines; coverage is Chromium viewport emulation.
- **Not verified:** actual operating-system forced-colors display or native browser zoom controls. Chromium forced-colors emulation and equivalent zoom layout were inspected.
- **Not verified:** dark-surface image outlines; these image surfaces currently use light backgrounds. PNG/WebP opacity remains intentionally unclassified without metadata.

## Final checks

- `bun run validate`: **passed** — 75 unit tests, application/tooling TypeScript, lint and production build.
- `bun run test:e2e`: **45 passed**, using the checked-in configuration (2.7 minutes). Original 32 scenarios plus 13 focused browser scenarios.
- After removing a duplicate organizer line found in final screenshot review, `bun run test:e2e --grep 'action feedback|contextual media|rendered contrast'`: **8 passed**, refreshing the affected confirmation evidence.
- `git diff --check`: **passed**.
- Phone/desktop screenshot review confirmed readable rows and forms, persistent boundaries, complete drawer navigation, keyboard focus, image outlines and unchanged image fit. The desktop zoom emulation retains table layout without horizontal page overflow. Slow normal motion completed at 0.1 playback rate and returned to a settled untranslated dialog; reduce exposes only opacity keyframes.
- Screenshots: [desktop collection](evidence/collection-1440.png), [tablet](evidence/collection-768.png), [390px](evidence/collection-390.png), [320px](evidence/collection-320.png), [mobile menu](evidence/mobile-menu.png), [mobile login](evidence/login-390.png), [desktop login](evidence/login-1440.png), [long record](evidence/long-mobile.png), [detail scroll region](evidence/detail-mobile.png), [dialog](evidence/context-dialog.png), [validation](evidence/fee-validation.png), [carousel](evidence/carousel-surfaces.png), [forced colors](evidence/forced-colors.png), [zoom](evidence/zoom-desktop.png), [motion sample](evidence/motion-midpoint.png).

**Approve** — all 13 findings addressed; both HIGH defects reproduced against the baseline and verified fixed. Approval covers the inspected Chromium behavior and surfaces; the explicit Not verified checks above remain outside that coverage.
