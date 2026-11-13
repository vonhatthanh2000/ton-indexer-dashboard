import { describe, expect, it } from "vitest";
import { addressesFromCsv, addressesFromFile, addressesFromJson, parseAddressLines, validateStartLt } from "@/lib/register";

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

describe("addressesFromCsv", () => {
  it("uses the address column when the header names one", () => {
    expect(addressesFromCsv(`label,Address\nmain,${FRIENDLY}\nzero,"${RAW}"\n`)).toEqual([FRIENDLY, RAW]);
  });
  it("takes the first column without a header, any delimiter, skipping blank rows", () => {
    expect(addressesFromCsv(`${FRIENDLY};x\n\n${RAW};y`)).toEqual([FRIENDLY, RAW]);
    expect(addressesFromCsv(`${FRIENDLY}\t1\r\n${RAW}\t2`)).toEqual([FRIENDLY, RAW]);
    expect(addressesFromCsv(`${FRIENDLY}\n${RAW}`)).toEqual([FRIENDLY, RAW]);
  });
  it("handles quoted cells with commas and escaped quotes", () => {
    expect(addressesFromCsv(`address,note\n"${RAW}","a, ""b"""`)).toEqual([RAW]);
  });
});

describe("addressesFromJson", () => {
  it("accepts a list, a list of objects, or { addresses }", () => {
    expect(addressesFromJson(JSON.stringify([FRIENDLY, RAW]))).toEqual({ addresses: [FRIENDLY, RAW] });
    expect(addressesFromJson(JSON.stringify([{ address: FRIENDLY }]))).toEqual({ addresses: [FRIENDLY] });
    expect(addressesFromJson(JSON.stringify({ addresses: [RAW] }))).toEqual({ addresses: [RAW] });
  });
  it("explains what is wrong", () => {
    expect(addressesFromJson("{")).toEqual({ error: "That file is not valid JSON." });
    expect(addressesFromJson('{"a":1}')).toHaveProperty("error");
    expect(addressesFromJson("[1]")).toHaveProperty("error");
  });
});

describe("addressesFromFile", () => {
  it("picks the parser by extension and strips a BOM", () => {
    expect(addressesFromFile("x.CSV", 10, `\uFEFFaddress\n${RAW}`)).toEqual({ addresses: [RAW] });
    expect(addressesFromFile("x.txt", 10, `${RAW}\n`)).toEqual({ addresses: [RAW] });
    expect(addressesFromFile("x.json", 10, JSON.stringify([RAW]))).toEqual({ addresses: [RAW] });
  });
  it("rejects other types, empty files and files over 1 MB", () => {
    expect(addressesFromFile("x.xlsx", 10, "")).toEqual({ error: "Use a .csv, .json or .txt file." });
    expect(addressesFromFile("x.csv", 10, "address\n")).toEqual({ error: "No addresses found in that file." });
    expect(addressesFromFile("x.csv", 2 * 1024 * 1024, RAW)).toEqual({ error: "That file is larger than 1 MB." });
  });
});
