Teacher Portal Enhancement Update
Version: 2026-09-17.4

Included
1. Cleaner Home page with a compact Action Required section.
2. Three focused Quick Actions: Take Attendance, Add Student, Orders.
3. Orders now support bulk selection.
4. Bulk Archive Selected for active orders.
5. Bulk Restore Selected for archived orders.
6. Archived orders remain in the database and remain available to teachers.
7. Archived orders are excluded from Parent Portal order data at query level.
8. Added a Supabase RLS safeguard so parents cannot read archived orders.
9. Cache-busted CSS and JavaScript references to 20260917.4.

Supabase step required
Run the SQL file:
supabase/sql/20260917_orders_archive_parent_visibility.sql

This creates a restrictive SELECT policy on public.orders. Teachers keep access to archived orders; parents only receive non-archived orders.

No existing student, attendance, payment, order status, or parent account records are deleted or changed by this update.
