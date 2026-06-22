/* ============================================================
   KAI lock overlay.

   Two modes:
   - 'setup'  → first-run "Protect KAI" screen. Enable biometric,
                set a PIN, or skip. Always offers a PIN so the
                user can't be locked out if Face ID later fails.
   - 'unlock' → full-screen gate shown on launch (and after long
                idle) when lock is enabled. Triggers WebAuthn
                immediately on mount, then falls back to PIN if
                the user prefers or biometric fails 3 times.

   Device-local gating, NOT server-grade auth — see lib/lock.ts.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  type LockConfig,
  loadLockConfig, saveLockConfig,
  platformAuthAvailable, webAuthnSupported,
  registerCredential, verifyCredential,
  setPin, verifyPin,
} from '../lib/lock';

type Props = {
  mode: 'setup' | 'unlock';
  /* unlock: dashboard reveals on success.
     setup:  whether the user enabled the lock and/or skipped. */
  onUnlocked: () => void;
  onSetupDone: (cfg: LockConfig) => void;
  /* For settings → "turn off lock" flow: lets us short-circuit
     the post-success behaviour without revealing dashboard. */
  reason?: string;
};

export default function LockOverlay({ mode, onUnlocked, onSetupDone, reason }: Props) {
  /* Setup state. */
  const [bioReady, setBioReady]   = useState(false);
  const [bioBusy, setBioBusy]     = useState(false);
  const [bioOk,   setBioOk]       = useState(false);
  const [pin, setPinValue]        = useState('');
  const [pin2, setPin2]           = useState('');
  const [err, setErr]             = useState<string | null>(null);
  const [okMsg, setOkMsg]         = useState<string | null>(null);

  /* Unlock state. */
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [bioFails, setBioFails]     = useState(0);
  const [pinInput, setPinInput]     = useState('');
  const [showPin, setShowPin]       = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const autoTriedRef = useRef(false);

  const cfg = loadLockConfig();

  useEffect(() => {
    platformAuthAvailable().then(setBioReady);
  }, []);

  /* Auto-trigger biometric once on unlock mount (if available
     and a credential exists). */
  useEffect(() => {
    if (mode !== 'unlock') return;
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    if (cfg.credentialId && webAuthnSupported()) {
      /* tiny delay to let the overlay render first */
      const id = setTimeout(() => tryBiometricUnlock(), 350);
      return () => clearTimeout(id);
    } else if (cfg.pinHash) {
      setShowPin(true);
      setTimeout(() => pinRef.current?.focus(), 200);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Setup actions ──────────────────────────────────── */

  async function enableBiometric() {
    setErr(null);
    setBioBusy(true);
    try {
      const credentialId = await registerCredential('KAI Operator');
      const next: LockConfig = { ...loadLockConfig(), credentialId };
      saveLockConfig(next);
      setBioOk(true);
      setOkMsg('Face ID / biometric registered.');
    } catch (e: any) {
      setErr(humanizeWebAuthnError(e));
    } finally {
      setBioBusy(false);
    }
  }

  async function confirmSetup() {
    setErr(null);
    let next: LockConfig = loadLockConfig();

    if (pin || pin2) {
      if (pin !== pin2)             { setErr("PINs don't match.");           return; }
      if (!/^\d{4,6}$/.test(pin))   { setErr('PIN must be 4-6 digits.');     return; }
      try {
        next = await setPin(pin, next);
      } catch (e: any) {
        setErr(e?.message || 'Could not set PIN.');
        return;
      }
    }

    /* Must have SOME unlock method to enable. */
    if (!next.credentialId && !next.pinHash) {
      setErr('Set a PIN or enable Face ID before turning the lock on.');
      return;
    }

    next = { ...next, enabled: true, offered: true };
    saveLockConfig(next);
    onSetupDone(next);
  }

  function skipSetup() {
    const next: LockConfig = { ...loadLockConfig(), offered: true, enabled: false };
    saveLockConfig(next);
    onSetupDone(next);
  }

  /* ── Unlock actions ─────────────────────────────────── */

  async function tryBiometricUnlock() {
    if (!cfg.credentialId) return;
    setUnlockBusy(true);
    setErr(null);
    try {
      const ok = await verifyCredential(cfg.credentialId);
      if (ok) {
        onUnlocked();
      } else {
        bumpFails();
      }
    } catch (e: any) {
      bumpFails();
      setErr(humanizeWebAuthnError(e));
    } finally {
      setUnlockBusy(false);
    }
  }

  function bumpFails() {
    setBioFails(n => {
      const next = n + 1;
      if (next >= 2 && cfg.pinHash) {
        setShowPin(true);
        setTimeout(() => pinRef.current?.focus(), 100);
      }
      return next;
    });
  }

  async function tryPinUnlock() {
    setErr(null);
    if (!/^\d{4,6}$/.test(pinInput)) { setErr('Enter your 4-6 digit PIN.'); return; }
    const ok = await verifyPin(pinInput, cfg);
    if (ok) {
      onUnlocked();
    } else {
      setErr('Wrong PIN.');
      setPinInput('');
      setTimeout(() => pinRef.current?.focus(), 30);
    }
  }

  /* ── Render ─────────────────────────────────────────── */

  return (
    <motion.div
      key="lock-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: 'rgba(8,11,16,0.92)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ y: 12, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass w-full max-w-[460px] rounded-md overflow-hidden"
      >
        <header className="flex items-center gap-2 px-5 py-4 border-b border-amber/15">
          <ShieldCheck size={14} className="text-amber" />
          <h3 className="font-sans text-bone text-sm tracking-wide">
            {mode === 'setup' ? 'Protect KAI' : 'KAI Locked'}
          </h3>
          <span className="ml-auto font-mono text-[10px] tracking-[0.22em] uppercase text-steel">
            {reason || (mode === 'setup' ? 'first run' : 'auth required')}
          </span>
        </header>

        <div className="px-5 py-5 space-y-5 font-mono text-[12px]">
          {mode === 'setup' && (
            <>
              <p className="text-bone/80 leading-relaxed">
                Lock KAI behind your device biometric — Face&nbsp;ID on iPhone,
                fingerprint on Android, Touch&nbsp;ID or Windows Hello on
                desktop. A 4-6 digit PIN is the backup so you can't get
                locked out.
              </p>

              {webAuthnSupported() ? (
                <button
                  onClick={enableBiometric}
                  disabled={bioBusy || bioOk}
                  className={
                    'w-full flex items-center justify-center gap-2 px-3 py-3 rounded border ' +
                    (bioOk
                      ? 'border-emerald/50 text-emerald bg-emerald/10'
                      : 'border-amber/50 text-amber hover:bg-amber/10 hover:shadow-glow-amber') +
                    ' transition disabled:opacity-50'
                  }
                >
                  <Fingerprint size={14} />
                  {bioOk
                    ? 'Biometric registered'
                    : bioBusy
                      ? 'Waiting for authenticator…'
                      : bioReady
                        ? 'Enable Face ID / biometric'
                        : 'Try biometric anyway'}
                </button>
              ) : (
                <div className="px-3 py-2 border border-amber/15 rounded text-steel text-[11px] leading-relaxed">
                  This browser doesn't expose biometric APIs. PIN lock only.
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] tracking-[0.18em] text-steel uppercase">
                  Backup PIN (4-6 digits) — required
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••"
                  className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone tabular-nums tracking-[0.4em] outline-none"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  value={pin2}
                  onChange={e => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="confirm"
                  className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone tabular-nums tracking-[0.4em] outline-none"
                />
              </div>

              {err   && <div className="text-danger text-[11px] leading-relaxed">{err}</div>}
              {okMsg && !err && <div className="text-emerald text-[11px] leading-relaxed">{okMsg}</div>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={skipSetup}
                  className="px-3 py-2 border border-steel/30 text-steel hover:text-bone hover:border-steel rounded text-[11px] tracking-[0.16em] uppercase"
                >
                  Skip
                </button>
                <button
                  onClick={confirmSetup}
                  className="ml-auto px-4 py-2 border border-amber text-amber hover:bg-amber/10 hover:shadow-glow-amber rounded text-[11px] tracking-[0.16em] uppercase"
                >
                  Turn lock on
                </button>
              </div>

              <p className="pt-1 text-[10px] text-steel/70 leading-relaxed">
                Device-local convenience lock. No backend verification —
                this is shoulder-surfing protection, not banking-grade auth.
              </p>
            </>
          )}

          {mode === 'unlock' && (
            <>
              <div className="flex items-center justify-center py-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-amber/20 blur-xl animate-pulse-soft" />
                  <div className="relative w-20 h-20 rounded-full border border-amber/40 grid place-items-center bg-ink2/40">
                    <Fingerprint size={36} className="text-amber" />
                  </div>
                </div>
              </div>

              {cfg.credentialId && webAuthnSupported() && (
                <button
                  onClick={tryBiometricUnlock}
                  disabled={unlockBusy}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded border border-amber/50 text-amber hover:bg-amber/10 hover:shadow-glow-amber transition disabled:opacity-50"
                >
                  <Fingerprint size={14} />
                  {unlockBusy ? 'Waiting for authenticator…' : 'Unlock with biometric'}
                </button>
              )}

              {cfg.pinHash && (
                <>
                  {!showPin && (
                    <button
                      onClick={() => { setShowPin(true); setTimeout(() => pinRef.current?.focus(), 50); }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-steel/30 text-steel hover:text-bone hover:border-steel text-[11px] tracking-[0.16em] uppercase"
                    >
                      <KeyRound size={12} /> Use PIN instead
                    </button>
                  )}

                  {showPin && (
                    <div className="space-y-2">
                      <label className="block text-[10px] tracking-[0.18em] text-steel uppercase">PIN</label>
                      <input
                        ref={pinRef}
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="current-password"
                        maxLength={6}
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => { if (e.key === 'Enter') tryPinUnlock(); }}
                        placeholder="••••"
                        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone tabular-nums tracking-[0.4em] outline-none"
                      />
                      <button
                        onClick={tryPinUnlock}
                        className="w-full px-3 py-2 border border-amber text-amber hover:bg-amber/10 rounded text-[11px] tracking-[0.16em] uppercase"
                      >
                        Unlock
                      </button>
                    </div>
                  )}
                </>
              )}

              {!cfg.credentialId && !cfg.pinHash && (
                <div className="px-3 py-2 border border-danger/40 text-danger text-[11px] leading-relaxed rounded flex items-start gap-2">
                  <X size={12} className="mt-0.5 shrink-0" />
                  Lock is enabled but no unlock method is registered.
                  Reset KAI state from Settings → Danger zone to recover.
                </div>
              )}

              {err && <div className="text-danger text-[11px] leading-relaxed">{err}</div>}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function humanizeWebAuthnError(e: any): string {
  const name = String(e?.name || '');
  const msg  = String(e?.message || '');
  if (name === 'NotAllowedError')    return 'Cancelled or timed out.';
  if (name === 'SecurityError')      return 'Origin not allowed by the authenticator.';
  if (name === 'InvalidStateError')  return 'A credential is already registered.';
  if (name === 'NotSupportedError')  return 'No platform authenticator on this device.';
  return msg.slice(0, 140) || 'Authenticator error.';
}
