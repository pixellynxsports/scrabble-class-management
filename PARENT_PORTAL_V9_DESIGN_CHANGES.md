# Banting Scrabble Academy — Parent Workspace V9

## Purpose
V9 replaces the Parent Portal's repetitive, full-width, top-to-bottom card stack with a more useful and balanced responsive dashboard. Both normal Parent Portal login and teacher **View Parent Portal** use the same `renderParentPortal()` renderer and inherit the redesign.

## Design changes
- Changed the desktop content layout to a 12-column grid. The student hero sits beside a two-by-two KPI board; the current four-class package sits beside recent attendance and payments; orders and certificates form a coordinated bottom pair.
- Reduced redundant content: when one student is linked, the unnecessary one-child selector disappears. Multiple children retain a clearly highlighted, compact selector that works on desktop and mobile.
- Added four compact mobile shortcuts (Package, Attendance, Payments, Orders). Each opens its **existing** detail panel. No new payment, data or security endpoint was created.
- Shortened the homepage preview lists to three recent attendance records, three recent payment records and four recent orders. The full history remains available inside the unchanged detail panels.
- Redesigned the Parent Portal header, richer hero, statistic tile rhythm, package progress, cards, status markers, orders/certificates presentation and empty state.
- Improved archived-student layout; teacher-preview controls and notice are visually separate and fit on smaller phones without overlap.
- Added restrained page entrance, card hover, progress and detail-panel motion with a reduced-motion accessibility fallback.
- Updated responsive behaviour at 1180, 860, 700, 375px and retained long-name wrapping and horizontal safety.

## Files changed relative to V8
- `index.html`: includes `academy-parent-v9.css` and updates `javascript.js` cache version.
- `javascript.js`: presentation-only markup changes in `renderParentPortal` (child selector, semantic layout hooks, mobile shortcut buttons and preview count). Existing data calculations, auth, payment and persistence operations are unchanged.
- `academy-parent-v9.css`: new isolated CSS refinement layer for Parent Portal.
- This changelog is new.

## Verification
- Syntax checks: JavaScript (`node --check`), CSS (`tinycss2` parser), archive integrity.
- Local Chromium static checks with synthetic parent/child, attendance/payment/order records at 320, 390, 768, 1024, 1440 and 1920px in light and dark modes.
- All 12 viewport/theme cases had no page-level horizontal overflow or uncaught browser errors in those tests.
- Checked opening an existing Attendance detail panel, closing it, switching children, and teacher-preview and archived-student layouts.

## Scope and caution
The redesign is **not deployed** to GitHub. Synthetic browser checks do **not** verify authenticated Supabase access, Billplz payment completion, certificate storage URLs, or real tournament states. Deploy to staging and test those workflows before replacing the live version.

## Update options
- Full V9 archive: complete project; use when handing off to another developer or ChatGPT account.
- V8-to-V9 patch: overwrite the three changed project files in a **V8** codebase only; do not apply it to an older V5/V6/V7 codebase.
