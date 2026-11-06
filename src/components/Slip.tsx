import { GUILLOCHE_HEIGHT, GUILLOCHE_WIDTH, guillochePaths } from "@/lib/guilloche";
import { chunkAddress, formatAmount } from "@/lib/paymentLink";
import type { ReactNode } from "react";

type SlipProps = {
  to: string;
  amount: string;
  token: string;
  note?: string;
  networkName: string;
  stamp?: ReactNode;
};

// Blank seed used until the sender has entered an address.
const EMPTY_SEED = "0x5c1b7e93a04fd2688e31c7a95d0b46f2";

export function Slip({ to, amount, token, note, networkName, stamp }: SlipProps) {
  const { primary, secondary } = guillochePaths(to || EMPTY_SEED);
  return (
    <article className="slip">
      <svg
        className="slip-pattern"
        viewBox={`0 0 ${GUILLOCHE_WIDTH} ${GUILLOCHE_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g className="pattern-rose">
          {secondary.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
        <g className="pattern-ink">
          {primary.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
      </svg>

      <div className="slip-body">
        <p className="slip-amount">
          <span className="slip-figure">{amount ? formatAmount(amount) : "0.00"}</span>
          <span className="slip-token">{token}</span>
        </p>

        <dl className="slip-details">
          <div>
            <dt>Pay to</dt>
            <dd className="address">{to ? `0x ${chunkAddress(to)}` : "Your wallet address appears here"}</dd>
          </div>
          {note ? (
            <div>
              <dt>For</dt>
              <dd>{note}</dd>
            </div>
          ) : null}
          <div>
            <dt>Network</dt>
            <dd>{networkName}</dd>
          </div>
        </dl>
        {stamp}
      </div>
    </article>
  );
}
