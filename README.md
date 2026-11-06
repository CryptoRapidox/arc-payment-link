# Slip: USDC payment links on Arc

Create a link for a USDC or EURC payment, send it to a client, and let them pay from their own wallet. The app confirms each payment by reading the transaction from the Arc network.

Slip is an independent open-source project. It is not affiliated with Arc or Circle.

> **Status:** early test version. It runs on Arc Testnet by default, and its wallet flow still needs a full test against the live network.

## How it works

- **No backend and no custody.** Payments go directly from the payer's wallet to the recipient. The app never holds funds or asks for a private key.
- **The link holds the request.** The recipient, amount, currency, network, and note are all in the URL. Anyone with the link can read them.
- **Payments are checked on chain.** A payment counts only if the token contract logged an exact transfer of the requested amount to the recipient.
- **History has two sources.** Received payments are read from the network, and the list of created links stays in your browser.

## Limits to know about

- A link can be paid more than once. The app warns a payer only if the same browser has already paid it.
- The note is not stored on chain, so it does not prove what a transfer was for.
- The received payments list covers recent blocks only. Use the Arc explorer for older payments.

## Run it

Requires Node.js 20 or newer and a browser wallet such as Rabby or MetaMask.

```bash
npm install
npm run dev
```

Get test tokens from the [Circle faucet](https://faucet.circle.com), selecting Arc Testnet.

```bash
npm test           # unit tests
npm run typecheck  # type checks
npm run build      # static site in out/
```

The site in `out/` can be hosted on any static host.

## Mainnet

Mainnet moves real money and is off by default. To turn it on, set `NEXT_PUBLIC_ENABLE_MAINNET=true` at build time, and only after a complete test on Arc Testnet.

## License

MIT
