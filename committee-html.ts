/**
 * Reads the Select Committee's own HTML edition of its Final Report
 * (reference/raw/index.html: `html-submitted/index.html` in govinfo's
 * GPO-J6-REPORT package, the whole report in one file) into the blocks the
 * hybrid source mode serves (@rtm/ingest `cleanEdition`).
 *
 * What the markup means is a property of this source, so it lives here:
 *
 * - The report is a tree of `<section>`s: `titlepage` and `staff` (front
 *   matter), `np`, `chair`, `vc` (the three forewords), `toc`, `es` (the
 *   Executive Summary), `ch1_` … `ch8_` (`class="chapter"`), `rec`
 *   (Recommendations) and `app1_` … `app4_` (`class="appendix"`).
 * - The title page is not served (the PDF's title pages are front matter
 *   before the first edition word, left unmarked), nor the contents (`toc`:
 *   the HTML's has no page numbers, and the site lists the sections). The
 *   Letter of Transmittal (printed p. v) is not in the HTML at all; filled
 *   from the PDF (a `gap`) it read as a broken heading and quotation, its
 *   title lost with the running head it shares a line with, so it is left
 *   out and listed in fidelity.md as PDF text the edition lacks.
 * - Headings: a part's title is level 2 (`p.SubSectionTitle` "Foreword:
 *   Chairman", "Executive Summary"; a chapter's `<h1>`, titled as the HTML's
 *   own contents titles it, "Chapter 1. THE BIG LIE"; Recommendations and
 *   each appendix's `<h1>`). Below it `<hN>` is level N+1 (`<h2>` "1.1 The
 *   Big Lie Reflected …" is level 3), capped at 6; a foreword's `<h1>` (the
 *   Speaker's "“THE LAST BEST HOPE OF EARTH”") is level 3, and a
 *   recommendation's `p.RecommendationHeading2` ("1. Electoral Count Act.")
 *   is level 3. In the front matter, `p.CommitteeHeader` is a heading: the
 *   first level 2, the others ("COMMITTEE STAFF") level 3.
 * - `p.Extract` (and its italic variants) and the Speaker's `p.Subtitle`
 *   (the oath) are quotations, one block per paragraph: a transcript's lines
 *   stay citable each on its own, as the PDF sets them.
 * - `<figure>`: a photograph. Its `figcaption` (caption and credit, "(Photo
 *   by …)") is one paragraph, a float: the PDF sets it wherever the page put
 *   the photograph, mid-sentence or not. A figure without a caption (the
 *   forewords' portraits and signatures) is nothing, and so is a figure
 *   whose caption is a credit alone (`p.Credit-Full` on a chapter opener's
 *   full-page photograph, 18 `p.Credit-Primary`: "Photo by Chip
 *   Somodevilla/Getty Images"), for a picture the site does not show:
 *   served, it stood as a paragraph of its own between two of the text's.
 * - The forewords' signature blocks (`div.foreword-sig`: "NANCY PELOSI" /
 *   "Speaker of the House") are one paragraph each.
 * - `<ul>`/`<ol>`: a list (an `<ol>` item keeps its printed number, "1. ");
 *   the one `<table>` (Executive Summary: what officials told President
 *   Trump, left, against what he said afterwards, right) is a table, a row
 *   per pair, each cell's speaker line and quotation run together.
 * - Inline: `style="font-style:italic"` is emphasis, `font-weight:bold`
 *   strong, `text-decoration:line-through` struck through (a draft statement
 *   quoted with its deletion); underline is dropped.
 * - Notes: `<a class="endnotereference" href="#ch1_fn2">1</a>` is a marker,
 *   and `<p class="endnote" id="ch1_fn2"><a class="fnback">1</a>. text</p>`
 *   inside the part's `div.EndNotes` its note. Numbering restarts in each
 *   part, so a note is labelled `N-K`, K the part's key (chapters 1-8, the
 *   Vice Chair's foreword 41, the Executive Summary 50, Recommendations 60,
 *   appendices 71-74): note 12 of chapter 4 is never chapter 5's. The
 *   reference and the note are paired by the HTML's own link (`href` to
 *   `id`), not by position; a number that disagrees with its note's is an
 *   error.
 */
import { htmlEvents, inlineMarkdown, inlineText, type Edition, type EditionBlock, type EditionNote, type HtmlEvent, type InlinePiece } from "@rtm/ingest";

/** A part of the report: its section id, note key and how its title is found. */
const PART_KEYS: Record<string, number> = {
  vc: 41,
  chair: 42,
  np: 43,
  es: 50,
  rec: 60,
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`ch${i + 1}_`, i + 1])),
  ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`app${i + 1}_`, 71 + i])),
};

type Cur = { kind: "paragraph" | "quote" | "item" | "heading"; level?: number; pieces: InlinePiece[]; float?: boolean };

const hasText = (pieces: InlinePiece[]) => pieces.some((p) => "text" in p && p.text.trim());

function styleOf(attrs: Record<string, string>): { em: boolean; strong: boolean; strike: boolean } {
  const s = attrs.style ?? "";
  return { em: /font-style:\s*italic/.test(s), strong: /font-weight:\s*bold/.test(s), strike: /line-through/.test(s) };
}

export function readCommitteeHtml(files: Array<{ path: string; text: string }>): Edition {
  if (files.length !== 1) throw new Error("committee-html: expects the one index.html");
  const html = files[0].text;
  const body = html.slice(html.indexOf("<body>"), html.lastIndexOf("</body>"));
  const events: HtmlEvent[] = htmlEvents(body);

  const blocks: EditionBlock[] = [];
  const notes: EditionNote[] = [];
  /** note id ("ch1_fn2") → label ("1-1"), from the references; checked against the notes. */
  const refLabel = new Map<string, string>();
  const problems: string[] = [];

  // the enclosing sections' ids, innermost last; and per open tag, what it pushed
  const sections: string[] = [];
  const stack: Array<{ tag: string; pop?: () => void }> = [];
  const style = { em: 0, strong: 0, strike: 0 };

  let cur: Cur | null = null;
  let list: { items: string[]; ordered: boolean; quoted: boolean } | null = null;
  let item: InlinePiece[] | null = null;
  let itemValue: string | null = null;
  let inNotes = false;
  /** The part's last block: the PDF prints its notes after it (EditionNote.after). */
  let notesAfter = -1;
  let note: { id: string; number: string; pieces: InlinePiece[] } | null = null;
  let inFnback = false;
  let ref: { href: string; text: string } | null = null;
  let caption: InlinePiece[] | null = null;
  /** Whether the figure's caption has a caption, not only a credit. */
  let captioned = false;
  /** The one table (Executive Summary): rows of cells, each cell's paragraphs run together. */
  let table: { rows: InlinePiece[][][]; cell: InlinePiece[] | null } | null = null;
  let sig: string[] | null = null;
  let chapterNumber: string | null = null;
  let inChapterNumber = false;
  let skip = 0; // inside the title page, the contents, the "Narrative" divider

  const part = (): string | undefined => [...sections].reverse().find((id) => id in PART_KEYS);
  const partKey = (): number | undefined => {
    const p = part();
    return p ? PART_KEYS[p] : undefined;
  };
  const inFront = () => sections.includes("staff");

  const emit = (block: EditionBlock) => blocks.push(block);

  const closeList = () => {
    if (list?.items.length) emit({ kind: "list", items: list.items, ...(list.quoted ? { quoted: true } : {}) });
    list = null;
  };

  const flush = () => {
    const c = cur;
    cur = null;
    if (!c || !hasText(c.pieces)) return;
    if (c.kind === "heading") {
      closeList();
      emit({ kind: "heading", level: c.level ?? 3, text: inlineText(c.pieces.filter((p) => !("marker" in p))).trim() });
      return;
    }
    const text = inlineMarkdown(c.pieces);
    if (!text) return;
    if (!list || c.float) closeList();
    emit({ kind: c.kind === "quote" ? "quote" : "paragraph", text, ...(c.float ? { float: true } : {}) });
  };

  const open = (kind: Cur["kind"], level?: number) => {
    flush();
    cur = { kind, level, pieces: [] };
  };

  const add = (piece: InlinePiece) => {
    if (skip) return;
    if (note) {
      if (!inFnback) note.pieces.push(piece);
      return;
    }
    if (caption) {
      caption.push(piece);
      return;
    }
    if (table?.cell) {
      table.cell.push(piece);
      return;
    }
    if (sig) {
      if ("text" in piece) sig[sig.length - 1] += piece.text;
      return;
    }
    if (item) {
      item.push(piece);
      return;
    }
    if (!cur) {
      if ("text" in piece && !piece.text.trim()) return;
      open("paragraph");
    }
    cur!.pieces.push(piece);
  };

  const text = (t: string) =>
    add({ text: t, ...(style.em ? { em: true } : {}), ...(style.strong ? { strong: true } : {}), ...(style.strike ? { strike: true } : {}) });

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "text") {
      if (inChapterNumber) {
        chapterNumber = (chapterNumber ?? "") + e.text.trim();
        continue;
      }
      if (ref) {
        ref.text += e.text;
        continue;
      }
      if (note && inFnback) {
        note.number += e.text;
        continue;
      }
      text(e.text);
      continue;
    }
    const tag = e.tag;
    if (e.kind === "start") {
      if (tag === "img" || tag === "br" || tag === "meta" || tag === "link") {
        if (tag === "br") text(" ");
        continue;
      }
      const cls = e.attrs.class ?? "";
      const frame: { tag: string; pop?: () => void } = { tag };
      stack.push(frame);
      switch (tag) {
        case "section": {
          const id = e.attrs.id ?? "";
          flush();
          closeList();
          sections.push(id);
          frame.pop = () => {
            flush();
            closeList();
            sections.pop();
          };
          if (id === "titlepage") {
            skip++;
            frame.pop = () => {
              skip--;
              sections.pop();
            };
          } else if (id === "toc") {
            skip++;
            frame.pop = () => {
              skip--;
              sections.pop();
            };
          }
          break;
        }
        case "div":
          if (cls === "EndNotes") {
            flush();
            closeList();
            inNotes = true;
            notesAfter = blocks.length - 1;
            frame.pop = () => {
              inNotes = false;
            };
          } else if (cls.includes("foreword-sig")) {
            flush();
            closeList();
            sig = [];
            frame.pop = () => {
              const lines = (sig ?? []).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
              sig = null;
              if (lines.length) emit({ kind: "paragraph", text: inlineMarkdown([{ text: lines.join(" ") }]) });
            };
          }
          break;
        case "p": {
          if (skip) break;
          if (sig) {
            sig.push("");
            break;
          }
          if (caption) {
            if (/^Caption/.test(cls)) captioned = true;
            caption.push({ text: " " });
            break;
          }
          if (table?.cell) {
            table.cell.push({ text: " " });
            break;
          }
          if (inNotes) {
            if (cls === "EndNoteHeading") {
              skip++;
              frame.pop = () => skip--;
              break;
            }
            if (cls === "endnote") {
              note = { id: e.attrs.id ?? "", number: "", pieces: [] };
              frame.pop = () => {
                const n = note!;
                note = null;
                const label = refLabel.get(n.id);
                const number = n.number.trim();
                const key = partKey();
                const expected = `${number}-${key}`;
                if (!label) problems.push(`note ${n.id} (${number}) has no reference`);
                else if (label !== expected) problems.push(`note ${n.id}: reference says ${label}, note says ${expected}`);
                // "<a class=fnback>1</a>.  text": the number's full stop opens the text
                const pieces = [...n.pieces];
                const first = pieces.find((p) => "text" in p && p.text.trim()) as { text: string } | undefined;
                if (first) first.text = first.text.replace(/^\s*\.\s*/, "");
                notes.push({ label: label ?? expected, text: inlineText(pieces), after: notesAfter });
              };
            } else {
              // a paragraph of the notes that is not a note's first: it continues the note before
              frame.pop = () => undefined;
              if (notes.length) note = { id: "", number: "", pieces: [] };
              frame.pop = () => {
                if (note && notes.length) notes[notes.length - 1].text += ` ${inlineText(note.pieces)}`;
                note = null;
              };
            }
            break;
          }
          if (cls === "SectionTitle") {
            // "Narrative": the HTML's divider over the chapters; the PDF has no such heading
            skip++;
            frame.pop = () => skip--;
            break;
          }
          if (cls === "ChapterNumber") {
            inChapterNumber = true;
            chapterNumber = "";
            frame.pop = () => {
              inChapterNumber = false;
            };
            break;
          }
          if (cls === "SubSectionTitle") {
            open("heading", 2);
            frame.pop = flush;
            break;
          }
          if (cls === "RecommendationHeading2") {
            open("heading", 3);
            frame.pop = flush;
            break;
          }
          if (cls === "CommitteeHeader" && inFront()) {
            open("heading", blocks.some((b) => b.kind === "heading") ? 3 : 2);
            frame.pop = flush;
            break;
          }
          if (item) {
            item.push({ text: " " });
            break;
          }
          const quote = /^Extract/.test(cls) || (cls === "Subtitle" && part() === "np");
          open(quote ? "quote" : "paragraph");
          frame.pop = flush;
          break;
        }
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          if (skip) break;
          const n = Number(tag.slice(1));
          const p = part() ?? "";
          let level = Math.min(n + 1, 6);
          if (n === 1 && (p === "np" || p === "chair" || p === "vc")) level = 3;
          if (p === "es") level = Math.min(n + 1, 6);
          open("heading", level);
          if (n === 1 && /^ch\d_$/.test(p)) {
            // titled as the HTML's own contents titles it: "Chapter 1. THE BIG LIE"
            cur!.pieces.push({ text: `Chapter ${chapterNumber ?? p.slice(2, -1)}. ` });
          }
          frame.pop = flush;
          break;
        }
        case "figcaption":
          flush();
          caption = [];
          captioned = false;
          frame.pop = () => {
            const pieces = caption ?? [];
            caption = null;
            if (captioned && hasText(pieces)) emit({ kind: "paragraph", text: inlineMarkdown(pieces), float: true });
          };
          break;
        case "ul":
        case "ol":
          if (skip) break;
          flush();
          if (item) break; // a list inside an item: its items run on
          closeList();
          list = { items: [], ordered: tag === "ol", quoted: false };
          frame.pop = () => closeList();
          break;
        case "li":
          if (skip || !list) break;
          if (item) break;
          item = [];
          itemValue = list.ordered ? (e.attrs.value ?? String(list.items.length + 1)) : null;
          frame.pop = () => {
            const pieces = item ?? [];
            item = null;
            const t = inlineMarkdown(pieces);
            if (t && list) list.items.push(itemValue ? `${itemValue}. ${t}` : t);
          };
          break;
        case "table":
          flush();
          closeList();
          table = { rows: [], cell: null };
          frame.pop = () => {
            const t = table!;
            table = null;
            const rows = t.rows.map((row) => row.map((cell) => inlineMarkdown(cell))).filter((row) => row.some(Boolean));
            if (rows.length) emit({ kind: "table", rows, header: false });
          };
          break;
        case "tr":
          table?.rows.push([]);
          break;
        case "td":
          if (table) {
            table.cell = [];
            table.rows[table.rows.length - 1]?.push(table.cell);
            frame.pop = () => {
              if (table) table.cell = null;
            };
          }
          break;
        case "span": {
          const s = styleOf(e.attrs);
          if (s.em) style.em++;
          if (s.strong) style.strong++;
          if (s.strike) style.strike++;
          frame.pop = () => {
            if (s.em) style.em--;
            if (s.strong) style.strong--;
            if (s.strike) style.strike--;
          };
          break;
        }
        case "a":
          if (cls === "endnotereference") {
            ref = { href: (e.attrs.href ?? "").replace(/^#/, ""), text: "" };
            frame.pop = () => {
              const r = ref!;
              ref = null;
              const key = partKey();
              const number = r.text.trim();
              if (!/^\d{1,3}$/.test(number) || key === undefined) {
                problems.push(`reference to ${r.href} reads "${number}" outside a numbered part`);
                return;
              }
              const label = `${number}-${key}`;
              if (refLabel.has(r.href)) problems.push(`note ${r.href} referred to twice`);
              refLabel.set(r.href, label);
              add({ marker: label });
            };
          } else if (cls === "fnback") {
            inFnback = true;
            frame.pop = () => {
              inFnback = false;
            };
          }
          break;
        case "em":
        case "i":
          style.em++;
          frame.pop = () => style.em--;
          break;
        case "strong":
        case "b":
          style.strong++;
          frame.pop = () => style.strong--;
          break;
      }
      continue;
    }
    // end tag: pop to the matching start
    if (["img", "br", "meta", "link"].includes(e.tag)) continue;
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].tag !== e.tag) continue;
      const popped = stack.splice(k);
      for (const f of popped.reverse()) f.pop?.();
      break;
    }
  }
  flush();
  closeList();

  const defined = new Set(notes.map((n) => n.label));
  for (const [href, label] of refLabel) if (!defined.has(label)) problems.push(`reference ${label} (${href}) has no note`);
  if (problems.length) throw new Error(`committee-html: ${problems.length} problem(s):\n  ${problems.slice(0, 20).join("\n  ")}`);
  return { blocks, notes };
}
