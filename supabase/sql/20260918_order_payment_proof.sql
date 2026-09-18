-- Order payment proof workflow
-- Parents submit one receipt per order.
-- Payment stays Unpaid until a teacher verifies the bank transaction.

alter table public.orders
  add column if not exists payment_proof_status text not null default 'Not Submitted'
    check (payment_proof_status in ('Not Submitted','Submitted','Verified','Rejected')),
  add column if not exists payment_receipt_path text,
  add column if not exists payment_receipt_name text,
  add column if not exists payment_receipt_mime_type text,
  add column if not exists payment_receipt_submitted_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid,
  add column if not exists payment_verification_notes text,
  add column if not exists whatsapp_notification_status text not null default 'Not Sent'
    check (whatsapp_notification_status in ('Not Sent','Sent','Failed','Not Configured'));

create index if not exists orders_payment_proof_status_idx
  on public.orders(payment_proof_status);

insert into storage.buckets (id, name, public)
values ('order-payment-receipts', 'order-payment-receipts', false)
on conflict (id) do update set public = false;

-- Parents do not receive direct Storage access.
-- The submit-order-payment-proof and get-order-payment-receipt Edge Functions
-- validate the parent/order relationship and use the server key for Storage.
