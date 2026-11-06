import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, erc20Abi, type Address, type Log } from "viem";
import { guillochePaths } from "./guilloche";
import { amountError, buildPayPath, cleanNote, formatAmount, parsePaymentLink } from "./paymentLink";
import { receiptPaysLink } from "./verify";

const TO = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;
const FROM = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" as Address;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const OTHER = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address;
const HASH = `0x${"ab".repeat(32)}`;

const base = { to: TO, amount: "25.50", token: "USDC", net: "testnet" };
const parse = (values: Record<string, string>, mainnetEnabled = false) =>
  parsePaymentLink(new URLSearchParams(values), { mainnetEnabled });

describe("parsePaymentLink", () => {
  it("round-trips a link built by the app", () => {
    const link = { to: TO, amount: "25.50", token: "USDC", network: "testnet", note: "Logo & icons" } as const;
    const query = buildPayPath(link).split("?")[1];
    expect(parsePaymentLink(new URLSearchParams(query), { mainnetEnabled: false })).toEqual({
      ok: true,
      link,
      tx: null,
    });
  });

  it("rejects an address with a broken checksum", () => {
    expect(parse({ ...base, to: TO.replace("d8dA", "D8dA") }).ok).toBe(false);
  });

  it.each(["0", "0.00", "-1", "1e5", "1.1234567", "", "1,5", "abc", "0x10"])(
    "rejects the amount %j",
    (amount) => expect(parse({ ...base, amount }).ok).toBe(false),
  );

  it("rejects unknown currencies and networks", () => {
    expect(parse({ ...base, token: "DAI" }).ok).toBe(false);
    expect(parse({ ...base, net: "constructor" }).ok).toBe(false);
  });

  it("blocks mainnet links until mainnet is enabled", () => {
    expect(parse({ ...base, net: "mainnet" }).ok).toBe(false);
    expect(parse({ ...base, net: "mainnet" }, true).ok).toBe(true);
  });

  it("rejects a malformed transaction reference and accepts a valid one", () => {
    expect(parse({ ...base, tx: "0x123" }).ok).toBe(false);
    expect(parse({ ...base, tx: HASH })).toMatchObject({ ok: true, tx: HASH });
  });
});

describe("text helpers", () => {
  it("removes hidden direction-changing characters from notes", () => {
    expect(cleanNote("pay‮me")).toBe("pay me");
  });
  it("caps note length", () => {
    expect(cleanNote("x".repeat(200))).toHaveLength(140);
  });
  it("groups amounts without changing their digits", () => {
    expect(formatAmount("1234567.50")).toBe("1,234,567.50");
    expect(formatAmount("007")).toBe("7");
    expect(formatAmount("123456789012.123456")).toBe("123,456,789,012.123456");
  });
  it("explains invalid amounts", () => {
    expect(amountError("25")).toBeNull();
    expect(amountError("0")).toMatch(/above zero/);
  });
});

function transferLog(token: Address, to: Address, value: bigint): Log {
  return {
    address: token,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Transfer",
      args: { from: FROM, to },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockHash: `0x${"11".repeat(32)}`,
    blockNumber: BigInt(1),
    logIndex: 0,
    transactionHash: `0x${"22".repeat(32)}`,
    transactionIndex: 0,
    removed: false,
  };
}

describe("receiptPaysLink", () => {
  const expected = { token: USDC, to: TO, value: BigInt(25_500_000) };
  const receipt = (logs: Log[], status: "success" | "reverted" = "success") => ({ status, logs });

  it("accepts the exact transfer", () => {
    expect(receiptPaysLink(receipt([transferLog(USDC, TO, expected.value)]), expected)).toBe(true);
  });
  it("rejects a reverted transaction", () => {
    expect(receiptPaysLink(receipt([transferLog(USDC, TO, expected.value)], "reverted"), expected)).toBe(false);
  });
  it("rejects a different amount", () => {
    expect(receiptPaysLink(receipt([transferLog(USDC, TO, BigInt(1))]), expected)).toBe(false);
  });
  it("rejects a different recipient", () => {
    expect(receiptPaysLink(receipt([transferLog(USDC, FROM, expected.value)]), expected)).toBe(false);
  });
  it("rejects a look-alike token contract", () => {
    expect(receiptPaysLink(receipt([transferLog(OTHER, TO, expected.value)]), expected)).toBe(false);
  });
});

describe("guillochePaths", () => {
  it("draws the same pattern for the same address and a different one otherwise", () => {
    expect(guillochePaths(TO)).toEqual(guillochePaths(TO));
    expect(guillochePaths(TO).primary[0]).not.toBe(guillochePaths(FROM).primary[0]);
  });
});
