import { describe, it, expect, vi } from "vitest";
vi.mock("./auth", () => ({ supabase: async () => null }));
import { mergeCharacters, type Char } from "./characters";

const c = (id: string, edited: number): Char => ({ id, name: id, edited });

describe("mergeCharacters", () => {
  it("keeps the newer copy of each id and uploads local ones the account lacks or has older", () => {
    const { merged, upload } = mergeCharacters([c("a", 5), c("b", 1), c("new", 3)], [c("a", 2), c("b", 4)]);
    expect(merged.map(x => [x.id, x.edited])).toEqual([["a", 5], ["b", 4], ["new", 3]]);
    expect(upload.map(x => x.id)).toEqual(["a", "new"]);
  });
  it("drops local copies of other accounts' characters instead of uploading them as yours", () => {
    const { merged, upload } = mergeCharacters([c("mine", 2), c("theirs", 9)], [c("mine", 1)], new Set(["theirs"]));
    expect(merged.map(x => x.id)).toEqual(["mine"]);
    expect(upload.map(x => x.id)).toEqual(["mine"]);
  });
});
