import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";
import { NETWORKS, TOKEN_SYMBOLS, type NetworkId, type TokenSymbol } from "./networks";

export const NOTE_MAX_LENGTH = 140;

export type PaymentLink = {
  to: Address;
  amount: string;
  token: TokenSymbol;
  network: NetworkId;
  note: string;
};

export type ParseResult =
  | { ok: true; link: PaymentLink; tx: Hash | null }
  | { ok: false; error: string };

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;

export function amountError(amount: string): string | null {
  if (!AMOUNT_PATTERN.test(amount)) {
    return "Enter an amount like 25 or 25.50, with up to 6 decimal places.";
  }
  if (!/[1-9]/.test(amount)) return "Enter an amount above zero.";
  return null;
}

// Removes invisible and direction-changing characters that could disguise what a note says.
export const cleanNote = (note: string) =>
  note.replace(/\p{C}/gu, " ").trim().slice(0, NOTE_MAX_LENGTH);

export function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function buildPayPath(link: PaymentLink, tx?: Hash): string {
  const params = new URLSearchParams({
    to: link.to,
    amount: link.amount,
    token: link.token,
    net: link.network,
  });
  if (link.note) params.set("note", link.note);
  if (tx) params.set("tx", tx);
  return `/pay/?${params.toString()}`;
}

export function parsePaymentLink(
  params: Pick<URLSearchParams, "get">,
  options: { mainnetEnabled: boolean },
): ParseResult {
  const to = params.get("to") ?? "";
  const amount = params.get("amount") ?? "";
  const token = params.get("token") ?? "";
  const network = params.get("net") ?? "";
  const tx = params.get("tx");

  // Strict mode rejects mixed-case addresses whose checksum fails, which catches edited links.
  if (!isAddress(to, { strict: true })) {
    return { ok: false, error: "This link has an invalid recipient address." };
  }
  const invalidAmount = amountError(amount);
  if (invalidAmount) return { ok: false, error: "This link has an invalid amount." };
  if (!TOKEN_SYMBOLS.includes(token as TokenSymbol)) {
    return { ok: false, error: "This link asks for a currency this app does not support." };
  }
  if (!Object.hasOwn(NETWORKS, network)) {
    return { ok: false, error: "This link uses an unknown network." };
  }
  if (network === "mainnet" && !options.mainnetEnabled) {
    return { ok: false, error: "This app only accepts Arc Testnet payments for now." };
  }
  if (tx !== null && !isHash(tx)) {
    return { ok: false, error: "This link has an invalid transaction reference." };
  }

  return {
    ok: true,
    tx: tx as Hash | null,
    link: {
      to: getAddress(to),
      amount,
      token: token as TokenSymbol,
      network: network as NetworkId,
      note: cleanNote(params.get("note") ?? ""),
    },
  };
}

export const linkKey = (link: PaymentLink) =>
  [link.network, link.to, link.token, link.amount, link.note].join("|");

// Splits an address into groups of four so people can compare it with what they were told.
export const chunkAddress = (address: string) =>
  address.replace(/^0x/, "").match(/.{1,4}/g)?.join(" ") ?? address;

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
