# Safe maintainability refactor

This branch is isolated from `main`. Do not merge until regression tests and a manual review are complete.

## Baseline and compatibility
- Keep the current `index.html` script loading order, public global functions and HTML inline handlers working.
- Preserve all Supabase table names, storage buckets, policies and existing SQL migrations.
- Preserve teacher, parent, tournament, certificate, attendance, payment, order, registration and reporting behaviour.
- Do not change approved certificate artwork, certificate positions or published certificate paths.
- Avoid adding a build requirement until the current static GitHub Pages deployment is covered by tests.

## Migration sequence
1. Capture baseline behaviour and establish automated source checks.
2. Introduce small, dependency-free shared helpers without replacing existing implementations.
3. Extract pure tournament and certificate calculations; compare old and new outputs using fixtures.
4. Extract Supabase service functions while retaining the existing UI entry points.
5. Consolidate duplicate CSS rules in small batches, with desktop, tablet and phone screenshot comparisons.
6. Split remaining UI modules only after their public interfaces are covered by tests.
7. Run complete teacher and parent workflow regression tests and check RLS with parent/teacher test accounts.
8. Review the branch diff and merge into `main` only after explicit approval.

## Release gates
- No unapproved visual changes.
- No new branches beyond this refactor branch.
- No schema or RLS changes without a separate review.
- No certificate regeneration against real student records during testing.
- Every extracted module must have a focused regression test.
- Keep a rollback path using the pre-merge `main` commit.

## Critical manual scenarios
- Teacher login, student selection, attendance, payment, orders and reports.
- Parent login, linked-child access, achievements and certificate gallery.
- Tournament create, seed, start, score, complete a round, add a round, complete and reopen.
- Review every certificate, approve the template, generate, retry and view/download.
- Mobile at 375px, 430px, 768px and desktop at 1280px.
