"use client";

import { useState, type FormEvent } from "react";
import { isAddress, getAddress, type Address } from "viem";
import { Slip } from "@/components/Slip";
import {
  availableNetworks,
  NETWORKS,
  TOKEN_SYMBOLS,
  type NetworkId,
  type TokenSymbol,
} from "@/lib/networks";
import { amountError, buildPayPath, cleanNote, NOTE_MAX_LENGTH, type PaymentLink } from "@/lib/paymentLink";
import { saveCreatedLink } from "@/lib/storage";
import { connectWallet, friendlyError } from "@/lib/wallet";

type Errors = { to?: string; amount?: string; wallet?: string };

function addressError(value: string): string | undefined {
  if (!value) return "Enter the wallet address that should receive the payment.";
  if (!isAddress(value, { strict: true })) return "This is not a valid wallet address. Check it for typos.";
  return undefined;
}

export default function CreatePage() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [note, setNote] = useState("");
  const [network, setNetwork] = useState<NetworkId>("testnet");
  const [errors, setErrors] = useState<Errors>({});
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const networks = availableNetworks();
  const validAddress = isAddress(to, { strict: true }) ? getAddress(to) : "";
  const previewAmount = amountError(amount) ? "" : amount;

  const resetResult = () => {
    setCreated(null);
    setCopied(false);
  };

  const useWallet = async () => {
    setErrors((current) => ({ ...current, wallet: undefined, to: undefined }));
    try {
      setTo(await connectWallet());
      resetResult();
    } catch (error) {
      setErrors((current) => ({ ...current, wallet: friendlyError(error) }));
    }
  };

  const createLink = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Errors = {
      to: addressError(to),
      amount: amountError(amount) ?? undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.to || nextErrors.amount) return;

    const link: PaymentLink = {
      to: getAddress(to) as Address,
      amount,
      token,
      network,
      note: cleanNote(note),
    };
    saveCreatedLink(link);
    setCopied(false);
    setCreated(`${window.location.origin}${buildPayPath(link)}`);
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="create-layout">
      <section className="create-form">
        <h1>Get paid with a link</h1>
        <p className="lede">
          Enter what you are owed and send the link to your client. They pay from their own wallet,
          directly to yours.
        </p>

        <form onSubmit={createLink} noValidate>
          <div className="field">
            <label htmlFor="to">Your wallet address</label>
            <input
              id="to"
              className="address"
              value={to}
              onChange={(event) => {
                setTo(event.target.value.trim());
                resetResult();
              }}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={Boolean(errors.to)}
              aria-describedby={errors.to ? "to-error" : undefined}
            />
            {errors.to ? <p id="to-error" className="error">{errors.to}</p> : null}
            <button type="button" className="text-button" onClick={useWallet}>
              Use my connected wallet
            </button>
            {errors.wallet ? <p role="alert" className="error">{errors.wallet}</p> : null}
          </div>

          <div className="field amount-field">
            <label htmlFor="amount">Amount</label>
            <div className="amount-row">
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value.trim());
                  resetResult();
                }}
                placeholder="250.00"
                autoComplete="off"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "amount-error" : undefined}
              />
              <fieldset className="token-choice">
                <legend className="visually-hidden">Currency</legend>
                {TOKEN_SYMBOLS.map((symbol) => (
                  <label key={symbol}>
                    <input
                      type="radio"
                      name="token"
                      checked={token === symbol}
                      onChange={() => {
                        setToken(symbol);
                        resetResult();
                      }}
                    />
                    <span>{symbol}</span>
                  </label>
                ))}
              </fieldset>
            </div>
            {errors.amount ? <p id="amount-error" className="error">{errors.amount}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="note">What is it for? (optional)</label>
            <input
              id="note"
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              onChange={(event) => {
                setNote(event.target.value);
                resetResult();
              }}
              placeholder="Logo design, invoice 014"
              autoComplete="off"
            />
            <p className="hint">Anyone with the link can read this note.</p>
          </div>

          {networks.length > 1 ? (
            <div className="field">
              <label htmlFor="network">Network</label>
              <select
                id="network"
                value={network}
                onChange={(event) => {
                  setNetwork(event.target.value as NetworkId);
                  resetResult();
                }}
              >
                {networks.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button type="submit" className="primary">Create link</button>
        </form>
      </section>

      <section className="create-preview" aria-label="Payment link preview">
        <Slip
          to={validAddress}
          amount={previewAmount}
          token={token}
          note={cleanNote(note)}
          networkName={NETWORKS[network].name}
        />

        {created ? (
          <div className="result" role="status">
            <h2>Your link is ready</h2>
            <p className="result-link">{created}</p>
            <div className="result-actions">
              <button type="button" className="primary" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="secondary" href={created}>Open link</a>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
