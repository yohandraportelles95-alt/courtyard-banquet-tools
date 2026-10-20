# Carrollton Sales Hub

Replaces the daily checklist experience with a home for practical sales tools. The first tools are a gift certificate generator/tracker and an event totals calculator. BT contracts are visibly marked as a future tool pending the account list.

## Run

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

## Release status

The full saved-record workflow requires this server. Copying public/ to GitHub Pages provides the UI and calculator only: API-dependent actions fail closed with a clear connection message. Do not label the certificate tracker as live until the backend is hosted and the original log is imported. No certificate records or private recipient data are bundled with the public code.
