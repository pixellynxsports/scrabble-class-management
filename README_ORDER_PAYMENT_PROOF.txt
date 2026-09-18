ORDER PAYMENT PROOF WORKFLOW

Parent flow
1. Parent opens an unpaid order.
2. Parent scans the Pixel Lynx Sports Enterprise DuitNow QR.
3. Parent selects one bank receipt.
4. Parent clicks Complete Payment.
5. The receipt is stored in the private Supabase Storage bucket.
6. Payment Proof Status becomes Submitted.
7. Payment Status stays Unpaid until the teacher checks the bank transaction.
8. If WhatsApp Cloud API secrets are configured, the receipt is sent to the configured teacher WhatsApp number.
9. Teacher opens the order in Teacher Portal, views the receipt, checks the bank transaction and clicks Confirm Payment.
10. Payment Proof Status becomes Verified and Payment Status becomes Paid.

WhatsApp Cloud API configuration
Set these Supabase Edge Function secrets. Never place values inside javascript.js or the public website.

WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_RECIPIENT_PHONE
WHATSAPP_GRAPH_VERSION

WHATSAPP_RECIPIENT_PHONE should contain the teacher WhatsApp number in international digits only, such as 6012XXXXXXXX.
WHATSAPP_GRAPH_VERSION is optional. The function uses v23.0 when no value is provided. Use the current Graph API version supported by your WhatsApp Cloud API account.

If the WhatsApp secrets are missing, the receipt workflow still works and the order records Not Configured for WhatsApp notification.
If the WhatsApp API rejects the message, the receipt stays safely stored and the order records Failed for WhatsApp notification. Teacher verification remains available.
