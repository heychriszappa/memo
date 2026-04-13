import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");

function extractZenHeaderRule(source: string): string | null {
  const match = source.match(/\.zen-mode\s*>\s*div:first-child\s*\{([\s\S]*?)\}/);
  return match?.[1] ?? null;
}

function extractPixelValue(ruleBody: string, property: string): number | null {
  const match = ruleBody.match(new RegExp(`${property}:\\s*(\\d+)px`, "i"));
  if (!match) return null;
  return Number(match[1]);
}

describe("zen mode drag region", () => {
  test("keeps a usable header drag strip height", () => {
    const zenHeaderRule = extractZenHeaderRule(css);
    expect(zenHeaderRule).not.toBeNull();

    const height = extractPixelValue(zenHeaderRule!, "height");
    const minHeight = extractPixelValue(zenHeaderRule!, "min-height");

    // 20px+ gives a realistically grabbable trackpad target in zen mode.
    expect(height).toBeGreaterThanOrEqual(20);
    expect(minHeight).toBeGreaterThanOrEqual(20);
  });
});
