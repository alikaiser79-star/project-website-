/* ============================================================
   KAI biometric / PIN lock.

   Device-local gating — NOT server-grade auth. There is no
   backend verification. WebAuthn credentials live on the
   platform authenticator (Touch ID / Face ID / Windows Hello /
   Android biometric). The PIN is stored as SHA-256(salt|pin)
   in localStorage, salt is per-install random. Both layers are
   convenience — anyone with the unlocked device + the PIN, or
   the unlocked device + biometric, gets in.

   API:
     loadLockConfig / saveLockConfig — persistence
     isLockSupported               — true if WebAuthn OR Crypto.subtle works
     platformAuthAvailable         — async, true if device has built-in biometric
     registerCredential            — create WebAuthn credential (returns base64url id)
     verifyCredential              — assertion against stored credentialId
     setPin / verifyPin            — PIN hashing + check
     clearLock                     — wipe config
   ============================================================ */

const KEY = 'kai.lock.v1';

export type LockConfig = {
  /* User has been asked at least once whether to set up the lock. */
  offered: boolean;
  /* Lock is currently enabled — overlay required on launch. */
  enabled: boolean;
  /* Base64url-encoded WebAuthn credential id, when biometric is registered. */
  credentialId?: string;
  /* PIN salt (base64url) and SHA-256 hash of (salt|pin) hex. */
  pinSalt?: string;
  pinHash?: string;
};

const DEFAULT: LockConfig = { offered: false, enabled: false };

export function loadLockConfig(): LockConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT };
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveLockConfig(cfg: LockConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}

export function clearLock() {
  try { localStorage.removeItem(KEY); } catch {}
}

/* ── Capability checks ──────────────────────────────────── */

export function webAuthnSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as any).PublicKeyCredential !== 'undefined'
    && !!navigator.credentials
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function';
}

export function subtleSupported(): boolean {
  return typeof window !== 'undefined'
    && !!window.crypto
    && !!window.crypto.subtle;
}

export function isLockSupported(): boolean {
  return webAuthnSupported() || subtleSupported();
}

export async function platformAuthAvailable(): Promise<boolean> {
  if (!webAuthnSupported()) return false;
  const PKC: any = (window as any).PublicKeyCredential;
  try {
    if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return !!(await PKC.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/* ── Encoding helpers ──────────────────────────────────── */

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

function b64urlFromBytes(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s.replace(/-/g, '+').replace(/_/g, '/')) + pad;
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── WebAuthn ──────────────────────────────────────────── */

/* RP id must match the current hostname. On localhost the spec
   allows "localhost" without HTTPS. */
function rpId(): string {
  return location.hostname || 'localhost';
}

export async function registerCredential(displayName: string): Promise<string> {
  if (!webAuthnSupported()) throw new Error('WebAuthn not supported');

  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: { name: 'KAI', id: rpId() },
      user: {
        id: userId as BufferSource,
        name: displayName || 'kai-operator',
        displayName: displayName || 'KAI Operator',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7   }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!cred || !cred.rawId) throw new Error('No credential returned');
  return b64urlFromBytes(cred.rawId);
}

export async function verifyCredential(credentialId: string): Promise<boolean> {
  if (!webAuthnSupported()) return false;
  const challenge = randomBytes(32);
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId: rpId(),
        timeout: 60_000,
        userVerification: 'required',
        allowCredentials: [{
          type: 'public-key',
          id: bytesFromB64url(credentialId) as BufferSource,
          transports: ['internal'],
        }],
      },
    }) as PublicKeyCredential | null;
    return !!assertion;
  } catch {
    return false;
  }
}

/* ── PIN ─────────────────────────────────────────────────
   SHA-256(salt-bytes || utf8(pin)) → hex. Per-install random
   salt. We can't run PBKDF2 stretching well without a worker
   here, and a 4-6 digit PIN on a device-local store doesn't
   meaningfully benefit from stretching against a determined
   attacker who already has the disk — the threat model is
   casual shoulder-surfing, not forensic. */

function pinKeyMaterial(pin: string, saltB64u: string): Uint8Array {
  const salt = bytesFromB64url(saltB64u);
  const enc = new TextEncoder().encode(pin);
  const out = new Uint8Array(new ArrayBuffer(salt.length + enc.length));
  out.set(salt, 0);
  out.set(enc, salt.length);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const arr = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, '0');
  return hex;
}

export async function setPin(pin: string, cfg: LockConfig): Promise<LockConfig> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4-6 digits');
  if (!subtleSupported()) throw new Error('Crypto not available');
  const salt = b64urlFromBytes(randomBytes(16));
  const hash = await sha256Hex(pinKeyMaterial(pin, salt));
  return { ...cfg, pinSalt: salt, pinHash: hash };
}

export async function verifyPin(pin: string, cfg: LockConfig): Promise<boolean> {
  if (!cfg.pinHash || !cfg.pinSalt) return false;
  if (!subtleSupported()) return false;
  if (!/^\d{4,6}$/.test(pin)) return false;
  const hash = await sha256Hex(pinKeyMaterial(pin, cfg.pinSalt));
  return constantTimeEqual(hash, cfg.pinHash);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
