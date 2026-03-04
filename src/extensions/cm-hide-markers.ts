/**
 * Live preview — Obsidian/Zettlr-style markdown marker hiding.
 *
 * Uses Decoration.replace({}) to hide syntax markers (**, *, ~~, ==, `, #, >)
 * when the cursor is not inside the formatted node. Reveals raw markers when
 * the cursor enters or touches the node boundary.
 *
 * Pattern from Zettlr (12.5k stars) and SilverBullet (4.7k stars):
 *   1. Iterate syntax tree within view.visibleRanges (viewport only)
 *   2. For each formatting node, check rangeInSelection()
 *   3. If cursor outside -> Decoration.replace({}) on the marker children
 *   4. Rebuild on docChanged | viewportChanged | selectionSet
 */

import {
  ViewPlugin,
  Decoration,
  EditorView,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import { rangeInSelection } from "./cm-range-utils";

/** Reusable empty replacement — hides a range with no visual substitute */
const hiddenDeco = Decoration.replace({});

/** Line decorations for fenced code block — first/last get rounded corners */
const fencedCodeLineDeco = Decoration.line({ class: "cm-fenced-code" });
const fencedCodeFirstDeco = Decoration.line({ class: "cm-fenced-code cm-fenced-code-first" });
const fencedCodeLastDeco = Decoration.line({ class: "cm-fenced-code cm-fenced-code-last" });
const fencedCodeOnlyDeco = Decoration.line({ class: "cm-fenced-code cm-fenced-code-first cm-fenced-code-last" });

/** Line decoration to visually collapse a fence line to zero height.
 *  Used WITH a same-line Decoration.replace({}) that empties the content.
 *  CM6 constraint: ViewPlugin replace decos MUST NOT cross newlines. */
const fencedFenceHiddenDeco = Decoration.line({ class: "cm-fenced-fence-hidden" });

/** Push fenced-code line decorations with first/last rounding classes */
function pushFencedLineDecos(
  ranges: Range<Decoration>[],
  doc: { line(n: number): { from: number } },
  startLine: number,
  endLine: number,
) {
  for (let ln = startLine; ln <= endLine; ln++) {
    const isFirst = ln === startLine;
    const isLast = ln === endLine;
    const deco =
      isFirst && isLast ? fencedCodeOnlyDeco :
      isFirst ? fencedCodeFirstDeco :
      isLast ? fencedCodeLastDeco :
      fencedCodeLineDeco;
    ranges.push(deco.range(doc.line(ln).from));
  }
}

/**
 * Scan visible portions of the syntax tree and collect Decoration.replace({})
 * ranges for all formatting markers whose parent node is NOT under the cursor.
 */
function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const { state } = view;
  const { doc, selection } = state;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        switch (node.name) {
          // ── Inline formatting ──────────────────────────────────────

          case "StrongEmphasis":
          case "Emphasis": {
            if (rangeInSelection(selection, node.from, node.to)) return;
            for (const mark of node.node.getChildren("EmphasisMark")) {
              ranges.push(hiddenDeco.range(mark.from, mark.to));
            }
            break;
          }

          case "Strikethrough": {
            if (rangeInSelection(selection, node.from, node.to)) return;
            // Guard: empty tilde-only nodes at line start (e.g. ~~) may be
            // fence delimiters mid-typing (~~~). Same parser race as InlineCode.
            const stLine = doc.lineAt(node.from);
            const stBefore = doc.sliceString(stLine.from, node.from);
            const stText = doc.sliceString(node.from, node.to);
            if (stBefore.trim() === "" && /^~+$/.test(stText)) break;
            for (const mark of node.node.getChildren("StrikethroughMark")) {
              ranges.push(hiddenDeco.range(mark.from, mark.to));
            }
            break;
          }

          case "InlineCode": {
            if (rangeInSelection(selection, node.from, node.to)) return;
            // Guard: empty backtick-only nodes at line start (e.g. ``)
            // are likely fence delimiters mid-typing. The incremental parser
            // briefly creates InlineCode before recognizing FencedCode on the
            // next keystroke. Hiding these causes a jarring backtick flash.
            const icLine = doc.lineAt(node.from);
            const icBefore = doc.sliceString(icLine.from, node.from);
            const icText = doc.sliceString(node.from, node.to);
            if (icBefore.trim() === "" && /^`+$/.test(icText)) break;
            for (const mark of node.node.getChildren("CodeMark")) {
              ranges.push(hiddenDeco.range(mark.from, mark.to));
            }
            break;
          }

          case "Link": {
            if (rangeInSelection(selection, node.from, node.to)) return;
            for (const mark of node.node.getChildren("LinkMark")) {
              ranges.push(hiddenDeco.range(mark.from, mark.to));
            }
            for (const url of node.node.getChildren("URL")) {
              ranges.push(hiddenDeco.range(url.from, url.to));
            }
            break;
          }

          // Image nodes are fully handled by the block widget plugin —
          // don't hide sub-markers here, it would conflict with the replace decoration.
          case "Image":
            return false;

          // Custom ==highlight== extension
          case "Highlight": {
            if (rangeInSelection(selection, node.from, node.to)) return;
            for (const mark of node.node.getChildren("HighlightMark")) {
              ranges.push(hiddenDeco.range(mark.from, mark.to));
            }
            break;
          }

          // ── Block markers ──────────────────────────────────────────

          // Heading: # ## ### — check against parent heading node
          case "HeaderMark": {
            const parent = node.node.parent;
            if (!parent) break;
            if (rangeInSelection(selection, parent.from, parent.to)) break;
            // Include trailing space after # in the hidden range
            let end = node.to;
            if (end < doc.length && doc.sliceString(end, end + 1) === " ") {
              end += 1;
            }
            ranges.push(hiddenDeco.range(node.from, end));
            break;
          }

          // Blockquote: > — walk to highest Blockquote ancestor
          case "QuoteMark": {
            let highest = node.node.parent;
            let walk = highest;
            while (walk) {
              if (walk.name === "Blockquote") highest = walk;
              walk = walk.parent;
            }
            if (!highest || highest.name !== "Blockquote") break;
            if (rangeInSelection(selection, highest.from, highest.to)) break;
            // Hide > and optional trailing space
            const slice = doc.sliceString(node.from, node.from + 2);
            const match = /^>[ ]?/.exec(slice);
            const end = match ? node.from + match[0].length : node.to;
            ranges.push(hiddenDeco.range(node.from, end));
            break;
          }

          // Fenced code: ```lang ... ``` — Notion-style live preview.
          // Unclosed blocks: keep opening fence visible, only style content lines.
          // Closed blocks: hide/reveal fences based on cursor position.
          case "FencedCode": {
            const marks = node.node.getChildren("CodeMark");
            if (marks.length === 0) break;

            const openLine = doc.lineAt(marks[0].from);
            const closed = marks.length >= 2;

            // Unclosed blocks — don't hide fences (no clear boundary).
            // Style ALL lines (including opening fence) with code background
            // so the unclosed→closed transition is seamless — no visual jump
            // when the user types the closing ``` and cursor stays inside.
            if (!closed) {
              const lastLine = doc.lineAt(node.to).number;
              pushFencedLineDecos(ranges, doc, openLine.number, lastLine);
              return false;
            }

            // Closed blocks — hide/reveal fences based on cursor position
            const closeLine = doc.lineAt(marks[marks.length - 1].from);
            const cursorInside = selection.ranges.some(
              (r) => r.from === r.to && r.head >= openLine.from && r.head <= closeLine.to,
            );

            const contentFirst = openLine.number + 1;
            const contentLast = closeLine.number - 1;

            if (cursorInside) {
              // Cursor inside — show all lines with code background
              pushFencedLineDecos(ranges, doc, openLine.number, closeLine.number);
            } else {
              // Cursor outside — hide fences, show styled content
              if (contentFirst <= contentLast) {
                pushFencedLineDecos(ranges, doc, contentFirst, contentLast);
              }
              // Hide fence content WITHIN line boundaries only.
              // CM6 constraint: ViewPlugin replace decos MUST NOT cross newlines —
              // crossing \n is silently ignored and causes cursor position bugs.
              // Use line decoration (CSS height:0) to visually collapse the line.
              ranges.push(hiddenDeco.range(openLine.from, openLine.to));
              ranges.push(fencedFenceHiddenDeco.range(openLine.from));
              if (closeLine.number !== openLine.number) {
                ranges.push(hiddenDeco.range(closeLine.from, closeLine.to));
                ranges.push(fencedFenceHiddenDeco.range(closeLine.from));
              }
            }

            return false;
          }
        }
      },
    });
  }

  // Empty auto-closed pairs at cursor (**** ~~ ====).
  // The parser can't recognize these as formatting (no content between markers).
  // Hide both marker pairs so the user sees a clean insertion point.
  for (const sel of selection.ranges) {
    const pos = sel.head;
    if (pos >= 2 && pos + 2 <= doc.length) {
      const around = doc.sliceString(pos - 2, pos + 2);
      if (around === "****" || around === "~~~~" || around === "====") {
        ranges.push(hiddenDeco.range(pos - 2, pos));
        ranges.push(hiddenDeco.range(pos, pos + 2));
      }
    }
  }

  return Decoration.set(ranges, true);
}

const hideMarkersViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const hideMarkersPlugin: Extension = hideMarkersViewPlugin;

/* ── Auto-close paired markers ── */

export const autoCloseMarkup = EditorView.inputHandler.of(
  (view, from, to, text) => {
    if (text.length !== 1 || from !== to) return false;

    const doc = view.state.doc;
    const before = from > 0 ? doc.sliceString(from - 1, from) : "";
    const beforeBefore = from > 1 ? doc.sliceString(from - 2, from - 1) : "";
    const after = doc.sliceString(from, Math.min(from + 2, doc.length));

    // Skip over closing markers when exiting formatted text.
    // e.g. cursor in **hello|** — typing * jumps past the closing **
    // Don't skip for ~ at line start or inside FencedCode (typing ~~~ fence delimiter).
    if (
      (text === "*" && after.startsWith("**") && before !== "*") ||
      (text === "=" && after.startsWith("==") && before !== "=")
    ) {
      view.dispatch({ selection: { anchor: from + 2 } });
      return true;
    }
    if (text === "~" && after.startsWith("~~") && before !== "~") {
      const line = doc.lineAt(from);
      const textBeforeCursor = doc.sliceString(line.from, from).replace(/~/g, "");
      const atLineStart = textBeforeCursor.trim() === "";
      const tree = syntaxTree(view.state);
      const nodeAt = tree.resolveInner(from, -1);
      const insideFencedCode = nodeAt.name === "FencedCode" || nodeAt.parent?.name === "FencedCode";
      if (atLineStart || insideFencedCode) return false;
      view.dispatch({ selection: { anchor: from + 2 } });
      return true;
    }

    // Auto-close: when typing the second char of a pair (** ~~ ==),
    // insert the typed char + closing pair and place cursor between.
    if (text === "*" && before === "*" && beforeBefore !== "*" && !after.startsWith("*")) {
      view.dispatch({
        changes: { from, insert: "***" },  // typed * + closing **
        selection: { anchor: from + 1 },
      });
      return true;
    }
    if (text === "~" && before === "~" && beforeBefore !== "~" && !after.startsWith("~")) {
      // Don't auto-close ~~ at line start — user may be typing ~~~ for a fenced code block.
      // Also skip inside FencedCode nodes (closing fence).
      const line = doc.lineAt(from);
      const textBeforeTildes = doc.sliceString(line.from, from - 1);
      const atLineStart = textBeforeTildes.trim() === "";
      const tree = syntaxTree(view.state);
      const nodeAt = tree.resolveInner(from, -1);
      const insideFencedCode = nodeAt.name === "FencedCode" || nodeAt.parent?.name === "FencedCode";
      if (atLineStart || insideFencedCode) return false;
      view.dispatch({
        changes: { from, insert: "~~~" },
        selection: { anchor: from + 1 },
      });
      return true;
    }
    if (text === "=" && before === "=" && beforeBefore !== "=" && !after.startsWith("=")) {
      view.dispatch({
        changes: { from, insert: "===" },
        selection: { anchor: from + 1 },
      });
      return true;
    }

    return false;
  },
);
