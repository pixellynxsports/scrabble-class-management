ORDER PAYMENT PROOF WORKFLOW

Final workflow
1. Parent pays by DuitNow QR.
2. Parent selects one JPG, PNG, WEBP or PDF receipt up to 10 MB.
3. Parent clicks Complete Payment.
4. Payment display becomes Awaiting Confirmation.
5. Payment proof becomes Submitted.
6. Teacher reviews the receipt and bank transaction.
7. Confirm Payment sets Payment to Paid, Proof to Verified and Order Status to Processing.
8. Reject Proof sets Payment to Unpaid, Proof to Rejected and Order Status to Pending Payment.
9. A rejected order accepts a new receipt submission.
10. Paid and Awaiting Confirmation payment states are protected from direct payment status editing.

Teacher dashboard
The order dashboard shows payment, proof, order and collection states separately, with a focused receipt review area and status summary cards.

WhatsApp
The receipt function attempts WhatsApp Cloud API delivery when the required Supabase secrets are configured. Receipt storage and payment verification do not depend on WhatsApp delivery.
