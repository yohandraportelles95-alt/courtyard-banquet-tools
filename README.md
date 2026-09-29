# Version 5 — Front Desk additions

Open the top-level index.html for all nine studios. Upload this folder’s contents to your GitHub Pages repository root. No build or external dependencies are required.

## Elite Member Cards
Exact approved Silver, Gold, Platinum, Titanium and Ambassador PNGs, unchanged at 3.5 × 1.75 inches (300 dpi). Original source PDFs also included in assets/elite. Enter 0–100 per tier. Ten cards per Letter sheet, with external cut marks and 0.25-inch gutters. Front/back pages alternate; back columns swap, including empty slots, for long-edge duplex. Print all pages at 100%, Letter portrait, no margins or headers/footers, backgrounds on, flip on long edge. Save PDF uses the browser print dialog. Test one physical sheet to check your printer’s registration.

## Guest Care / Service Recovery Cards
Single-sided 7 × 5-inch cards, two per Letter sheet. Apology and Thank You modes, guest name, optional room, all requested issue categories, short personal detail, editable recovery offer, optional staff/date, and quantities 1–100. Bonus Bonvoy Points becomes available only after staff confirms the property can award points. No gift is available for a simple thank-you. Wording is custom hospitality copy, not an official Marriott brand standard. Inputs remain in the current browser tab; no storage or network submission.

## Version 5 verification
Microsoft Edge: all new selectors, points eligibility toggle, mixed-tier duplex mapping including partial sheets, empty and invalid quantities, long text fitting, nine dashboard links, and loaded images checked. Browser-generated PDFs verified as Letter: 11 Elite cards produced four correctly paired pages; two Guest Care cards produced one page. Print previews visually inspected. All existing tools/assets and approved Elite source files verified byte-for-byte unchanged. Dashboard and README are the only edited original files. The original nested older site copy is retained unchanged; use the top-level dashboard.

---

# Courtyard Banquet Print Studio — Version 4

Open index.html to use the seven studios. Static website: no build, installation, or backend required.

## Approved projects
Sports and Event Coupons retain your original artwork, images, fields, and content. Output is now six cards per Letter sheet (2 columns by 3 rows), followed by matching backs. Card size remains 3.60 by 2.34 inches with 0.28-inch gutters. Back columns, including empty positions, are swapped for long-edge duplex printing. Text is not mirrored. Back print spacing is tightened to keep all original wording inside the cutting boundary. Premium Image and Ink Saver modes are available.

Meal Cards and Reserved Signs retain their approved layouts, with your supplied logo and Premium / Ink Saver controls added. Buffet names are enlarged from 18px to 29px and descriptions from 6px to 11px. Buffet card size remains 3.5 by 2 inches; eight fit per Letter sheet. Use browser Back to return from those original tools to the dashboard.

## Double-sided coupon printing
1. Enter information and quantities; choose Print / Save PDF.
2. Select US Letter, portrait, 100% / Actual size, and two-sided / flip on long edge.
3. Turn off browser headers and footers. Enable background graphics. Do not use Fit, booklet mode, or multiple pages per sheet.
4. Keep generated page order: front 1, back 1, front 2, back 2.
5. When printing a saved PDF, use the same settings.
6. Cut along the marks outside the card edges.

PDF layouts were verified in Microsoft Edge. Physical printers can introduce registration offsets; test one duplex sheet on your hotel printer before printing a full cardstock batch.

## New studios
Door Signs: 7.2 by 7.5-inch finished sign centered on Letter, cutting marks, four styles, local logo upload.
Today's Events: A4 portrait, date, event/location rows, add/delete/reorder, automatic spacing.
Bar Signs: Letter portrait, three styles, categories, descriptions, optional prices, logo upload, add/delete/reorder.

Uploaded JPG/PNG logos stay in the browser tab and disappear on refresh or close. They are not sent to a server.

All seven tools and the dashboard use the supplied transparent Courtyard logo from assets/branding/courtyard-logo.webp. The original WebP file is copied without modification. Wedding door and bar signs feature coordinated floral details drawn from the approved reserved-sign artwork. All tools offer Premium and Ink Saver printing. Door dimensions follow your stated size; the original DOCX was not supplied.

## GitHub Pages deployment
1. Extract the ZIP and upload the contents of courtyard-banquet-print-studio to a GitHub repository, with index.html at the root.
2. In Settings > Pages, choose Deploy from a branch.
3. Select main and /(root), then Save.
4. Open the Pages link GitHub provides after deployment.

All page and image paths are relative. The site files become public when hosted; logos chosen inside the studios are never uploaded by this site.

## Verification
- Both coupon tools tested with quantities 1, 5, 6, 7, and 13. Six slots per page, paired pages, and correct partial-sheet back mapping.
- Identical front/back grid geometry and 3.60 by 2.34-inch card measurements.
- Six-card and five-card PDF pairs visually inspected; all default back text fits inside the cut boundary.
- All coupon selector options exercised, including six sports, event styles, breakfast/drink entitlements, and image modes.
- New studios tested for text edits, styles, Update, PNG upload/removal, add/delete/reorder, price toggle and branding toggle.
- Door boundary measured at 7.2 by 7.5 inches.
- Marquee and bar PDFs remain one page with twelve entries; A4 and Letter sizes confirmed.
- Meal/reserved layouts retained with the Version 3 logo, print-mode and buffet-text updates. All ten buffet names/descriptions checked for clipping within unchanged card boundaries. Ten meal types produce five folded tent sheets or two buffet sheets (eight labels on first sheet). Select/Clear All checked.
- Upper faces rotate 180 degrees for meal tents and all four reserved styles.
- No JavaScript errors during the main browser test suite.

Limits: no physical printer registration test; door DOCX was not supplied; not deployed to GitHub. Arbitrarily long text and all possible image files have not been exhaustively tested. Keep coupon text within the original design's available space.

## Print correction, version 2
Fixed browser shrink-to-fit caused by transformed coupon artwork. Verified actual PDF transformation matrices on front/back pages for full and partial sheets: scale is exactly 72/96 points per CSS pixel, preserving 3.60 by 2.34-inch cards. Use this version in place of the first ZIP.


## Version 3 proofing
Wedding bar, door and reserved signs exported and visually reviewed in Premium and Ink Saver. Prices on/off checked. Logo transparency confirmed. All ten enlarged buffet labels fit their original card sizes. Coupon actual-PDF scaling and duplex layout rechecked after branding changes.

## Version 4
Removed background panels behind the Courtyard logo, including Social, VIP and the homepage. Refined all bar menus with classic serif headings and italic descriptions. Verified transparent logo backgrounds across sign styles and checked all three bar layouts.
