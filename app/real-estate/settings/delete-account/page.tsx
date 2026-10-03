"use client";
import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { accountApi } from "@/app/api/api";
import { useAuthStore } from "@/store/authStore";
import { DangerConfirmModal } from "@/app/real-estate/components/DangerConfirmModal";

export default function DeleteAccountPage() {
  const { user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasTenant = !!user?.tenantId;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const res = await accountApi.deleteMyAccount(user?.email);
      toast.success(res?.message ?? "Your account was permanently deleted.");
      clearAuth();
      // Hard redirect so no stale in-memory session state survives.
      window.location.href = ADMIN_LOGIN_PATH;
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete your account. Please try again.";
      toast.error(message);
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
          Delete Account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
              Danger zone
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-red-700/90 dark:text-red-300/80">
              Deleting your account is{" "}
              <strong>permanent and cannot be undone</strong>. Every user,
              project, property, form, submission, lead, call and configuration
              belonging to your organization will be erased.
            </p>

            {!hasTenant ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                Your account is not linked to an organization, so there is
                nothing to delete here.
              </p>
            ) : (
              <button
                onClick={() => setOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete my account
              </button>
            )}
          </div>
        </div>
      </div>

      <DangerConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void handleConfirm()}
        loading={deleting}
        title="Delete your account permanently?"
        confirmLabel="Delete my account"
        description={
          <>
            This will permanently delete your entire organization and sign you
            out immediately. This cannot be undone.
          </>
        }
        bullets={[
          "All users in your organization and their roles",
          "All projects, properties and media",
          "All forms, submissions and leads",
          "All calls, manual leads and settings",
        ]}
        requireText={user?.email}
        requireTextLabel={
          <>
            Type your email{" "}
            <span className="font-semibold text-neutral-900 dark:text-white">
              {user?.email}
            </span>{" "}
            to confirm
          </>
        }
      />
    </div>
  );
}
