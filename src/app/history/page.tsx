"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { availableNetworks, NETWORKS, TOKEN_SYMBOLS, type NetworkId } from "@/lib/networks";
import { buildPayPath, formatAmount, shortAddress } from "@/lib/paymentLink";
import { loadCreatedLinks, type CreatedLink } from "@/lib/storage";
import { connectWallet, friendlyError, loadIncomingPayments, type IncomingPayment } from "@/lib/wallet";

type Scan =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; address: Address; payments: IncomingPayment[] }
  | { kind: "error"; message: string };

export default function HistoryPage() {
  const [links, setLinks] = useState<CreatedLink[]>([]);
  const [network, setNetwork] = useState<NetworkId>("testnet");
  const [scan, setScan] = useState<Scan>({ kind: "idle" });
  const networks = availableNetworks();
  const explorer = NETWORKS[network].explorer;

  useEffect(() => {
    setLinks(loadCreatedLinks());
  }, []);

  const loadPayments = async () => {
    setScan({ kind: "loading" });
    try {
      const address = await connectWallet();
      const results = await Promise.all(
        TOKEN_SYMBOLS.map((token) => loadIncomingPayments(NETWORKS[network], address, token)),
      );
      const payments = results.flat().sort((a, b) => Number(b.blockNumber - a.blockNumber));
      setScan({ kind: "done", address, payments });
    } catch (error) {
      setScan({ kind: "error", message: friendlyError(error) });
    }
  };

  return (
    <div className="history-layout">
      <h1>History</h1>

      <section>
        <h2>Payments you received</h2>
        <p>Recent USDC and EURC transfers to your wallet, read directly from the network.</p>
        {networks.length > 1 ? (
          <select
            aria-label="Network"
            value={network}
            onChange={(event) => {
              setNetwork(event.target.value as NetworkId);
              setScan({ kind: "idle" });
            }}
          >
            {networks.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        ) : null}
        <button type="button" className="primary" onClick={loadPayments} disabled={scan.kind === "loading"}>
          {scan.kind === "loading" ? "Loading payments" : "Connect wallet and load payments"}
        </button>

        <div aria-live="polite">
          {scan.kind === "error" ? <p className="error">{scan.message}</p> : null}
          {scan.kind === "done" && scan.payments.length === 0 ? (
            <p>No recent payments to {shortAddress(scan.address)}. Older ones are on the Arc explorer.</p>
          ) : null}
        </div>

        {scan.kind === "done" && scan.payments.length > 0 ? (
          <ul className="ledger">
            {scan.payments.map((payment) => (
              <li key={`${payment.hash}-${payment.token}-${payment.amount}`}>
                <span className="ledger-amount">{formatAmount(payment.amount)} {payment.token}</span>
                <span>From <span className="address">{shortAddress(payment.from)}</span></span>
                <a href={`${explorer}/tx/${payment.hash}`} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2>Links you created</h2>
        <p>Saved in this browser only. Clearing your browser data removes this list, not the links.</p>
        {links.length === 0 ? (
          <p>You have no links yet. <Link href="/">Create your first link</Link>.</p>
        ) : (
          <ul className="ledger">
            {links.map((link) => (
              <li key={`${link.createdAt}-${link.to}`}>
                <span className="ledger-amount">{formatAmount(link.amount)} {link.token}</span>
                <span>{link.note || new Date(link.createdAt).toLocaleDateString()}</span>
                <a href={buildPayPath(link)}>Open link</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
