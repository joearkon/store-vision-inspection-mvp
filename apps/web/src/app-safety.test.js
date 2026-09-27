import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("React effect safety", () => {
  it("does not pass promise-returning loaders directly to useEffect", () => {
    const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/useEffect\(load\s*,/);
  });
});
