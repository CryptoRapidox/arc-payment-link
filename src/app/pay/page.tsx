"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Hash } from "viem";
import { Slip } from "@/components/Slip";
import { FAUCET_URL, mainnetEnabled, NETWORKS } from "@/lib/networks";
import { buildPayPath, formatAmount, linkKey, parsePaymentLink, type PaymentLink } from "@/lib/paymentLink";
import { loadPaidTx, savePaidTx } from "@/lib/storage";
import { friendlyError, payLink, verifyPayment, type PayStep } from "@/lib/wallet";

const STEP_TEXT: Record<PayStep, string> = {
  connecting: "Connect your wallet and switch to the right network.",
  checking: "Checking your balance.",
  confirming: "Confirm the payment in your wallet.",
  settling: "Payment sent. Waiting for the network to confirm it.",
};

type Status =
  | { kind: "idle" }
  | { kind: "step"; step: PayStep }
  | { kind: "verifying" }
  | { kind: "verified"; tx: Hash }
  | { kind: "mismatch"; tx: Hash }
  | { kind: "not-found"; tx: Hash }
  | { kind: "error"; message: string; tx?: Hash };

function PayForm({ link, initialTx }: { link: PaymentLink; initialTx: Hash | null }) {
  const network = NETWORKS[link.network];
  const key = linkKey(link);
  const [status, setStatus] = useState<Status>(
    initialTx ? { kind: "verifying" } : { kind: "idle" },
  );
  const [previousTx, setPreviousTx] = useState<Hash | null>(null);

  useEffect(() => {
    setPreviousTx(loadPaidTx(key));
  }, [key]);

  const check = async (tx: Hash) => {
    setStatus({ kind: "verifying" });
    try {
      const result = await verifyPayment(link, tx);
      setStatus(result === "verified" ? { kind: "verified", tx } : { kind: result, tx });
      return result;
    } catch (error) {
      setStatus({ kind: "error", message: friendlyError(error), tx });
      return null;
    }
  };

  useEffect(() => {
    if (initialTx) void check(initialTx);
    // Runs once for the transaction named in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTx]);

  const pay = async () => {
    let submitted: Hash | undefined;
    try {
      const tx = await payLink(
        link,
        (step) => setStatus({ kind: "step", step }),
        (hash) => {
          submitted = hash;
          // Keep the reference from the moment it exists, so a closed tab cannot lose it.
          window.history.replaceState(null, "", buildPayPath(link, hash));
        },
      );
      if ((await check(tx)) === "verified") {
        savePaidTx(key, tx);
        setPreviousTx(tx);
      }
    } catch (error) {
      setStatus({ kind: "error", message: friendlyError(error), tx: submitted });
    }
  };

  const verifiedStamp =
    status.kind === "verified" ? <p className="stamp">Paid</p> : null;
  const busy = status.kind === "step" || status.kind === "verifying";
  const txForLink =
    status.kind === "verified" || status.kind === "mismatch" || status.kind === "not-found"
      ? status.tx
      : status.kind === "error"
        ? status.tx
        : undefined;
  const label = `${formatAmount(link.amount)} ${link.token}`;

  return (
    <div className="pay-layout">
      <h1>{status.kind === "verified" ? "Payment confirmed" : "Payment request"}</h1>
      <Slip
        to={link.to}
        amount={link.amount}
        token={link.token}
        note={link.note}
        networkName={network.name}
        stamp={verifiedStamp}
      />

      <div className="pay-actions">
        {status.kind !== "verified" ? (
          <>
            <p className="caution">
              Crypto payments cannot be reversed. Before paying, check this address with the person
              who sent you the link, using a channel you trust.
            </p>
            {previousTx ? (
              <p className="caution">
                This browser already paid this link.{" "}
                <a href={`${network.explorer}/tx/${previousTx}`} target="_blank" rel="noreferrer">
                  See that payment
                </a>
                . Pay again only if a second payment is due.
              </p>
            ) : null}
            <button type="button" className="primary" onClick={pay} disabled={busy}>
              {previousTx ? `Pay ${label} again` : `Pay ${label}`}
            </button>
            {link.network === "testnet" ? (
              <p className="hint">
                Need test tokens? Get them from the{" "}
                <a href={FAUCET_URL} target="_blank" rel="noreferrer">Circle faucet</a>.
              </p>
            ) : null}
          </>
        ) : (
          <p>
            The network confirms {label} reached the address above. Save this page as your receipt.
          </p>
        )}

        <div aria-live="polite">
          {status.kind === "step" ? <p>{STEP_TEXT[status.step]}</p> : null}
          {status.kind === "verifying" ? <p>Checking this payment on the network.</p> : null}
          {status.kind === "mismatch" ? (
            <p className="error">
              This transaction does not contain the requested payment. Treat this link as unpaid.
            </p>
          ) : null}
          {status.kind === "not-found" ? (
            <p className="error">
              The network has no record of this transaction yet. Check again in a minute.
            </p>
          ) : null}
          {status.kind === "error" ? <p className="error" role="alert">{status.message}</p> : null}
        </div>

        {txForLink ? (
          <a href={`${network.explorer}/tx/${txForLink}`} target="_blank" rel="noreferrer">
            View transaction on the Arc explorer
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PayContent() {
  const params = useSearchParams();
  const parsed = useMemo(() => parsePaymentLink(params, { mainnetEnabled }), [params]);

  if (!parsed.ok) {
    return (
      <div className="pay-layout">
        <h1>This link cannot be paid</h1>
        <p className="error">{parsed.error}</p>
        <p>Ask the person who sent it for a new link. No payment was made.</p>
      </div>
    );
  }
  return <PayForm link={parsed.link} initialTx={parsed.tx} />;
}

export default function PayPage() {
  return (
    <Suspense fallback={<p className="pay-layout">Loading payment request.</p>}>
      <PayContent />
    </Suspense>
  );
}
