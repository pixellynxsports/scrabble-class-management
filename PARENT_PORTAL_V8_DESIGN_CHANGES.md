# Banting Scrabble Academy — Parent Portal V8 UI Redesign

Date: 12 November 2026  
Base: `Banting_Scrabble_Academy_Students_UI_V7_FULL.zip`

## Scope

The Parent Portal redesign is shared by both entry points:

1. A parent signs into their Parent Portal directly.
2. A teacher selects **View Parent Portal** for a student from the Teacher Portal.

Both entry points use the same `#parentPortal` HTML and the same `renderParentPortal()` code. Teacher Preview keeps its own banner, a return-to-teacher control, and read-only actions.

## Changes

- A new scoped stylesheet (`academy-parent-v8.css`) provides a cohesive, professionally restrained light and night theme for the full parent interface without restyling other teacher pages.
- Reworked parent header: clearer hierarchy, consistent Auto/Light/Night icon switch, Online status, and sign-out/back control spacing.
- Improved multi-child selection buttons, selected and hover states, and long-name handling. A single linked child now displays **Student overview** rather than an unnecessary “Select a child” instruction.
- Refined student hero banner with richer ocean/teal gradient, balanced name, ID, class-time, and school label.
- Resized four student metric cards with accent cues and readable secondary text.
- Reordered the **Certificates** panel after the primary dashboard information (class package, attendance, payments and orders). The no-certificate state is compact rather than a large empty panel; its description spans its own readable line on phones.
- Updated class package progress, present/absent/payment status badges, date rows, clickable card affordances and button focus states.
- Aligned Attendance History and Payment History cards to a common top edge; improved order-list wrapping and row rhythm.
- Styled Parent Portal detail dialogs for package progress, attendance, payments, orders and payment flow in both themes. On phones, detail summary cards use a two-column grid.
- Refined certificate library and certificate cards, preserving light certificate image backgrounds for legibility.
- Styled live/completed tournament cards, tables, overview tabs, progress bars, podium results, and awards using the same theme tokens.
- Improved archived student banner, request-review panel, historical metrics and read-only note in both themes.
- In Teacher Preview, removed the redundant second **Back to Teacher Portal** button from the notice (the main header control remains). Archived-student review requests now show a disabled **Preview Only** control for teachers; normal parents still see the usual action.
- Added subtle transitions for selection, hover, progress and elevation, with `prefers-reduced-motion` support. Print rules preserve light print surfaces.

## Modified files relative to V7

- **Added** `academy-parent-v8.css` — Parent Portal presentation styles.
- **Modified** `index.html` — loads the V8 stylesheet.
- **Modified** `javascript.js` — Parent Portal presentation only: reorders the certificate section, shows a more appropriate one-child heading, and disables the archived review-action control in teacher preview. No Supabase, Billplz, payment calculation, order processing, data mapping or tournament scoring logic was changed.
- **Added** this changelog.

## Local test coverage (synthetic data)

- Screen widths: 320, 390, 768, 1024, and 1440 pixels in Light and Night modes for the main Parent Portal.
- Separate teacher preview and archived parent states at multiple widths.
- Student switching, order/attendance/payment detail open and close, and empty certificate library navigation.
- Teacher preview header/notice visibility and read-only payment affordance.
- No document-level horizontal overflow found in tested main states; detail modal checked at phone and desktop sizes.
- Browser JavaScript syntax check passed.

## Deployment caveat

The ZIP is a local redesign; it was not deployed to GitHub Pages and was not exercised against real authenticated sessions, Supabase records, certificate storage, Billplz payments or live tournaments. Test on a staging deployment before replacing your production website. The patch ZIP is for V7 only, and should not be applied on an older version.
