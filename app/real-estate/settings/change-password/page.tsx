"use client";

import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/app/api/errors";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "@/app/api/api";
// import { useAuthStore } from "@/store/authStore";

function getStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthMeta: Record<number, { label: string; color: string; bar: string }> = {
  0: { label: "Too weak", color: "text-red-500", bar: "bg-red-500" },
  1: { label: "Weak", color: "text-red-500", bar: "bg-red-500" },
  2: { label: "Fair", color: "text-yellow-500", bar: "bg-yellow-500" },
  3: { label: "Good", color: "text-orange-500", bar: "bg-orange-500" },
  4: { label: "Strong", color: "text-emerald-500", bar: "bg-emerald-500" },
};

export default function ChangePasswordPage() {
  // const { clearAuth } = useAuthStore();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(newPassword),
    onSuccess: () => {
      toast.success("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Failed to change password. Please try again."));
    },
  });

  const isDisabled = !newPassword || !passwordsMatch || strength < 2 || mutation.isPending;
  const { label: strengthLabel, color: strengthColor, bar: strengthBar } = strengthMeta[strength] ?? strengthMeta[0];

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!isDisabled) mutation.mutate();
  }

  return (
    <div>
      {/* Page heading — top left */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Change Password</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Update your super admin account password.</p>
      </div>

      {/* Card horizontally centered below heading */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">

          {/* Card — matches ConfigCard style from api-keys */}
          <section className="rounded-2xl border border-neutral-300 bg-card p-8 shadow-sm transition-all duration-200 hover:shadow-md dark:border-neutral-700">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="font-semibold text-lg text-foreground">Account Security</h2>
                <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">Choose a strong password with at least 8 characters.</p>
              </div>
              <button
                type="button"
                form="change-password-form"
                onClick={() => { if (!isDisabled) mutation.mutate(); }}
                disabled={isDisabled}
                className="rounded-full border border-blue-600/30 px-5 py-1.5 font-semibold text-blue-700 text-sm transition-colors hover:bg-blue-600/5 hover:border-blue-600 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:border-blue-500 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed outline-none"
              >
                {mutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>

            <form id="change-password-form" onSubmit={handleSubmit} className="space-y-6">
              {/* New Password */}
              <div>
                <label className="mb-2 block font-semibold text-neutral-700 text-xs uppercase tracking-wider dark:text-neutral-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                  type="hidden"
                  name="email"
                  />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-lg border border-neutral-300 bg-transparent py-3 px-4 pr-12 text-base text-foreground transition-colors focus:border-blue-500 dark:border-neutral-700 dark:focus:border-blue-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-neutral-400 hover:text-foreground cursor-pointer outline-none rounded p-0.5"
                  >
                    {showNew ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword.length > 0 && (
                  <div className="mt-2.5">
                    <div className="flex gap-1.5 mb-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < (strength === 0 ? 1 : strength) ? strengthBar : "bg-neutral-200 dark:bg-neutral-700"}`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strengthColor}`}>{strengthLabel}</p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="mb-2 block font-semibold text-neutral-700 text-xs uppercase tracking-wider dark:text-neutral-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-lg border border-neutral-300 bg-transparent py-3 px-4 pr-12 text-base text-foreground transition-colors focus:border-blue-500 dark:border-neutral-700 dark:focus:border-blue-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-neutral-400 hover:text-foreground cursor-pointer outline-none rounded p-0.5"
                  >
                    {showConfirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p className="text-xs text-red-500 mt-1.5">Passwords do not match.</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-emerald-500 mt-1.5">Passwords match ✓</p>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
