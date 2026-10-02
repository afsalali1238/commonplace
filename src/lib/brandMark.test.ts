import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ICON_VERSION, MARK_ARMS, MARK_COLORS, MARK_STROKE_WIDTH } from "./brandMark";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Every <line> in an SVG with its resolved stroke colour and width. */
function lines(svg: string) {
  const groupStroke = svg.match(/<g[^>]*stroke="([^"]+)"/)?.[1];
  const groupWidth = svg.match(/<g[^>]*stroke-width="([^"]+)"/)?.[1];
  return [...svg.matchAll(/<line([^>]*)\/>/g)].map(([, attrs]) => {
    const attr = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
    return {
      coords: [attr("x1"), attr("y1"), attr("x2"), attr("y2")].map(Number),
      stroke: attr("stroke") ?? groupStroke,
      width: Number(attr("stroke-width") ?? groupWidth),
    };
  });
}

describe("static favicons match the shared mark", () => {
  for (const [file, colors] of [
    ["public/logo.svg", MARK_COLORS.light],
    ["public/logo-dark.svg", MARK_COLORS.dark],
  ] as const) {
    it(file, () => {
      const drawn = lines(read(file));
      expect(drawn.map((l) => l.coords)).toEqual(MARK_ARMS.map((a) => [a.x1, a.y1, a.x2, a.y2]));
      expect(drawn.map((l) => l.stroke)).toEqual(
        MARK_ARMS.map((a) => (a.accent ? colors.accent : colors.ink)),
      );
      for (const l of drawn) expect(l.width).toBe(MARK_STROKE_WIDTH);
    });
  }
});

describe("baked mark colours match the theme tokens", () => {
  const css = read("src/styles.css");
  const token = (block: string, name: string) =>
    css.match(new RegExp(`${block}\\s*\\{[^}]*--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

  it("light (@theme)", () => {
    expect(token("@theme", "paper")).toBe(MARK_COLORS.light.paper);
    expect(token("@theme", "ink")).toBe(MARK_COLORS.light.ink);
    expect(token("@theme", "accent")).toBe(MARK_COLORS.light.accent);
  });
  it("dark (.dark)", () => {
    expect(token("\\.dark", "paper")).toBe(MARK_COLORS.dark.paper);
    expect(token("\\.dark", "ink")).toBe(MARK_COLORS.dark.ink);
    expect(token("\\.dark", "accent")).toBe(MARK_COLORS.dark.accent);
  });
});

describe("icon cache-buster", () => {
  it("every manifest icon carries ICON_VERSION, so installed apps pick up a new mark", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
      icons: { src: string }[];
    };
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons)
      expect(icon.src).toMatch(new RegExp(`\\?v=${ICON_VERSION}$`));
  });
});
