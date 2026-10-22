export type TwoFactorMethod = 'totp' | 'sms';

export interface TwoFactorVerificationRequest {
  method: TwoFactorMethod;
  code: string;
  secret?: string;
}

export type VerifyTwoFactorCode = (
  request: TwoFactorVerificationRequest,
) => boolean | Promise<boolean>;

export interface TotpVerificationOptions {
  /** Epoch milliseconds used to calculate the TOTP counter. Defaults to Date.now(). */
  now?: number;
  /** TOTP period in seconds. */
  period?: number;
  /** Number of neighbouring periods accepted on either side of the current one. */
  window?: number;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string): ArrayBuffer {
  const normalized = value.replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase();
  if (!normalized) {
    throw new Error('TOTP secret must not be empty.');
  }

  let bits = '';
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error('TOTP secret contains invalid base32 characters.');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  if (bytes.length === 0) {
    throw new Error('TOTP secret is too short.');
  }

  return Uint8Array.from(bytes).buffer;
}

function counterBytes(counter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(counter), false);
  return buffer;
}

async function generateTotp(secret: ArrayBuffer, counter: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API is unavailable.');
  }

  const key = await subtle.importKey(
    'raw',
    new Uint8Array(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await subtle.sign('HMAC', key, new Uint8Array(counterBytes(counter))));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, '0');
}

/**
 * Verify a six-digit RFC 6238 TOTP code against a base32 secret.
 *
 * A one-period clock-skew window is accepted by default. Malformed codes are
 * rejected with `false`; malformed secrets or unavailable crypto surface as
 * errors so callers can distinguish invalid user input from setup failures.
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  options: TotpVerificationOptions = {},
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const period = options.period ?? 30;
  const window = options.window ?? 1;
  const now = options.now ?? Date.now();

  if (!Number.isFinite(now) || now < 0) {
    throw new Error('TOTP verification time must be a non-negative finite number.');
  }
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('TOTP period must be a positive integer.');
  }
  if (!Number.isInteger(window) || window < 0) {
    throw new Error('TOTP window must be a non-negative integer.');
  }

  const decodedSecret = decodeBase32(secret);
  const currentCounter = Math.floor(now / 1000 / period);

  for (let delta = -window; delta <= window; delta += 1) {
    const counter = currentCounter + delta;
    if (counter < 0) continue;
    if ((await generateTotp(decodedSecret, counter)) === code) {
      return true;
    }
  }

  return false;
}
