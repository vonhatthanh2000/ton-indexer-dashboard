import { describe, expect, it } from "vitest";
import { parseAddressLines, validateStartLt } from "@/lib/register";

const RAW = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const FRIENDLY = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

describe("parseAddressLines", () => {
  it("drops blank lines and maps sent index to textarea line", () => {
    const parsed = parseAddressLines(`\n${FRIENDLY}\n\n  0:${"0".repeat(64)}  \n`);
    expect(parsed.addresses).toEqual([RAW, `0:${"0".repeat(64)}`]);
    expect(parsed.lineOf).toEqual([2, 4]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.listProblem).toBeNull();
  });
  it("flags EQ… and raw forms of one address as duplicates", () => {
    const parsed = parseAddressLines(`${FRIENDLY}\n${RAW}`);
    expect(parsed.problems).toEqual([{ line: 2, message: "Line 2 is a duplicate of line 1." }]);
  });
  it("flags invalid lines and list size", () => {
    expect(parseAddressLines("nope").problems[0].line).toBe(1);
    expect(parseAddressLines("   \n").listProblem).toBe("Enter at least one address.");
    const many = Array.from({ length: 101 }, (_, index) => `0:${index.toString(16).padStart(64, "0")}`).join("\n");
    expect(parseAddressLines(many).listProblem).toContain("at most 100");
  });
});

describe("validateStartLt", () => {
  it("accepts canonical decimals up to int64 max", () => {
    expect(validateStartLt("0")).toBeNull();
    expect(validateStartLt("9223372036854775807")).toBeNull();
  });
  it("rejects leading zeros, signs and overflow", () => {
    expect(validateStartLt("01")).not.toBeNull();
    expect(validateStartLt("-1")).not.toBeNull();
    expect(validateStartLt("9223372036854775808")).not.toBeNull();
  });
});
