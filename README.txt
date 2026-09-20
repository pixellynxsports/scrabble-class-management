SCRABBLE CLASS MANAGEMENT SYSTEM
Supabase + GitHub Pages version

WHAT THIS VERSION DOES
This version stores students, attendance, payments and orders in your Supabase project instead of browser localStorage. The same records appear on every device after signing in.

CURRENT SUPABASE PROJECT
Project URL: https://mzqfpdyjvhpqicbgmvfe.supabase.co
The publishable key is stored in supabase-config.js.
Do not add a Supabase secret key or service role key to this website.

BEFORE FIRST USE
1. Open Supabase SQL Editor.
2. Run supabase/sql/20260918_billplz_payment_requests.sql and the other migration files in supabase/sql/ once. This adds the Commitment Confirmed field used by the Add Student form.
3. Open Supabase Authentication > Users.
4. Create the teacher login user with an email and password.
5. Open the website and sign in with the same email and password.

IMPORTANT SECURITY
The website uses the Supabase publishable key in the browser. This is intended for client-side use.
The database tables use authenticated-user RLS policies. Keep the database password and secret/service-role keys private.

GITHUB PAGES
Upload these files to the same GitHub Pages folder:
- index.html
- style.css
- javascript.js
- supabase-config.js
- data/data.js
The data/data.js file is retained for the original standalone package but the online version reads its live records from Supabase.

ONLINE DATA FLOW
Browser -> Supabase Auth -> Supabase Data API -> PostgreSQL tables

The dashboard refreshes from Supabase after sign-in and after data changes.

CURRENT TABLES
students
attendance
payments
orders
settings

The existing 22 students, 22 payments and 22 orders remain in Supabase from the initial import. Attendance starts at 0 records.

PAYMENT RULES
- Initial student registration creates an RM50 Initial 4-Class Package.
- The initial package covers the first four Present attendance records.
- After four additional uncovered Present records, the Payments page shows Payment Due.
- Recording RM50 stores the four attendance IDs covered by the payment.
- Voiding a payment keeps the payment history and makes the covered attendance available again.

ATTENDANCE RULES
- One record per student per Sunday.
- Status is Present or Absent.
- Present records store the actual class time.
- Archived students do not receive new attendance records.

ORDERS
- Products: Scrabble Set or T Shirt.
- Order status: Pending Order, Pending Payment, Order Done.
- Payment status: Unpaid or Paid.
- Collection status: Not Collected or Collected.
- Orders are archived rather than deleted.

BACKUP
Use Reports > Backup & Export to download the current Supabase data as a JSON backup.


Parent Portal Enhancement: dashboard cards open large detail panels, Action Required package notice, QR order payment view, and FPX-ready class payment view.


CLASS PAYMENT TEST FLOW
-----------------------
The Parent Portal includes a safe front-end test flow for the future FPX class-package payment.
To enable the test control, open the Parent Portal with ?payment_test=1 added to the site URL.
The test control appears only inside the class-package payment screen when the current package is Payment Due.
Simulating payment does not contact a bank, does not move money, and does not write to Supabase. It creates a temporary in-session paid payment so the package moves to the next cycle for testing.
Remove ?payment_test=1 for normal parent use.
