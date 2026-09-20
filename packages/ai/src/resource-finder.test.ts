import { describe, expect, it } from "vitest";
import { acceptSuggestion } from "./resource-finder";

describe("acceptSuggestion", () => {
  const good = {
    title: "Thin Lenses — University Physics Vol. 3",
    url: "https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses#fig",
    check: "Thin Lenses",
  };

  it("keeps a trusted https page and labels its source", () => {
    expect(acceptSuggestion(good)).toEqual({
      title: good.title,
      url: "https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses",
      source: "openstax.org",
      check: "Thin Lenses",
    });
    expect(acceptSuggestion({ ...good, url: "https://chem.libretexts.org/Bookshelves/X" })?.source).toBe("libretexts.org");
  });

  it("allows HyperPhysics over http (it has no https)", () => {
    expect(acceptSuggestion({ ...good, url: "http://hyperphysics.phy-astr.gsu.edu/hbase/geoopt/lenses.html" })).not.toBeNull();
    expect(acceptSuggestion({ ...good, url: "http://openstax.org/books/x" })).toBeNull();
  });

  it("drops untrusted hosts, look-alikes and junk", () => {
    expect(acceptSuggestion({ ...good, url: "https://random-notes.example.com/lenses" })).toBeNull();
    expect(acceptSuggestion({ ...good, url: "https://openstax.org.evil.io/books" })).toBeNull();
    expect(acceptSuggestion({ ...good, url: "not a url" })).toBeNull();
    expect(acceptSuggestion({ ...good, check: "" })).toBeNull();
    expect(acceptSuggestion({ ...good, title: "x" })).toBeNull();
  });
});
