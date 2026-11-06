import { defineChain, type Address } from "viem";

export type NetworkId = "testnet" | "mainnet";
export type TokenSymbol = "USDC" | "EURC";

export const TOKEN_SYMBOLS: TokenSymbol[] = ["USDC", "EURC"];

export type Network = {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  tokens: Record<TokenSymbol, Address>;
};

// Values from https://docs.arc.io/arc/references/connect-to-arc and /contract-addresses.
export const NETWORKS: Record<NetworkId, Network> = {
  testnet: {
    id: "testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.io",
    explorer: "https://explorer.testnet.arc.io",
    tokens: {
      USDC: "0x3600000000000000000000000000000000000000",
      EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    },
  },
  mainnet: {
    id: "mainnet",
    name: "Arc",
    chainId: 5042,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorer: "https://explorer.arc.io",
    tokens: {
      USDC: "0x3600000000000000000000000000000000000000",
      EURC: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
    },
  },
};

export const FAUCET_URL = "https://faucet.circle.com";

export const mainnetEnabled = process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true";

export const availableNetworks = (): Network[] =>
  mainnetEnabled ? [NETWORKS.testnet, NETWORKS.mainnet] : [NETWORKS.testnet];

export const toChain = (network: Network) =>
  defineChain({
    id: network.chainId,
    name: network.name,
    // Arc's native gas token is USDC, exposed with 18 decimals at the native level.
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [network.rpcUrl] } },
    blockExplorers: { default: { name: "Arc Explorer", url: network.explorer } },
  });
