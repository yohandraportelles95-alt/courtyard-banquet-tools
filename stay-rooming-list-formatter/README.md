# Stay Rooming List Formatter

Browser-only formatter for Courtyard Dallas Carrollton Stay Staff Import exports. Guest files are processed locally in the browser; the server serves static files only.

Run `node build.cjs` to prepare `dist/` from the packaged application, then `npx wrangler deploy`. The compressed JavaScript bundle is retained in `assets/app.js.gz`; the build restores the exact tested bundle. No dependency installation is needed for the build.

Cloudflare Builds: root `stay-rooming-list-formatter`, build `node build.cjs`, deploy `npx wrangler deploy`. The configuration targets the existing Worker and existing URL.

Room labels use the Stay Room Type Quick Reference dated August 14, 2026 and the legacy guestroom codes in the Amadeus configuration backup dated August 27, 2026. All 16 Stay types are mapped explicitly. Mobility, hearing, tub, roll-in shower and city-view distinctions remain visible. Unknown types are marked as unmapped. Duplicate detection uses the original Stay type.

Legacy families: GENR standard king; VIEW city-view king; QNQN two queens; KSTE king studio suite; QQST two-queen studio suite; ONBT one-bedroom king suite. Stay descriptions govern the actual layout even when the older legacy family name differs.
