# Courtyard Banquet Print Studio

Open index.html to use the seven studios. Static website: no build, installation, or backend required.

## Approved projects
Sports and Event Coupons retain your original artwork, images, fields, and content. Output is now six cards per Letter sheet (2 columns by 3 rows), followed by matching backs. Card size remains 3.60 by 2.34 inches with 0.28-inch gutters. Back columns, including empty positions, are swapped for long-edge duplex printing. Text is not mirrored. Back print spacing is tightened to keep all original wording inside the cutting boundary. Premium Image and Ink Saver modes are available.

Meal Cards and Reserved Signs are exact, unmodified copies of your files. Use browser Back to return from those tools to the dashboard.

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

The three new studios use temporary text branding because a separate approved logo image was not included. Place the approved image at assets/branding/courtyard-logo.png to enable the shared logo. The original four tools retain their approved branding. Door dimensions follow your stated size; the original DOCX was not supplied.

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
- Meal/reserved originals verified unchanged by SHA-256 hashes. Ten meal types produce five folded tent sheets or two buffet sheets (eight labels on first sheet). Select/Clear All checked.
- Upper faces rotate 180 degrees for meal tents and all four reserved styles.
- No JavaScript errors during the main browser test suite.

Limits: no physical printer registration test; approved standalone logo and door DOCX still pending; not deployed to GitHub. Arbitrarily long text and all possible image files have not been exhaustively tested. Keep coupon text within the original design's available space.
