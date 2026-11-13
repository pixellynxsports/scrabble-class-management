# Banting Scrabble Academy — Parent Hub V10

## Scope

A complete **Parent Portal visual/navigation redesign** built on top of V9's existing functionality. The UI uses the same midnight-blue / ocean-blue / teal brand direction as the Teacher Portal, deliberately avoiding heavy purple lighting, neon effects and oversized decorative imagery.

## Navigation

- On desktop and larger tablets, a left-hand sidebar presents **Overview, Current Package, Attendance, Payments, Orders, Certificates and Tournaments**.
- On mobile, a compact five-position bottom bar shows Overview, Current Package, Attendance, Payments and More. More opens Orders, Certificates and Tournaments.
- Each choice displays only that screen's content. No more long all-in-one dashboard.
- Archived students instead have **Overview, Attendance, Payments, Orders and Archived Student** so unavailable active-package actions are not shown.
- Multi-child accounts keep the existing child selector; switching children also returns to Overview, presenting the newly selected child's records.

## Page treatments

- **Overview**: student identity and class time, four concise status statistics, current package summary, latest attendance, and contextual payment reminder when applicable.
- **Current Package**: focused four-class progress display, four attended/remaining indicators, current cycle, exact state, last payment, completed-class history and the original payment control only when eligible.
- **Attendance**: three summary statistics and full date/time/status history.
- **Payments**: current status and fee information, recorded payment history, and original Billplz action when eligible.
- **Orders**: overview counters and the full student order list, with the original order detail/payment proof dialog preserved.
- **Certificates**: existing issued certificate thumbnails, View/Download actions, and other achievement records.
- **Tournaments**: existing tournament panel (standings, matches, results and awards) when relevant, otherwise a neutral empty state.
- **Archived Student**: preserved historical views plus the original review request action, with teacher preview remaining read-only.

## Design system

Uses existing Teacher Portal motifs: 232–244px deep-navy sidebar, ocean-blue selected navigation item, understated teal progress indicators, natural spacing, 16–20px card corners, clear contrast and subtle transitions. Mobile content remains a readable one-page-at-a-time layout with a fixed bottom nav. The light theme uses white and soft pearl cards; the night theme uses layered navy surfaces, not pure black.

## Files changed compared with V9

- `index.html` — two asset references for V10 styles and presentation controller.
- `academy-parent-hub-v10.css` — new V10 style and responsive navigation.
- `academy-parent-hub-v10.js` — new *presentation-only* navigation, page markup, and selection UI. It delegates to existing data and action functions.
- `PARENT_HUB_V10_CHANGES.md` — this documentation.

The existing `javascript.js`, `academy-theme.js`, `supabase-config.js`, SQL, payment-related files, tournament logic, order logic and certificate assets are unchanged.

## Local verification

- 84 responsive checks (seven active sections × two themes × six widths: 320, 390, 768, 1024, 1440, 1920 pixels).
- Child switching, mobile More navigation, opening an order detail, archived-student review action display, and teacher-preview payment restrictions checked in a synthetic-data Chromium harness.
- Browser scripts reported no JavaScript errors or page-wide horizontal overflow in those cases.

**Limitations:** Live authentication, Billplz payments, certificate storage URLs, mobile physical-device behaviour and the complete end-to-end parent/teacher lifecycle were not exercised against production. Test on staging first. The example screenshots use synthetic data, not real students.
