# Carrollton Sales Hub

Replaces the daily checklist experience with a home for practical sales tools: gift certificates, event totals, and negotiated corporate accounts with 2027 contract generation.

## Negotiated accounts

The negotiated-account module uses the same owner password and opaque session as gift certificates. `hosted/lnr.sql` defines separate private accounts, activity and immutable contract-version tables and a service-role-only SECURITY INVOKER dispatcher. The Edge Function routes `/lnr/accounts` and per-account history/save/generate operations to this dispatcher. Revision checks prevent stale windows overwriting newer changes. Sent and signed statuses require dates; generating a PDF never sends an email.

Historical contract values, worksheet values, and budget proposals remain distinct. Multiple rates or contacts from the same year are retained for review. Signed agreements outrank worksheets. Locally negotiated accounts, centrally managed programs, and accounts needing classification have separate filters. Account data and source documents must never be committed to this public repository.

`public/lnr-template.json` contains a fresh two-page PDF background using only the Courtyard logo and confidentiality footer, plus template layout and standard contract text. It contains no prior customer text, hidden links, signatures, contact details or source metadata. `lnr-pdf.js` generates a downloadable PDF with the 2027 rate, legal company name, contact, room types and availability. All contract-year references are 2027 and no blackout clause is included. Saved versions retain their original data so a subsequent edit does not change an earlier PDF. The legacy local SQLite adapter does not implement negotiated accounts; use the configured hosted frontend for that module.

## Hosted database

The live GitHub Pages frontend connects to the project's `sales-hub-api` Edge Function. Records, counters, password hashes, opaque sessions and audit events live in the nonexposed `sales_hub_private` database schema. The public dispatch function is SECURITY INVOKER and executable only by service_role; anon and authenticated roles cannot call it or access the private schema. The Edge Function checks a random database-backed session on every protected operation. Only login and one-time setup accept unauthenticated requests; login attempts are rate limited. No service-role secret is sent to the browser.

The owner receives a private one-time setup link separately. That token is stored only as a SHA-256 hash in the database, is erased on password setup and is never committed. A password must be at least 16 characters and no more than 72 UTF-8 bytes. Sessions last eight hours, stay in browser sessionStorage and are revoked server-side at sign-out.

Applied migrations are recorded in Supabase's migration history. `hosted/schema.sql` is the immutable baseline; `hosted/dispatch-v2.sql` is the updated dispatch definition after adding the settings corrections JSON column. User-confirmed expiration corrections are private runtime data, applied during import and exposed only to authenticated tracker sessions. Do not overwrite the confirmed dates with conflicting duplicate template copies.

The owner supplied a screenshot of the 2026 worksheet, allowing six organization-level gift entries to be reconciled to five unique numbered 2026 certificates from the supplied documents. After the owner explicitly confirmed the destination, all six log entries and five numbered certificates were imported and verified in the private database. The original log's single redeemed entry was preserved. New certificate issuing is enabled and continues after the highest verified imported number. No contacts, certificate records or redemption data are committed to this repository.

The workbook is an organization-level comp-night log, not a one-row-per-certificate numbered inventory. `legacy_awards` preserves those rows and their redemption state separately. Each row links only certificate numbers actually present in the supplied files. Complimentary-night quantities must never be expanded into invented certificate numbers. The frontend displays the original log and numbered certificates separately and exports either dataset. `hosted/dispatch-v3.sql` adds authenticated legacy-log reads after the private legacy_awards table was created through migration history.

## Local development

Node 24 or newer. No package installation is needed.

Set `SALES_HUB_PASSWORD` to a long, unique password of at least 16 characters. Set `SALES_HUB_DATA_DIR` to a private persistent directory, then run `node server.mjs`.

For local HTTP previews only, also set `SALES_HUB_LOCAL=1`. The server binds to 127.0.0.1:4173 by default; `HOST` and `PORT` can be configured for a hosting environment. Production requires HTTPS, preservation of the original Host header and a persistent volume. Do not deploy this SQLite server on an ephemeral serverless filesystem. Database files and credentials must never be committed or served as static files. Back up the database using SQLite's online backup API or a coordinated checkpoint/backup process, not an uncoordinated copy of a live WAL database.

Run verification with `node --test test/*.test.mjs`.

## Certificate workflow

1. Sign in and import the complete historical XLSX or CSV log. Select the worksheet, header row and column mappings. Review the numbers and redemption statuses before confirming. Nothing is imported if any row conflicts. Missing historical fields remain missing rather than being invented; missing expiration dates display as Needs review.
2. New certificates remain disabled until that import is verified. The server chooses the next sequence for the issue year in an immediate SQLite transaction and records the certificate at the same time. Imported numbers advance the sequence. Voided numbers are never reused.
3. Create a certificate with a recipient and/or organization, benefit, expiration, issuer and terms. Defaults preserve the supplied one-night weekend-stay wording. Internal notes do not print. Draft previews are watermarked and have no certificate number.
4. View an issued certificate to print or save it as PDF. Reprinting never allocates a new number. Redeemed, voided and undated certificates cannot be reprinted as valid certificates.
5. Record the redemption date, staff name and optional reservation confirmation. Duplicate redemptions and redemptions after expiration are rejected. Valid historical redemptions can be entered after the fact. Changes remain in the audit history.
6. Export the log as CSV. Formula-like values are escaped for spreadsheet safety.

Workbook parsing reads cell values only and does not execute formulas, macros or links. Encrypted/oversized files and invalid or duplicate certificate numbers are rejected. Dates are parsed as US month/day/year or ISO dates; numeric Excel dates are supported. The original log has not been imported: file transfer from ChatGPT Library was unavailable during implementation. Do not infer the next number from the example certificates alone.

## Event calculator

Food, catering fees and other nonrental charges: 8.25% tax. Room rental: 6%. Service charge defaults to 25% and is taxable at 8.25%. Applying service charge to rental is optional. Calculations round service and tax lines to cents.

## Verification limits

Local Node tests cover the storage adapter, request handler and hosted Edge handler. Native database tests cover authentication, import rollback, numbering, idempotency, redemption, duplicate-redemption rejection and session revocation. Synthetic database tests run inside rolled-back transactions. Edge deployment was confirmed ACTIVE. Browser QA and a direct runtime HTTP check were unavailable in the authoring session. No certificate records, passwords or private recipient data are bundled with the public code.
