/**
 * Stellar Network Configuration — Soroban RPC & Contract Constants
 *
 * Defines network endpoints, contract IDs, and explorer URLs for the
 * Revora revenue-deposit contract on Stellar testnet.
 */

import { Networks } from '@stellar/stellar-sdk';

export type NetworkType = 'TESTNET' | 'PUBLIC';

export const DEFAULT_NETWORK: NetworkType = 'TESTNET';
export const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;
export const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
export const DEFAULT_CONTRACT_ID = 'CABIJLQV4TKBHMETNIISV4OT76EDR5WXCZVJJLXHA6AEIII2JVYAHP2I';
export const DEFAULT_EXPLORER_BASE = 'https://stellar.expert/explorer/testnet';
export const DEFAULT_STELLAR_LAB_BASE = 'https://lab.stellar.org/r/testnet';

/**
 * Validates that a string is a valid Stellar contract ID (starts with 'C' and is 56 chars)
 */
function isValidContractId(id: string): boolean {
  return typeof id === 'string' && id.length === 56 && id.startsWith('C');
}

/**
 * Validates that a URL string is a valid HTTPS URL
 */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates network type
 */
function isValidNetwork(network: string): network is NetworkType {
  return network === 'TESTNET' || network === 'PUBLIC';
}

/**
 * Reads an environment variable with validation and fallback to default.
 * Logs an error to console and falls back to default if validation fails.
 */
function getEnvVarWithFallback<T>(
  envVarName: string,
  defaultValue: T,
  validator: (value: string) => boolean,
): T {
  const envValue = import.meta.env[envVarName];
  
  if (envValue === undefined || envValue === '') {
    return defaultValue;
  }

  if (!validator(envValue)) {
    console.error(
      `[Stellar Config] Invalid ${envVarName}: "${envValue}". Falling back to default:`,
      defaultValue,
    );
    return defaultValue;
  }

  return envValue as T;
}

/**
 * Network configuration with environment variable overrides.
 * Override with VITE_STELLAR_NETWORK, VITE_STELLAR_RPC_URL, etc.
 */
export const NETWORK = getEnvVarWithFallback(
  'VITE_STELLAR_NETWORK',
  DEFAULT_NETWORK,
  isValidNetwork,
);

export const NETWORK_PASSPHRASE = getEnvVarWithFallback(
  'VITE_STELLAR_NETWORK_PASSPHRASE',
  DEFAULT_NETWORK_PASSPHRASE,
  () => true, // Network passphrase can be any string
);

export const RPC_URL = getEnvVarWithFallback(
  'VITE_STELLAR_RPC_URL',
  DEFAULT_RPC_URL,
  isValidHttpsUrl,
);

export const CONTRACT_ID = getEnvVarWithFallback(
  'VITE_STELLAR_CONTRACT_ID',
  DEFAULT_CONTRACT_ID,
  isValidContractId,
);

export const EXPLORER_BASE = getEnvVarWithFallback(
  'VITE_STELLAR_EXPLORER_BASE',
  DEFAULT_EXPLORER_BASE,
  isValidHttpsUrl,
);

export const STELLAR_LAB_BASE = getEnvVarWithFallback(
  'VITE_STELLAR_LAB_BASE',
  DEFAULT_STELLAR_LAB_BASE,
  isValidHttpsUrl,
);

/**
 * Helper to build explorer URLs for contracts and transactions
 */
export function buildContractExplorerUrl(contractId: string = CONTRACT_ID): string {
  return `${EXPLORER_BASE}/contract/${contractId}`;
}

export function buildStellarLabUrl(contractId: string = CONTRACT_ID): string {
  return `${STELLAR_LAB_BASE}/contract/${contractId}`;
}

export function buildTransactionExplorerUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export type AppStellarNetwork = 'testnet' | 'public';
export const APP_STELLAR_NETWORK: AppStellarNetwork =
  NETWORK === 'PUBLIC' ? 'public' : 'testnet';
