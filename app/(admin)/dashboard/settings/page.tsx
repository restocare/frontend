"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/src/api/api";
import { clearSession, getSessionId, getStoredUser } from "@/src/lib/auth";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

export default function SettingsPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ newPassword }),
    onSuccess: () => {
      setError(null);
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated. Logging you out…");
      // The password changed, so end this session and force a fresh login.
      const sessionId = getSessionId();
      const logout = sessionId
        ? authApi.logout(sessionId).catch(() => undefined)
        : Promise.resolve();
      void logout.finally(() => {
        clearSession();
        // Brief pause so the success message is visible before redirecting.
        setTimeout(() => router.replace("/login"), 1200);
      });
    },
    onError: (e) => {
      setSuccess(null);
      setError(
        e instanceof ApiError ? e.message : "Couldn’t update your password. Please try again.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your admin account.
        </p>
      </div>

      {/* Change password card */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Change password</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {user?.email
              ? `Update the password for ${user.email}.`
              : "Update your account password."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <Field
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={show}
            autoComplete="new-password"
            hint="At least 6 characters."
          />
          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={show}
            autoComplete="new-password"
          />

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Show passwords
          </label>

          {error ? (
            <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{success}</p>
          ) : null}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={mutation.isPending || !!success}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending || success ? <SpinnerIcon className="h-4 w-4" /> : null}
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  show,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
