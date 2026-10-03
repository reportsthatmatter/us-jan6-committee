# Final Report of the January 6th Select Committee (H. Rept. 117-663)

Final Report of the Select Committee to Investigate the January 6th Attack on the United States Capitol, U.S. House of Representatives, 117th Congress, House Report 117-663, dated 22 December 2022 and printed by the U.S. Government Publishing Office (845 pages). Served at https://reportsthatmatter.org/reports/us-jan6-committee.

## Scope: the whole printed report

The report is one printed volume: the committee and staff lists, the Letter of Transmittal, three forewords (the Speaker, the Chairman, the Vice Chair), the contents, the Executive Summary, chapters 1-8 (the Narrative), the Recommendations and Appendices 1-4, with 4,287 endnotes printed at the end of each part. All of it is one unit, `us-jan6-committee`: the appendices are inside the same printed and paginated report, so they are in.

Not in this repo (later units, reportsthatmatter-gqsy.3 follow-ups): the Select Committee's supporting materials collection on govinfo (transcripts of depositions and interviews, documents), which are separate publications.

## Source

`archive/GPO-J6-REPORT.pdf`, the report as GPO published it in govinfo's "January 6th Committee Final Report and Supporting Materials Collection" (package GPO-J6-REPORT, SuDoc Y 1.1/8:117-663): <https://www.govinfo.gov/content/pkg/GPO-J6-REPORT/pdf/GPO-J6-REPORT.pdf>. SHA-256 `132c8833fa1dd3bee62c37a7ad2611798f1a57949c40f20698c7561a07f69ced`, 98,896,026 bytes, 845 pages, born-digital (XPP, PDFlib+PDI 9.2.0, created 28 December 2022), untagged.

Public domain: a work of the U.S. Government (17 U.S.C. 105). The photographs printed in the report carry third-party credits (Getty Images, AP and others); the site serves the text only. See `datapackage.json`.

## Build

`ingest.ts` declares how the report is turned into Markdown. Rebuild from the site repo with `pnpm ingest run us-jan6-committee`.

The text and structure come from the committee's own HTML edition, `reference/raw/index.html` (the `html-submitted/` folder of govinfo's GPO-J6-REPORT package, which also holds the per-part files and 94 photographs; `index.html` is all parts in one file). `committee-html.ts` says what its markup means. The PDF supplies the printed page numbers and the fidelity check, and is still read in full by every pass as the shadow ingest (`cleanEdition` in `@rtm/ingest`). Each part's endnotes are aligned where the PDF prints them, after the part (`EditionNote.after`, ingest PR #66). `fidelity.md` lists every stretch where the HTML and the PDF disagree.

## Materials

The source stack (stage 1, 2026-10-04; the full checklist is in the bead reportsthatmatter-gqsy.3):

| Layer | Source | Role |
| --- | --- | --- |
| Words | the committee's HTML edition (`reference/raw/index.html`) | served; checked word by word against the PDF (98.7% of its words align) |
| Blocks and headings | the HTML edition | served |
| Notes | the HTML edition: every reference linked to its note (`a.endnotereference` to `p.endnote`), 4,287 | served; aligned to the PDF's endnotes |
| Page anchors | `archive/GPO-J6-REPORT.pdf`, printed folios in the running heads | canonical citation target |
| Provenance | govinfo package GPO-J6-REPORT (MODS: `reference/raw/mods.xml`) | |

Renditions considered and rejected:

- **H. Rept. 117-663 in govinfo's Congressional Reports collection** (CRPT-117hrpt663, <https://www.govinfo.gov/content/pkg/CRPT-117hrpt663/pdf/CRPT-117hrpt663.pdf>, 842 pp., iText, SHA-256 `ad5d2b556aee1738c324f1023e2101c0e2e2372c666ee0adb82ea410ab54ea94`): the same printing (job 49-937) and the same words (a word diff of the two text layers differs only in the printer's slugs), but every page carries the printer's slug ("49-937_text.pdf 1 12/23/22 9:11 AM") and the cover is printed at both ends. Its govinfo HTML is a stub ("TEXT NOT AVAILABLE REFER TO PDF").
- **The committee's own release of 22 December 2022** (`january6th.house.gov/sites/democrats.january6th.house.gov/files/Report_FinalReport_Jan6SelectCommittee.pdf`, Wayback capture 20221223025524, 845 pp., SHA-256 `0c854e99d8b9143e5e1df918d7ebf66af349f19d6c9865d2d8505bd7c96281a3`): a pre-print with placeholders ("House Report 117-000", "Union Calendar No. XXX", "December 00"); otherwise word for word the GPO text (7 differences, all placeholders).
- **EPUB**: none found on govinfo. **Wikisource**: not checked (the official HTML is better).

Versions: govinfo's digests of the GPO-J6-REPORT PDFs are unchanged in every Wayback capture since 2 January 2023.

What the HTML edition lacks or differs in (handled in `committee-html.ts`, listed in `fidelity.md`): no page numbers; no Letter of Transmittal (printed p. v; left out); its contents has no page numbers (left out; the site lists the sections); the staff list in mixed case where the PDF sets two columns in capitals; a misspelt title page ("Commitee", not served).
