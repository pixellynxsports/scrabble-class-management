# Billplz FPX Integration

This version connects the Parent Portal RM50 4-class package payment to Billplz through Supabase Edge Functions.

## Components

- `supabase/functions/create-class-payment/index.ts`
  - Authenticated parent endpoint.
  - Validates the parent-to-student link.
  - Validates that the current 4-class package is complete.
  - Creates one Billplz bill for the next package.
  - Uses `BILLPLZ_SECRET_KEY` only on the server.
  - Uses `payment_requests` to prevent duplicate bills for the same student and cycle.

- `supabase/functions/billplz-callback/index.ts`
  - Public Billplz webhook endpoint.
  - Verifies Billplz X Signature with HMAC-SHA256.
  - Confirms the expected collection and RM50 amount.
  - Records the successful payment in `payments`.
  - Marks the corresponding `payment_requests` row Paid.
  - Safely ignores duplicate callbacks.

- `supabase/sql/20260918_billplz_payment_requests.sql`
  - Creates the server-side payment request tracking table.

## Required Supabase secrets

Already configured in the project:

- `BILLPLZ_SECRET_KEY`
- `BILLPLZ_X_SIGNATURE_KEY`

No secret keys belong in the website files or GitHub repository.

## Required Billplz settings

Collection ID:

`jwwusiot`

Payment method:

Online Banking / FPX

## Edge Function authentication

`create-class-payment` should keep JWT verification enabled because it is called by a signed-in parent.

`billplz-callback` must have Supabase's built-in JWT verification disabled because Billplz does not send a Supabase user JWT. The callback still verifies the Billplz X Signature inside the function before changing any payment data.

## Optional redirect URL

The browser sends its current same-origin Parent Portal URL to `create-class-payment`. The function only accepts a redirect URL with the same origin as the calling page. If the Billplz redirect is returned, the Parent Portal shows a payment-verification notice and refreshes the student's payment status.

## Payment source of truth

The Billplz server callback is the source of truth. The browser redirect is only for the parent-facing return experience.
