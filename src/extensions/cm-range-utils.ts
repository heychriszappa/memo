/**
 * Cursor-range overlap detection for live preview decorations.
 * Shared by marker hiding and task toggle plugins.
 *
 * Pattern from SilverBullet's isCursorInRange / Zettlr's rangeInSelection.
 */

import type { EditorSelection } from "@codemirror/state";

/**
 * Returns true if a collapsed cursor sits inside [rangeFrom, rangeTo].
 * Non-collapsed selections (Select All, click-drag) are ignored — markers
 * should only reveal when the user is editing at a specific position,
 * not when selecting text for copy/delete/format.
 *
 * With includeAdjacent=true (default), cursor touching a boundary counts —
 * this means markers are revealed when cursor is right next to them.
 */
export function rangeInSelection(
  selection: EditorSelection,
  rangeFrom: number,
  rangeTo: number,
  includeAdjacent = true,
): boolean {
  return selection.ranges.some((range) => {
    if (range.from !== range.to) return false; // skip text selections
    return includeAdjacent
      ? range.head >= rangeFrom && range.head <= rangeTo
      : range.head > rangeFrom && range.head < rangeTo;
  });
}
