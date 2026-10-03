"use client";
import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/app/api/api";

// Landing page for the invite email sent on tenant onboarding
// (backend: sendSetPasswordEmail → /set-password?token=...). It validates the
// signed token up front so an expired/used link shows a clear message instead
// of a broken form, then lets the invitee set their first password.

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
      {children}
    </div>
  );
}

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  // Distinguish a definitive "token invalid" from a transient failure (network
  // blip / API cold start) so a good link opened during an outage can retry.
  const [checkFailed, setCheckFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      setCheckFailed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await authApi.validateToken(token);
        if (cancelled) return;
        setValid(!!res?.valid);
        setCheckFailed(false);
      } catch {
        if (cancelled) return;
        setValid(false);
        setCheckFailed(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password || !confirm) return setError("Please fill in both fields.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!token) return setError("This link is missing its token.");

    setSubmitting(true);
    try {
      await authApi.setPassword(token, password);
      setDone(true);
      setTimeout(() => router.push(ADMIN_LOGIN_PATH), 2500);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not set your password. The link may have expired.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <Centered>
        <Card>
          <p className="text-center text-sm text-muted-foreground">Validating your link…</p>
        </Card>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <Card>
          <h1 className="text-center text-xl font-semibold text-foreground">Password set</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Your password has been set. Redirecting you to sign in…
          </p>
          <Link
            href={ADMIN_LOGIN_PATH}
            className="mt-6 block rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go to sign in
          </Link>
        </Card>
      </Centered>
    );
  }

  if (!valid) {
    return (
      <Centered>
        <Card>
          <h1 className="text-center text-xl font-semibold text-foreground">
            {checkFailed ? "Couldn’t verify your link" : "Link invalid or expired"}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {checkFailed
              ? "We couldn’t reach the server to check your link. Please try again."
              : "This set-password link is no longer valid. It may have expired or already been used. Ask an administrator to resend your invite."}
          </p>
          {checkFailed ? (
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="mt-6 block w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Retry
            </button>
          ) : (
            <Link
              href={ADMIN_LOGIN_PATH}
              className="mt-6 block rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Back to sign in
            </Link>
          )}
        </Card>
      </Centered>
    );
  }

  return (
    <Centered>
      <Card>
        <h1 className="text-center text-xl font-semibold text-foreground">Set your password</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Create a password to finish setting up your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show password
          </label>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Setting password…" : "Set password"}
          </button>
        </form>
      </Card>
    </Centered>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <Card>
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          </Card>
        </Centered>
      }
    >
      <SetPasswordInner />
    </Suspense>
  );
}
