import type { Hash } from "viem";
import type { PaymentLink } from "./paymentLink";

const CREATED_KEY = "slip.created.v1";
const PAID_KEY = "slip.paid.v1";

export type CreatedLink = PaymentLink & { createdAt: number };

// Browser storage can be empty or blocked, so these helpers never throw.
function read<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The payment itself lives on chain; losing this local copy is harmless.
  }
}

export const loadCreatedLinks = () => read<CreatedLink[]>(CREATED_KEY, []);

export const saveCreatedLink = (link: PaymentLink) =>
  write(CREATED_KEY, [{ ...link, createdAt: Date.now() }, ...loadCreatedLinks()].slice(0, 100));

export const loadPaidTx = (key: string) => read<Record<string, Hash>>(PAID_KEY, {})[key] ?? null;

export const savePaidTx = (key: string, tx: Hash) =>
  write(PAID_KEY, { ...read<Record<string, Hash>>(PAID_KEY, {}), [key]: tx });
