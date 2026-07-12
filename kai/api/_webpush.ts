/* ============================================================
   EDGE WEB PUSH (§14.2 fix) — send Web Push from the Edge runtime with
   nothing but WebCrypto. Replaces the Node-only `web-push` library so
   /api/pulse can stay on the proven Edge runtime (where every other KAI
   function runs). Implements RFC 8291 (aes128gcm payload encryption) +
   RFC 8292 (VAPID). Pure and dependency-free — encrypt↔decrypt round-
   trips are unit-testable without a real push service.
   ============================================================ */

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface Vapid { publicKey: string; privateKey: string; subject: string; }

/* ── base64url ─────────────────────────────────────────────── */
export function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
const utf8 = (s: string) => new TextEncoder().encode(s);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

/* ── RFC 8291 aes128gcm encryption ─────────────────────────── */
export interface Encrypted { body: Uint8Array; }

export async function encryptPush(sub: PushSubscription, payload: string, saltIn?: Uint8Array, asKeysIn?: CryptoKeyPair): Promise<Encrypted> {
  const uaPublic = b64urlToBytes(sub.keys.p256dh);   // 65 bytes
  const authSecret = b64urlToBytes(sub.keys.auth);   // 16 bytes
  const salt = saltIn || crypto.getRandomValues(new Uint8Array(16));

  const asKeys = asKeysIn || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));   // 65 bytes
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  /* IKM = HKDF(auth_secret, ecdh, "WebPush: info\0" || ua || as, 32) */
  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const plaintext = concat(utf8(payload), new Uint8Array([0x02]));   // 0x02 = last-record delimiter
  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 }, cekKey, plaintext as BufferSource));

  /* RFC 8188 header: salt(16) | rs(uint32be=4096) | idlen(1=65) | keyid(as_public) */
  const rs = new Uint8Array([0, 0, 0x10, 0]);   // 4096
  const idlen = new Uint8Array([asPublic.length]);
  const body = concat(salt, rs, idlen, asPublic, ct);
  return { body };
}

/* ── RFC 8292 VAPID JWT (ES256) ────────────────────────────── */
export async function vapidAuthHeader(endpoint: string, vapid: Vapid, nowSec: number): Promise<string> {
  const origin = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: origin, exp: nowSec + 12 * 60 * 60, sub: vapid.subject };
  const signingInput = bytesToB64url(utf8(JSON.stringify(header))) + '.' + bytesToB64url(utf8(JSON.stringify(payload)));

  /* reconstruct the private JWK (d + x,y from the public point). */
  const pub = b64urlToBytes(vapid.publicKey);   // 0x04 || x(32) || y(32)
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput) as BufferSource));   // raw r||s (64 bytes)
  const jwt = signingInput + '.' + bytesToB64url(sig);
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

/* ── send ──────────────────────────────────────────────────── */
export async function sendPush(sub: PushSubscription, payload: string, vapid: Vapid, nowMs = Date.now()): Promise<number> {
  const { body } = await encryptPush(sub, payload);
  const auth = await vapidAuthHeader(sub.endpoint, vapid, Math.floor(nowMs / 1000));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'ttl': '86400',
      'urgency': 'normal',
      'authorization': auth,
    },
    body: body as BodyInit,
  });
  return res.status;   // 201 = accepted; 404/410 = expired subscription
}
