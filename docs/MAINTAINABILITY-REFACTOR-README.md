# Maintainability Refactor

This branch is a safe structural refactor of the Scrabble Class Management System.

## Production safety

1. main remains the production baseline.
2. Existing database tables, RLS policies, storage buckets, certificate artwork, public globals and inline handlers remain supported.
3. Refactoring is incremental and behavior-compatible.
4. Visual redesign is out of scope.
5. Merge into main requires manual regression testing.

## Current architecture

```
js/
  core/
    config.js
    runtime.js
    state.js
  services/
    data-service.js
  teacher/
    attendance-rules.js
  tournament/
    certificate-rules.js
  certificates/
    renderer.js
    storage.js
    generator.js
```

The existing portal entry points remain in place while responsibilities are moved behind stable module boundaries. This avoids a high-risk rewrite of the working application.

## Layer responsibilities

### Core
Shared constants, runtime helpers and the transitional application state registry.

### Services
Supabase data access boundaries. UI code starts consuming service methods rather than owning the initial query set.

### Teacher rules
Pure attendance/date rules separated from DOM rendering.

### Tournament rules
Pure certificate award and certificate-number rules.

### Certificates
Rendering, storage and generation are separated. certificate.js is now a small compatibility facade that preserves the existing window.SCMSCertificates API.

### Responsive CSS
The final mobile-first layer is consolidated in css/responsive.css. Earlier legacy responsive rules remain in their original files until each component is migrated safely.

## Validation

GitHub Actions runs:
1. JavaScript syntax checks
2. Critical certificate/runtime regression tests
3. Local HTML reference validation

## Remaining migration work

The remaining large legacy files require controlled extraction:
1. Teacher modules from javascript.js
2. Parent modules from javascript.js
3. Tournament controller/service boundaries
4. Shared UI components
5. Remaining CSS domain split
6. Additional critical tournament tests
7. Duplicate/dead-code cleanup
8. Full manual regression test across Teacher, Parent, Payments, Attendance, Orders, Tournament and Certificates

The large legacy files must not be deleted until their replacements have been verified against the production baseline.
