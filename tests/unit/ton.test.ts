import { describe, expect, it } from "vitest";
import {
  base64ToHex,
  isTonAddress,
  nanoToTon,
  toFriendly,
  toNonBounceable,
  toRaw,
  tonviewerTxUrl,
} from "@/lib/ton";

const USDT_FRIENDLY = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const USDT_RAW = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";

describe("addresses", () => {
  it("normalises every form to raw uppercase", () => {
    expect(toRaw(USDT_FRIENDLY)).toBe(USDT_RAW);
    expect(toRaw(USDT_RAW.toLowerCase())).toBe(USDT_RAW);
    expect(toRaw(toNonBounceable(USDT_RAW))).toBe(USDT_RAW);
  });
  it("shows raw as bounceable EQ…", () => {
    expect(toFriendly(USDT_RAW)).toBe(USDT_FRIENDLY);
    expect(toNonBounceable(USDT_RAW).startsWith("UQ")).toBe(true);
  });
  it("rejects bad input", () => {
    expect(isTonAddress("hello")).toBe(false);
    expect(isTonAddress("")).toBe(false);
    expect(() => toRaw("0:XYZ")).toThrow();
  });
});

describe("nanoToTon", () => {
  it("keeps every digit with BigInt", () => {
    expect(nanoToTon("1234567890123456789")).toBe("1234567890.123456789");
  });
  it("trims zeros and handles small values", () => {
    expect(nanoToTon("1000000000")).toBe("1");
    expect(nanoToTon("0")).toBe("0");
    expect(nanoToTon("1")).toBe("0.000000001");
    expect(nanoToTon("2500000000")).toBe("2.5");
  });
});

describe("hashes", () => {
  it("converts base64 to hex for tonviewer", () => {
    expect(base64ToHex("AAEC/w==")).toBe("000102ff");
    expect(tonviewerTxUrl("AAEC/w==")).toBe("https://tonviewer.com/transaction/000102ff");
  });
});
