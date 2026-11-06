import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  numberToHex,
  parseAbiItem,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { NETWORKS, toChain, type Network, type TokenSymbol } from "./networks";
import type { PaymentLink } from "./paymentLink";
import { receiptPaysLink } from "./verify";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export class UserFacingError extends Error {}

const NO_WALLET = "No browser wallet found. Install Rabby or MetaMask, then reload this page.";

function getProvider(): EIP1193Provider {
  if (typeof window === "undefined" || !window.ethereum) throw new UserFacingError(NO_WALLET);
  return window.ethereum;
}

// viem can nest a wallet's error several layers deep, so follow the whole chain of causes.
const errorCode = (error: unknown): number | undefined => {
  let current = error as { code?: number; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 10; depth += 1) {
    if (typeof current.code === "number") return current.code;
    current = current.cause as typeof current;
  }
  return undefined;
};

export function friendlyError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (errorCode(error) === 4001) return "You rejected the request in your wallet. Nothing was sent.";
  const message = (error as { shortMessage?: string })?.shortMessage;
  return message
    ? `The request failed: ${message}`
    : "The request failed. Check your connection and try again.";
}

const publicClient = (network: Network) =>
  createPublicClient({ chain: toChain(network), transport: http(network.rpcUrl) });

export async function connectWallet(): Promise<Address> {
  const [account] = await createWalletClient({ transport: custom(getProvider()) }).requestAddresses();
  if (!account) throw new UserFacingError("Your wallet did not share an address. Unlock it and try again.");
  return account;
}

async function switchToNetwork(network: Network) {
  const provider = getProvider();
  const chainId = numberToHex(network.chainId);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (errorCode(error) !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: network.name,
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorer],
        },
      ],
    });
  }
}

async function expectedValue(network: Network, link: PaymentLink) {
  const token = network.tokens[link.token];
  // Arc's docs say to ask the token for its decimals rather than hardcoding them.
  const decimals = await publicClient(network).readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return { token, decimals, value: parseUnits(link.amount, decimals) };
}

export type PayStep = "connecting" | "checking" | "confirming" | "settling";

export async function payLink(
  link: PaymentLink,
  onStep: (step: PayStep) => void,
  onSubmitted: (hash: Hash) => void,
): Promise<Hash> {
  const network = NETWORKS[link.network];
  const chain = toChain(network);

  onStep("connecting");
  const account = await connectWallet();
  await switchToNetwork(network);

  onStep("checking");
  const client = publicClient(network);
  const { token, decimals, value } = await expectedValue(network, link);
  const balance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  if (balance < value) {
    throw new UserFacingError(
      `This wallet has ${formatUnits(balance, decimals)} ${link.token}, which is less than the ${link.amount} ${link.token} requested.`,
    );
  }
  const { request } = await client.simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [link.to, value],
    chain,
  });

  onStep("confirming");
  const walletClient = createWalletClient({ account, chain, transport: custom(getProvider()) });
  const hash = await walletClient.writeContract(request);
  onSubmitted(hash);

  onStep("settling");
  await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return hash;
}

export type VerifyResult = "verified" | "mismatch" | "not-found";

export async function verifyPayment(link: PaymentLink, hash: Hash): Promise<VerifyResult> {
  const network = NETWORKS[link.network];
  const { token, value } = await expectedValue(network, link);
  let receipt;
  try {
    receipt = await publicClient(network).getTransactionReceipt({ hash });
  } catch (error) {
    if ((error as Error).name === "TransactionReceiptNotFoundError") return "not-found";
    throw error;
  }
  return receiptPaysLink(receipt, { token, to: link.to, value }) ? "verified" : "mismatch";
}

export type IncomingPayment = {
  hash: Hash;
  from: Address;
  amount: string;
  token: TokenSymbol;
  blockNumber: bigint;
};

const SCAN_BATCH_BLOCKS = BigInt(5_000);
const SCAN_BATCHES = 4;

// Reads recent transfers straight from the chain, so there is no server keeping payment records.
export async function loadIncomingPayments(
  network: Network,
  to: Address,
  token: TokenSymbol,
): Promise<IncomingPayment[]> {
  const client = publicClient(network);
  const address = network.tokens[token];
  const decimals = await client.readContract({ address, abi: erc20Abi, functionName: "decimals" });
  const event = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  );
  const zero = BigInt(0);

  let toBlock = await client.getBlockNumber();
  const payments: IncomingPayment[] = [];
  for (let batch = 0; batch < SCAN_BATCHES && toBlock >= zero; batch += 1) {
    const span = SCAN_BATCH_BLOCKS - BigInt(1);
    const fromBlock = toBlock > span ? toBlock - span : zero;
    const logs = await client.getLogs({ address, event, args: { to }, fromBlock, toBlock });
    for (const log of [...logs].reverse()) {
      payments.push({
        hash: log.transactionHash,
        from: log.args.from as Address,
        amount: formatUnits(log.args.value as bigint, decimals),
        token,
        blockNumber: log.blockNumber,
      });
    }
    if (fromBlock === zero) break;
    toBlock = fromBlock - BigInt(1);
  }
  return payments;
}
