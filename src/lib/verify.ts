import { erc20Abi, isAddressEqual, parseEventLogs, type Address, type Log } from "viem";

export type ReceiptLike = {
  status: "success" | "reverted";
  logs: Log[];
};

export type Expected = {
  token: Address;
  to: Address;
  value: bigint;
};

// A payment counts only if the token contract itself logged an exact transfer to the recipient.
export function receiptPaysLink(receipt: ReceiptLike, expected: Expected): boolean {
  if (receipt.status !== "success") return false;

  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
    strict: true,
  });

  return transfers.some(
    (log) =>
      isAddressEqual(log.address, expected.token) &&
      isAddressEqual(log.args.to, expected.to) &&
      log.args.value === expected.value,
  );
}
