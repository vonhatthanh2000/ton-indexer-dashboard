import { Address } from "@ton/core";

const NANO_PER_TON = 1_000_000_000n;
const DECIMALS = 9;

function parse(address: string): Address {
  return Address.parse(address.trim());
}

export function isTonAddress(address: string): boolean {
  try {
    parse(address);
    return true;
  } catch {
    return false;
  }
}

/** Any form (EQ…, UQ…, 0:…) → raw uppercase `0:ABC…`, the backend's form. Throws when invalid. */
export function toRaw(address: string): string {
  const parsed = parse(address);
  return `${parsed.workChain}:${parsed.hash.toString("hex").toUpperCase()}`;
}

/** Any form → bounceable mainnet `EQ…` (url-safe). Throws when invalid. */
export function toFriendly(address: string): string {
  return parse(address).toString({ urlSafe: true, bounceable: true, testOnly: false });
}

/** Any form → non-bounceable mainnet `UQ…`. */
export function toNonBounceable(address: string): string {
  return parse(address).toString({ urlSafe: true, bounceable: false, testOnly: false });
}

/** Nanoton decimal string → exact TON decimal string, trailing zeros trimmed. */
export function nanoToTon(nano: string): string {
  const value = BigInt(nano);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / NANO_PER_TON;
  const fraction = (abs % NANO_PER_TON).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : `${whole}`;
  return negative ? `-${text}` : text;
}

/** Standard or url-safe base64 → lowercase hex. */
export function base64ToHex(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  let hex = "";
  for (let index = 0; index < binary.length; index += 1) {
    hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
  }
  return hex;
}

export type TonNetwork = "testnet" | "mainnet";

/**
 * The chain ton-observer indexes, from `NEXT_PUBLIC_TON_NETWORK` (inlined at build time, so a change
 * needs a rebuild/redeploy). Anything but "mainnet" means testnet.
 */
export const TON_NETWORK: TonNetwork = process.env.NEXT_PUBLIC_TON_NETWORK === "mainnet" ? "mainnet" : "testnet";

export function tonviewerBase(network: TonNetwork = TON_NETWORK): string {
  return network === "mainnet" ? "https://tonviewer.com" : "https://testnet.tonviewer.com";
}

export function tonviewerAddressUrl(address: string, network: TonNetwork = TON_NETWORK): string {
  return `${tonviewerBase(network)}/${toFriendly(address)}`;
}

export function tonviewerTxUrl(hashBase64: string, network: TonNetwork = TON_NETWORK): string {
  return `${tonviewerBase(network)}/transaction/${base64ToHex(hashBase64)}`;
}
