# Scrabble Class Management Architecture

## Frontend layers

### index.html
Page structure, navigation, page containers, and script loading order. Business logic should not be added here unless it is a small UI event binding.

### style.css
Global visual system, responsive layouts, component styling, and mobile UX.

### utils.js
Shared low level helpers used across the application:
* HTML escaping
* Local date formatting
* Sunday calculation
* Supabase error normalization
* Local ID generation

### data-mappers.js
Converts Supabase database rows into the application's internal record shape:
* Students
* Attendance
* Payments
* Orders

### javascript.js
Main application controller. It coordinates:
* Authentication state
* Data loading
* Payment cycle rules
* Attendance
* Student management
* Payments
* Orders
* Reports
* Parent Portal
* Page rendering

The main file is organised with section markers so future changes have a predictable location.

### registration.js
New Registration workflow and registration specific UI.

### parent-login-email.js
Parent login and email related authentication workflow.

## Change rule

When adding a feature:
1. Put reusable generic helpers in utils.js.
2. Put database row conversion in data-mappers.js.
3. Keep business rules in the relevant domain section of javascript.js.
4. Keep page structure in index.html.
5. Keep visual and responsive changes in style.css.
6. Update the relevant cache version whenever a JS or CSS file changes.
7. Preserve the existing attendance date filtering and password/email functionality when modifying unrelated areas.
