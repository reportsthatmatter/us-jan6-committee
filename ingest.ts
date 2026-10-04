import { readCommitteeHtml } from "./committee-html.ts";
import { cleanEdition, contentsEntries, endnotes, layoutPageJoins, numberedSections, pageBreakContinuations, pipeline, quoteListRunOns, romanFolios, runningFurniture, type SplitPage } from "@rtm/ingest";

/**
 * The front matter (PDF pp. 4-26, printed ii-xxiii) sets its roman folio on
 * the running head's line, against the part's name: "FOREWORD: CHAIRMAN
 * xiii" on a right-hand page, "xviii   TABLE OF CONTENTS" on a left-hand
 * one. `romanFolios()` reads a roman folio only alone on its line, and
 * `runningFurniture()` takes a head off only where it recurs with an arabic
 * number, so these heads stayed in the text ("LETTER OF TRANSMITTAL v" in
 * the transmittal letter the PDF fills in) and the pages had no anchor.
 * This reads the folio into `roman` and drops the line. Shape-anchored: the
 * first line of a page before the Executive Summary, capitals and a valid
 * roman numeral at one end, set apart by a wide space.
 */
const FRONT_HEAD = /^\s*(?:([ivxlc]{1,6})\s{3,}[A-Z][A-Z :’'&,.-]+|[A-Z][A-Z :’'&,.-]+?\s{3,}([ivxlc]{1,6}))\s*$/;
const ROMAN = /^(?:x{0,3})(?:ix|iv|v?i{0,3})$/;
const FIRST_BODY_PAGE = 27; // printed 1, the Executive Summary

function frontMatterFolios(): { readonly name: string; readonly stage: "volume"; run(pages: SplitPage[]): SplitPage[] } {
  return {
    name: "frontMatterFolios",
    stage: "volume",
    run(pages) {
      return pages.map((page) => {
        if (page.pdfIndex >= FIRST_BODY_PAGE) return page;
        const first = page.body.findIndex((line) => line.trim() !== "");
        if (first === -1) return page;
        const m = page.body[first].match(FRONT_HEAD);
        const roman = m ? (m[1] ?? m[2]) : undefined;
        if (!roman || !ROMAN.test(roman)) return page;
        return { ...page, roman, body: page.body.filter((_, i) => i !== first) };
      });
    },
  };
}

export default pipeline({
  id: "us-jan6-committee",
  title: "Final Report of the Select Committee to Investigate the January 6th Attack on the United States Capitol",
  authors: "Select Committee to Investigate the January 6th Attack on the United States Capitol, U.S. House of Representatives",
  published_at: "22 December 2022",
  source_url: "https://www.govinfo.gov/app/details/GPO-J6-REPORT",
  repo: ".",
  volumes: [
    {
      path: "archive/GPO-J6-REPORT.pdf",
      sha256: "132c8833fa1dd3bee62c37a7ad2611798f1a57949c40f20698c7561a07f69ced",
    },
  ],
  passes: [
    cleanEdition({
      dir: import.meta.dirname,
      files: [{ path: "reference/raw/index.html", sha256: "c3343f7de46644445bb486cb37a338e2afbc2628b25cfb2942ad1a77315cc33b" }],
      read: readCommitteeHtml,
    }),
    layoutPageJoins(),
    quoteListRunOns(),
    endnotes(),
    numberedSections(),
    contentsEntries(),
    romanFolios(),
    frontMatterFolios(),
    runningFurniture({ numbersTrackPages: true }),
    pageBreakContinuations(),
  ],
});
