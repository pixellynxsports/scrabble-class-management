# Banting Scrabble Academy — UI/UX Redesign (12 November 2026)

This release applies a comprehensive visual/layout refresh to the class management website while keeping its existing backend and business logic in place.

## What's new

- A coordinated light palette (white, mist blue, ocean blue, and teal) and night palette (midnight blue, slate-blue surfaces, refined accents). **Night mode is not pure black.**
- An appearance selector on the teacher workspace, parent portal, login and password-change screens. Choose **Auto / Light / Night**. Auto uses the user's device-local clock and switches to night mode from **19:00 to 06:59** and light mode from **07:00 to 18:59**. Manually selected modes are saved in the browser (when local storage is available).
- A redesigned teacher sidebar with line icons, active-page indicator and better spacing; compact horizontally scrollable navigation on phones.
- Refined dashboard hero and class date panel, animated KPI cards, improved card hierarchy, consistent status colours and modern buttons.
- Consistent forms, attendance controls, tables, cards, modals, reports, tournament styling, payments, orders and parent portal surfaces in both themes.
- Improved typography, spacing, rounded surfaces, shadows, responsive columns and subtle transitions.
- Reduced-motion support and keyboard-visible focus styles.
- Light colours preserved for printed content/certificate outputs.

## Exactly which files were touched

- `index.html`: linked new style/script assets, added appearance selectors and presentation-only SVG icons. Existing element IDs, inline handlers, page sections and original script imports remain unchanged.
- **New:** `academy-theme.js`: appearance preference and local-clock theme switching.
- **New:** `academy-night-coverage.css`: dark-mode colour coverage for the existing legacy CSS selectors; screen-only so print output retains original styling.
- **New:** `academy-design.css`: design tokens, layout improvements, responsive rules, animations and refinements.
- **New:** this note.

The original `style.css`, `tournament.css`, all existing application JavaScript, Supabase configuration, SQL migrations, edge functions, images and certificate assets are unchanged.

## Deployment

Copy the full updated folder (or merge the new files plus the updated `index.html`) into the **existing** GitHub Pages repository and publish normally. Preserve its original Supabase project and environment/configuration. No database migration is required for this presentation-only release.

Do not remove `academy-theme.js`, `academy-night-coverage.css`, or `academy-design.css` after deploying: `index.html` now references them. A browser hard refresh may be needed for cached files.

## Testing and caution

The ZIP was checked for JavaScript syntax and CSS parsing. Layout/theme previews were rendered in a local browser at phone, tablet and desktop widths (390, 650, 768, 1024 and 1440 px) with no document-level horizontal overflow in the static views tested. Teacher dashboard, login, reports and payments were inspected in both colour schemes.

**Not tested end-to-end:** production login, live Supabase data, actual transactions, Billplz callbacks, authorised data mutations, live certificate export and all JS-generated states. These require an authenticated staging environment; they should be regression-tested before publishing to production. The previews used the existing HTML with zero/placeholder records, not live student data.

## Scope guardrail

This is **presentation only**, not a feature upgrade. No attendance, payment-cycle, tournament-scoring, API, permission, student-record, order or authentication logic has been intentionally modified.
