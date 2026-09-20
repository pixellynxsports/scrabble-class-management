ORDER PAYMENT PROOF WORKFLOW

Final workflow
1. Parent pays by DuitNow QR.
2. Parent selects one JPG, PNG, WEBP or PDF receipt up to 10 MB.
3. Parent clicks Complete Payment.
4. Payment display becomes Awaiting Confirmation.
5. Payment proof becomes Submitted.
6. A secure email notification is sent to the teacher when Resend is configured.
7. Teacher reviews the receipt and bank transaction.
8. Confirm Payment sets Payment to Paid, Proof to Verified and Order Status to Processing.
9. Reject Proof sets Payment to Unpaid, Proof to Rejected and Order Status to Pending Payment.
10. A rejected order accepts a new receipt submission.
11. Paid and Awaiting Confirmation payment states are protected from direct payment status editing.

Teacher dashboard
The order dashboard shows payment, proof, order and collection states separately, with a focused receipt review area and status summary cards.

Email notification
The receipt function uses Resend when RESEND_API_KEY is configured. The default teacher recipient is pixellynxsports@gmail.com and the default test sender is onboarding@resend.dev. Optional environment variables PAYMENT_NOTIFICATION_EMAIL and PAYMENT_NOTIFICATION_FROM override the defaults. Email delivery failure does not block receipt submission.
