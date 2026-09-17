-- Parent Portal order visibility
-- Archived orders remain available to teachers but are hidden from parents.
-- This is a database-level safeguard in addition to the Parent Portal filter.

DROP POLICY IF EXISTS "Parent orders exclude archived" ON public.orders;

CREATE POLICY "Parent orders exclude archived"
ON public.orders
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT COALESCE(archived, false)
  OR public.is_teacher()
);
