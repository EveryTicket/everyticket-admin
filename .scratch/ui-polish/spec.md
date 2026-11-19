# Administration UI fixes: implementation plan

Status: ready-for-agent

## Objective

Resolve the 13 findings from the UI audit below, starting with the two HIGH interaction defects. Deliver the changes in the existing React application, with focused regression coverage and browser evidence. This document is the implementation handoff; it does not indicate that any fixes have shipped.

## Start here

1. Read root `AGENTS.md`, `docs/agents/domain.md`, `GLOSSARY.md`, and any relevant ADRs if present. Use the `better-ui` skill for the affected surfaces and states.
2. Inspect the working tree and current implementations before editing. Paths below identify owners rather than immutable line numbers. Preserve unrelated changes.
3. Read `README.md`, `package.json`, `playwright.config.ts`, and the fixtures in `e2e/record-details.spec.ts` and `e2e/carousel.spec.ts`. Run the existing validation and browser scripts to establish a baseline; record pre-existing failures separately.
4. Reproduce the HIGH findings using a delayed mocked mutation and reduced-motion browser emulation. Continue through the phases in order.

Completion: baseline results and reproductions are recorded, and the implementer understands the active routes and mocked API setup.

## Scope and constraints

- Preserve the brand, Geist typography, density, Lucide icons, existing libraries, and desktop information architecture. Prefer shared fixes over per-screen overrides.
- Keep API methods, endpoints, payload units, permission rules, action availability, session behavior, CSV behavior, and URL-backed filters/pagination intact.
- Money remains integer kobo in requests; percentages remain integer basis points; date entry remains Africa/Lagos. Refund approval and execution remain separate. Recording a Payout records an external transfer rather than initiating one. Fee rules affect future Orders.
- Use mocked authentication and API responses for mutation verification. Production financial actions are outside this work.
- Make localized changes to existing components. No new runtime dependency, backend change, global redesign, or unrelated cleanup is required.
- The earlier maintainability spec's visual-parity constraint belongs to that separate effort. This plan intentionally authorizes the specific UI changes listed here.

## Finding register

| ID | Severity | Tags | Finding and primary owners |
| --- | --- | --- | --- |
| UI-01 | HIGH | interaction | X/Escape dismiss a saving action while Cancel is disabled. `src/features/admin/components.tsx`, `src/features/live/action-form.tsx`, `src/features/live/record-page.tsx`, `src/features/live/records.tsx` |
| UI-02 | HIGH | accessibility, motion | `.modal[open]` overrides the reduced-motion duration rule; dialogs still move for 180ms. `src/features/admin/admin.css` |
| UI-03 | MEDIUM | accessibility, contrast | Muted text is roughly 3.9–4.1:1 against its backgrounds. `src/features/live/live.css`, `src/features/live/overview.css` |
| UI-04 | MEDIUM | accessibility, contrast | Form control boundaries are roughly 1.3:1 against white. `src/features/admin/admin.css`, `src/features/live/live.css`, `src/features/carousel/carousel.css` |
| UI-05 | MEDIUM | accessibility, validation | Action errors are generic and lack field associations and invalid states. `src/features/live/action-form.tsx` |
| UI-06 | MEDIUM | accessibility, touch targets | Text controls have insufficient target height; mobile Sign out measured 16.5px. `src/features/admin/admin.css` |
| UI-07 | MEDIUM | responsive, discoverability | Record actions are off-screen in mobile tables without a scroll cue; the whole panel scrolls horizontally. `src/features/live/records-components.tsx`, `src/features/live/live.css` |
| UI-08 | MEDIUM | navigation, spacing | Mobile navigation takes about 262px vertically and clips its final group. `src/layouts/dashboardLayout.tsx`, `src/features/live/live.css`, `src/features/admin/admin.css` |
| UI-09 | MEDIUM | interaction, content | Confirmations omit record identity/relevant amounts and use generic Confirm text. `src/features/live/record-page.tsx`, `src/features/live/action-form.tsx`, `src/features/live/actions.ts` |
| UI-10 | MEDIUM | forms, units | Fee entry uses one ambiguous label for kobo and basis points. `src/features/live/actions.ts`, `src/features/live/action-form.tsx` |
| UI-11 | MEDIUM | usability, media | Event media URLs render as plain text. `src/features/live/record-detail.tsx` |
| UI-12 | LOW | hierarchy, spacing | Action forms repeat the dialog heading without clear spacing. `src/features/live/action-form.tsx` |
| UI-13 | LOW | surfaces, images | Opaque carousel previews/thumbnails lack an inset outline. `src/features/carousel/carousel.css`, `src/features/carousel/carousel-page.tsx` |

Audit evidence: local Chrome with mocked data at 1440px and 390px; all seven collection/detail resources, login, overview, Jobs & media, reconciliation and 404 were inspected. Validation, pending dismissal, reduced-motion computed styles, and list error/retry/empty states were checked. Physical devices, screen readers, forced colors and 10% animation replay were not verified. Reproduce evidence during implementation; temporary audit artifacts are not a dependency.

## Phase 1: protect saving actions and respect reduced motion

Addresses UI-01 and UI-02.

### Pending dialog lifecycle

- Expose pending state to the owning dialog through a small explicit interface. Review every Modal caller, including carousel removal, so all dismissal paths share the same policy.
- While an action request is pending, keep the dialog mounted, disable X/Cancel/submit, and prevent native Escape cancellation with `event.preventDefault()`. Guard close handlers as well as rendered buttons. Prevent repeat submission while a request is in flight.
- Prevent dismissal without removing the existing native dialog focus containment, accessible title, body-scroll accounting, or `overscroll-behavior: contain`.
- On success, close once and retain the existing toast/cache-refresh flow. On failure, retain the form and entered values, show the error, and re-enable dismissal/retry. Closing the UI must not imply that a submitted server mutation has been canceled.

Acceptance: a deferred mocked request survives X, Cancel and Escape attempts with the dialog visible and exactly one outgoing mutation. Success closes it; failure permits retry with values preserved. Closing a settled dialog restores focus to its opener and restores body scrolling. Carousel removal follows the same rules.

### Reduced motion

- Scope translating dialog entrance animation to `prefers-reduced-motion: no-preference`. Give reduced-motion users an opacity-only fallback. Resolve the selector specificity issue directly rather than relying on a broad duration override.
- Check movement, scale and blur in touched components, including the new mobile navigation. Keep static labels/icons for state feedback and retain the Spinner's existing motion guard.

Acceptance: under `reduce`, opening every affected dialog produces no translating, scaling or animated blur keyframes. Under `no-preference`, normal entrance feedback works. Replay motion at 10% speed using browser tooling or equivalent playback control and record the result.

## Phase 2: improve accessible controls and feedback

Addresses UI-03 through UI-06. Build on Phase 1's pending state.

- Measure rendered foreground/background pairs before choosing replacement colors. Adjust shared muted-text styles to at least 4.5:1 for normal small text; retain existing status meanings. Cover table headings/subtitles, detail labels/IDs, metric descriptions, helper text and errors.
- Give enabled inputs/selects/textareas a persistent boundary of at least 3:1 against the adjacent surface. Cover login, list filters, action forms and carousel upload. Preserve visible focus and disabled-state distinctions. Keep a real border for forced-colors rendering.
- Give shared interactive text controls a target of at least 24 by 24 CSS pixels; aim for 44px height for mobile standalone controls. Scope padding to interactive elements so layout text and table values do not inherit it. Check back links, Sign out and row actions for overlap or clipping.
- Give each action error a stable ID. Set `aria-invalid` on invalid fields and associate errors/helper text with `aria-describedby`. Use actionable field-specific messages, such as a required Reason or a whole non-negative kobo amount. Validate against existing payload constraints rather than inventing business limits. Focus the first invalid field on submission and retain server errors and entered values on failure.

Acceptance: record measured contrast pairs and target dimensions; keyboard focus remains visible; errors identify the correct fields visually and programmatically. A screen-reader check confirms label, invalid state and associated error output. Forced-colors checks retain field boundaries and focus cues. Existing valid action payloads remain unchanged.

## Phase 3: make mobile navigation and records usable

Addresses UI-07 and UI-08. Build on the shared dialog and control changes.

### Navigation

- Keep the desktop sidebar. On mobile, replace the expanded navigation groups with a compact header and a labeled menu button that opens the complete navigation in an accessible dialog/drawer.
- Show the current destination in the compact shell. Include every existing destination and active state; close the menu after navigation. Keep Sign out available.
- Reuse native dialog behavior where practical. Verify keyboard opening, focus placement/containment, Escape dismissal, opener focus restoration, body-scroll restoration, scroll containment, and reduced-motion behavior.

Acceptance: all ten navigation destinations are reachable at 320px and 390px, no group is clipped, and the collapsed navigation stops consuming the audited 262px vertical block. Desktop navigation and detail breadcrumbs retain their behavior.

### Record collections and wide detail tables

- Use stacked record rows on narrow screens, keeping record identity, status and View details visible without horizontal scrolling. Preserve amount/detail and date with readable labels. Keep semantic table relationships on desktop and readable field labels for mobile assistive technology.
- Keep search/filters and pagination outside any horizontally scrolling table container. Preserve URL state, return links, export behavior and loading/error/empty states across all seven resources.
- Keep genuinely wide detail tables, such as payment attempts, in their own scroll containers. Add a visible overflow cue when content exceeds the viewport, and verify keyboard access to horizontal scrolling.

Acceptance: at 320px and 390px every collection exposes its record action without a horizontal gesture; controls stay within the viewport; there is no page-level horizontal overflow. Long names, email addresses, references, currency values and dates remain readable. Desktop retains a table layout. Wide detail tables have a discoverable, usable scroll region.

## Phase 4: clarify confirmations, units and media

Addresses UI-09 through UI-12. Reuse the form validation and dialog lifecycle already implemented.

- Pass record context from the detail page to the confirmation: human-readable identity plus reference/ID, relevant monetary values, and one sentence describing the consequence. Use existing loaded record data. Keep freshness/disabled-action safeguards intact.
- Label the submit button with its action, such as Approve refund, Record transfer or Add fee rule; keep a clear saving label while pending. Make Refund execution versus approval and external Payout recording explicit. Review fieldless actions too.
- On the collection-level Add fee rule form, show the global scope and effective-time consequence. On replacement, show the active rule context. Preserve the backend's existing version/replacement semantics.
- Watch Fee rule mode in the form. Fixed mode labels its integer input as kobo with an example and formatted naira preview; percentage mode labels it as basis points with a percentage preview. For example, 250 means ₦2.50 in fixed mode and 2.5% in percentage mode. Keep payload conversion unchanged. Show an empty/invalid preview state instead of formatting invalid values; preserve the entered number when switching mode and update the interpretation immediately.
- Remove the duplicate form heading when the surrounding dialog supplies the title. Space introductory copy, context, fields and footer consistently. Ensure fieldless confirmations still have meaningful content.
- Render recognized Event media URL fields as descriptive links. Allow HTTP/HTTPS destinations after URL parsing; keep other strings as text. Use safe attributes for links opening new tabs. Use an image preview only for known image media, with meaningful alt text and a fallback link when loading fails; do not infer media type from arbitrary strings.

Acceptance: every action dialog names its target and consequence; monetary actions show relevant amounts; submit labels name the operation. Fixed and percentage fee submissions still send the expected integers and Lagos timestamps. Mode switches update labels/previews correctly. Event media can be opened by keyboard. Repeated titles are gone and spacing works with long content and validation errors.

## Phase 5: finish image surfaces

Addresses UI-13 after the interaction work is complete.

- Apply a 1px inset outline to opaque carousel previews and library thumbnails: `outline: 1px solid oklch(0 0 0 / 0.1)` and `outline-offset: -1px` in light surfaces. If dark surfaces are supported, use pure white at 10% there. Retain existing aspect ratios, object fit and rounded corners.
- Preserve the skill's exception for transparent artwork and logos. Use a conservative documented classification if opacity is unknown; avoid adding upload decoding dependencies just for the outline.

Acceptance: a pale opaque test image has a visible neutral edge in both preview and library without changing dimensions or cropping; transparent artwork does not acquire an unwanted frame.

## Regression coverage and final verification

Extend the existing Playwright suites with behavioral assertions for the changed interactions. Reuse mocked auth/API fixtures and delay mutation responses deterministically. Update existing Confirm-name selectors to the new action labels. Add focused coverage for:

1. Pending dismissal through X, Cancel and Escape; duplicate-submit prevention; success and failure recovery; carousel removal.
2. Reduced-motion opening with no movement keyframes, plus normal-motion behavior.
3. Field-specific errors and accessibility associations; valid payloads and retry preservation.
4. Mobile menu keyboard behavior and route selection; visible collection actions at narrow widths.
5. Fee mode labels/previews and unchanged request units; contextual confirmation content; safe media links.

Use measurements and browser inspection for contrast, spacing, hit areas and image outlines rather than adding tests that simply repeat CSS values. Verify 320px, 390px, 768px and 1440px, plus a zoomed desktop view. Include long-content fixtures and both populated and empty records.

Run `bun run validate` and `bun run test:e2e` using the checked-in configuration. Keep changes to tests focused on this plan. Existing collection/detail lookup, URL navigation, export, authentication and carousel workflows must continue to pass.

Save an implementation verification note at `.scratch/ui-polish/verification.md` with:

- Each UI ID marked fixed, unresolved, or not reproduced, with source locations and evidence. Investigate a non-reproduction rather than silently dropping the finding.
- Commands/results, measured contrast/target sizes, inspected viewports, screenshots for changed desktop/mobile/dialog surfaces, and keyboard/accessibility results.
- Every check that could not run labeled **Not verified**, with the reason; automated accessibility metadata checks do not substitute for screen-reader verification.

Completion: all 13 findings are accounted for, focused regressions and existing checks pass, and both HIGH defects are verified fixed. Report outstanding limitations explicitly. End the implementation handoff with **Block** if either HIGH remains; use **Approve** only for inspected coverage with no remaining HIGH findings.
