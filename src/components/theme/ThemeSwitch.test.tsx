import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeSwitch } from "./ThemeSwitch";

describe("ThemeSwitch", () => {
  const html = renderToStaticMarkup(<ThemeSwitch />);

  it("renders three named radios with Sandstone selected on the server", () => {
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    for (const label of ["Sandstone", "Blueprint", "Dark"]) expect(html).toContain(label);
    expect(html).not.toContain("Sepia");
    expect(html).toMatch(/checked=""[^>]*value="sandstone"/);
  });

  it("is a labelled group with 40px targets", () => {
    expect(html).toContain("<legend");
    expect(html).toContain("size-10");
  });

  it("offers a page tone for /demo and sign-in", () => {
    expect(renderToStaticMarkup(<ThemeSwitch tone="page" />)).toContain("bg-surface-2");
  });
});
