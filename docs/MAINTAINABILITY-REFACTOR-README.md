# Maintainability Refactor

This branch is a safe structural refactor of the Scrabble Class Management System.

## Safety rules

1. main remains the production baseline.
2. Existing database tables, RLS policies, storage buckets, certificate artwork, public globals and inline handlers are preserved.
3. Refactoring is incremental. Each stage must remain behavior-compatible.
4. Visual redesign is out of scope for this branch.
5. Tournament, parent portal, payments, attendance, registration and certificate workflows must remain intact.

## Current structure

The legacy portal entry points remain intact while shared runtime helpers are introduced under js/core/. This allows modules to migrate one helper at a time without changing the public application surface.

## Validation

GitHub Actions validates JavaScript syntax on pushes and pull requests. Manual regression testing remains required before merging into main.

## Migration sequence

1. Shared runtime helpers
2. Pure business-rule helpers
3. Supabase/data service boundaries
4. Tournament module separation
5. Certificate module separation
6. CSS organization
7. Full teacher and parent regression testing
8. Review branch diff and merge only after approval
