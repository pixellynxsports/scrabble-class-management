# Banting Scrabble Academy — V5 UI Alignment & Table Refinement
Date: 12 November 2026
Source: Premium UI V4 project ZIP

## Purpose
Finalise alignment and consistency where the V4 listing and table header designs were not matching each other. Includes the correction of the cramped Order Management action button.

## What changed
- Standardised desktop table header bands to approximately **62 px** for Orders, Attendance, Students, Payments, Reports, and shared table components.
- Gave headers reliable vertical alignment, padding, rounded upper corners, consistent navy/light surfaces, and predictable sorting-button alignment.
- Fixed the Orders Manage action: replaced an erroneous 42 px icon-only width with a 112 px text-and-chevron control, so its text stays within its rounded border.
- Tuned Orders column padding, quantity/total headings, checkbox alignment, name wrapping, date readability, and horizontal scroll when space is limited.
- Improved consistent table row rhythm, separators, scroll-container corners, and header contrast in both themes.
- On small screens, kept wide data tables horizontally accessible without breaking words into vertical stacks.
- Improved the mobile Orders card layout: full-width customer/student rows and a properly sized full-width Manage control.
- Preserved the three-option icon appearance switch from V4 and all existing function calls.
- Kept print-specific neutral table colours and sizes.

## Files changed relative to V4
- `index.html`: stylesheet link updated to `academy-premium-v5.css?v=20261112.5`.
- `academy-premium-v5.css`: complete V4 stylesheet, refined as described above. Replaces the previous `academy-premium-v4.css` (V4 file is not required after the update).
- `DESIGN_UPDATE_V5.md`: this report.

## Files not modified
No changes to `javascript.js`, `tournament.js`, `certificate.js`, `registration.js`, authentication, Supabase configuration, Edge Functions, SQL, payment calculations, or stored student data. This is a presentation-only update.

## Verification performed
- Chromium-based static layout tests: **94 cases** — 70 for Orders, Attendance, Students, Payments, Reports in light/night at screen widths 320, 390, 760, 768, 1024, 1440 and 1920 px, plus 24 for generated tournament standings, student profile history, and parent tables across 320, 390, 1024, and 1440 px.
- At 1440px, measured the eight representative table headers at 62 px height.
- No page-wide horizontal overflow or Manage button text overflow detected in the static test fixtures.
- Original IDs and inline JavaScript event-handler strings verified against V4.
- ZIP archive integrity check passed.

## Limits
These are static UI preview and code integrity checks, not live authenticated end-to-end tests. Supabase queries, Billplz payments, tournament operations and role-based access still require staging testing before deployment.

## Deployment
Use the full ZIP for a complete project copy, or copy the patch files into the root of your existing V4 project before building/deploying GitHub Pages. The old V4 stylesheet can remain unused; the new index loads V5. Clear/reload cached site assets after publishing.
