"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryTreeApi,
  dispatcherApi,
  queryKeys,
  type PartnerDetail,
  type PartnerDocumentField,
  type PartnerEarnings,
  type PartnerOnboardingStatus,
  type UpdatePartnerInput,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { PartnerLeadActivitySection } from "@/src/components/dashboard/lead-activity";
import {
  ONBOARDING_STATUS_META,
  PartnerStatusBadge,
} from "@/src/components/dashboard/partner-status";
import { ClockIcon, SpinnerIcon, StarIcon } from "@/src/components/icons";
import { PartnerActivityModal } from "@/src/components/dashboard/partner-activity-modal";

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const professionalId = Number(params?.id);
  // Online/offline session log — the same modal the partners list opens.
  const [showActivity, setShowActivity] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.partner(professionalId),
    queryFn: () => dispatcherApi.getPartner(professionalId),
    enabled: Number.isFinite(professionalId),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/dispatcher/partners"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to Service Partners
        </Link>
        <button
          onClick={() => setShowActivity(true)}
          title="When this partner went online and offline, with durations"
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
        >
          <ClockIcon className="h-4 w-4" />
          Activity &amp; time logs
        </button>
      </div>

      {showActivity && (
        <PartnerActivityModal
          professionalId={professionalId}
          partnerName={data?.name ?? null}
          onClose={() => setShowActivity(false)}
        />
      )}

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError || !data ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
          <p className="text-muted-foreground">Couldn’t load this partner.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : (
        <PartnerEditor partner={data} />
      )}
    </div>
  );
}

function PartnerEditor({ partner }: { partner: PartnerDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(partner.name === "—" ? "" : partner.name);
  const [city, setCity] = useState(partner.city ?? "");
  const [experience, setExperience] = useState(
    partner.experience != null ? String(partner.experience) : "",
  );
  const [description, setDescription] = useState(partner.description ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(
    partner.categoryId ?? "",
  );
  // The rest of the registration form, so a half-filled profile can be
  // completed here instead of sending the partner back through the app.
  const [district, setDistrict] = useState(partner.district ?? "");
  const [aadharNo, setAadharNo] = useState(partner.aadharNo ?? "");
  const [licenseNo, setLicenseNo] = useState(partner.licenseNo ?? "");
  const [vehicleType, setVehicleType] = useState(partner.vehicleType ?? "");
  const [vehicleColor, setVehicleColor] = useState(partner.vehicleColor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Top-level categories the partner can be reassigned to.
  const { data: tree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });
  const categoryOptions = tree ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.partner(partner.professionalId),
    });
    queryClient.invalidateQueries({ queryKey: ["dispatcher", "partners"] });
  };

  const saveMutation = useMutation({
    mutationFn: (body: UpdatePartnerInput) =>
      dispatcherApi.updatePartner(partner.professionalId, body),
    onSuccess: (res) => {
      setNotice(res.message);
      invalidate();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not update partner."),
  });

  const blockMutation = useMutation({
    mutationFn: (isBlocked: boolean) =>
      dispatcherApi.setPartnerBlocked(partner.professionalId, isBlocked),
    onSuccess: (res) => {
      setNotice(res.message);
      invalidate();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Action failed."),
  });

  const onboardingMutation = useMutation({
    mutationFn: ({
      status,
      reason,
    }: {
      status: PartnerOnboardingStatus;
      reason?: string;
    }) =>
      dispatcherApi.setPartnerOnboarding(
        partner.professionalId,
        status,
        reason,
      ),
    onSuccess: (res) => {
      setError(null);
      setNotice(res.message);
      setRejectOpen(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.partnerStatusCounts,
      });
      invalidate();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not update onboarding status.",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => dispatcherApi.deletePartner(partner.professionalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatcher", "partners"] });
      router.replace("/dashboard/dispatcher/partners");
    },
    onError: (e) => {
      setConfirmDelete(false);
      setError(e instanceof ApiError ? e.message : "Could not delete partner.");
    },
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const exp = experience.trim();
    if (exp && (!/^\d+$/.test(exp) || Number(exp) < 0)) {
      setError("Experience must be a whole number of years.");
      return;
    }
    const nextCategoryId = categoryId === "" ? null : Number(categoryId);
    saveMutation.mutate({
      name: name.trim() || undefined,
      city: city.trim() || undefined,
      experience: exp ? Number(exp) : undefined,
      description: description.trim() || undefined,
      district: district.trim() || undefined,
      aadharNo: aadharNo.trim() || undefined,
      licenseNo: licenseNo.trim() || undefined,
      vehicleType: vehicleType.trim() || undefined,
      vehicleColor: vehicleColor.trim() || undefined,
      // Only send when it actually changed — sending it re-points the partner
      // to a representative service of the category on the backend.
      categoryId:
        nextCategoryId != null && nextCategoryId !== partner.categoryId
          ? nextCategoryId
          : undefined,
    });
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar partner={partner} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {partner.name}
              </h1>
              <PartnerStatusBadge status={partner.onboardingStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {partner.service ?? partner.category ?? "Service partner"} ·
              Joined{" "}
              {new Date(partner.joinedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Block toggle */}
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              partner.isBlocked ? "text-danger" : "text-muted-foreground"
            }`}
          >
            {partner.isBlocked ? "Blocked" : "Active"}
          </span>
          <button
            role="switch"
            aria-checked={partner.isBlocked}
            disabled={blockMutation.isPending}
            onClick={() => blockMutation.mutate(!partner.isBlocked)}
            title={partner.isBlocked ? "Unblock partner" : "Block partner"}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              partner.isBlocked ? "bg-danger" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                partner.isBlocked ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <OnboardingReview
        partner={partner}
        busy={onboardingMutation.isPending}
        onTransition={(status, reason) =>
          onboardingMutation.mutate({ status, reason })
        }
        onReject={() => {
          setRejectReason(partner.rejectionReason ?? "");
          setRejectOpen(true);
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Editable form */}
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2"
        >
          <h2 className="text-base font-semibold text-foreground">
            Profile details
          </h2>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="City" value={city} onChange={setCity} />
          <Field
            label="District"
            value={district}
            onChange={setDistrict}
            hint="Decides which dispatch team the partner belongs to."
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) =>
                setCategoryId(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Unassigned</option>
              {categoryOptions.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Reassigning moves the partner to the selected service category.
            </p>
          </div>

          <Field
            label="Experience (years)"
            value={experience}
            onChange={setExperience}
            inputMode="numeric"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Aadhaar number"
              value={aadharNo}
              onChange={setAadharNo}
            />
            <Field
              label="Licence number"
              value={licenseNo}
              onChange={setLicenseNo}
            />
            <Field
              label="Vehicle type"
              value={vehicleType}
              onChange={setVehicleType}
            />
            <Field
              label="Vehicle colour"
              value={vehicleColor}
              onChange={setVehicleColor}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {saveMutation.isPending ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : null}
              Save changes
            </button>
          </div>
        </form>

        {/* Read-only info + danger zone */}
        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Account</h2>
            <Info label="Email" value={partner.email ?? "—"} />
            <Info label="Mobile" value={partner.mobile ?? "—"} />
            <Info label="Category" value={partner.category ?? "—"} />
            <Info
              label="Rating"
              value={
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="h-3.5 w-3.5 text-warning" />
                  {partner.rating.toFixed(1)}
                </span>
              }
            />
            <Info label="Total jobs" value={String(partner.totalJobs)} />
            <Info
              label="Wallet balance"
              value={`₹${Math.round(partner.walletBalance).toLocaleString("en-IN")}`}
            />
            <Info
              label="Onboarding"
              value={ONBOARDING_STATUS_META[partner.onboardingStatus].label}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-danger/30 bg-card p-5">
            <h2 className="text-base font-semibold text-danger">Danger zone</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete this partner and erase all their data. This
              cannot be undone.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Delete partner permanently
            </button>
          </div>
        </div>
      </div>

      {/* Money and job history — the questions admins actually get asked:
          what has this partner earned, what does the wallet hold, and how many
          jobs did they finish versus cancel. */}
      <PartnerLedgerSection professionalId={partner.professionalId} />

      <PartnerLeadActivitySection professionalId={partner.professionalId} />

      {confirmDelete && (
        <ConfirmDialog
          danger
          title="Permanently delete this partner?"
          confirmLabel="Delete everything"
          busy={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          message={
            <>
              This will permanently delete{" "}
              <strong className="text-foreground">{partner.name}</strong> and
              erase{" "}
              <strong className="text-foreground">all associated data</strong> —
              profile, bookings, wallet &amp; transactions, ratings,
              availability and subscriptions. This action is irreversible.
            </>
          }
        />
      )}

      {rejectOpen && (
        <RejectDialog
          busy={onboardingMutation.isPending}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onCancel={() => setRejectOpen(false)}
          onConfirm={() =>
            onboardingMutation.mutate({
              status: "REJECTED",
              reason: rejectReason.trim() || undefined,
            })
          }
        />
      )}
    </>
  );
}

// Onboarding review — the KYC documents plus the verify → activate / reject
// controls. This is where the admin walks a pending partner through approval.
function OnboardingReview({
  partner,
  busy,
  onTransition,
  onReject,
}: {
  partner: PartnerDetail;
  busy: boolean;
  onTransition: (status: PartnerOnboardingStatus, reason?: string) => void;
  onReject: () => void;
}) {
  const status = partner.onboardingStatus;
  const meta = ONBOARDING_STATUS_META[status];
  const queryClient = useQueryClient();

  // Replacing a document is per field: the API only touches what it receives,
  // so a new Aadhaar never disturbs the licence beside it.
  const [uploadingField, setUploadingField] =
    useState<PartnerDocumentField | null>(null);
  const documentMutation = useMutation({
    mutationFn: ({
      field,
      file,
    }: {
      field: PartnerDocumentField;
      file: File;
    }) => {
      setUploadingField(field);
      return dispatcherApi.updatePartnerDocument(
        partner.professionalId,
        field,
        file,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.partner(partner.professionalId),
      });
    },
    onSettled: () => setUploadingField(null),
  });

  const docs: {
    label: string;
    url: string | null;
    field: PartnerDocumentField;
  }[] = [
    {
      label: "Aadhaar front",
      url: partner.documents.aadharFront,
      field: "aadharFront" as const,
    },
    {
      label: "Aadhaar back",
      url: partner.documents.aadharBack,
      field: "aadharBack" as const,
    },
    {
      label: "Driving licence",
      url: partner.documents.licenseDoc,
      field: "licenseDoc" as const,
    },
    {
      label: "PAN card",
      url: partner.documents.panCard,
      field: "panCard" as const,
    },
    {
      label: "Bank passbook",
      url: partner.documents.bankPassbook,
      field: "bankPassbook" as const,
    },
  ];
  const uploaded = docs.filter((d) => d.url);

  const grooming: { label: string; url: string | null }[] = [
    { label: "Passport size", url: partner.grooming.passportPhoto },
    { label: "Hands & nails", url: partner.grooming.nailsPhoto },
    { label: "Full size", url: partner.grooming.fullPhoto },
  ];
  const groomingUploaded = grooming.filter((g) => g.url);

  const identity: { label: string; value: string | null }[] = [
    { label: "Aadhaar no.", value: partner.aadharNo },
    { label: "Licence no.", value: partner.licenseNo },
    { label: "Vehicle type", value: partner.vehicleType },
    { label: "Vehicle colour", value: partner.vehicleColor },
  ];
  const identityShown = identity.filter((i) => i.value);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <section
      className={`space-y-5 rounded-2xl border bg-card p-5 ${meta.border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Onboarding review
          </h2>
          <p className="text-sm text-muted-foreground">
            {status === "PENDING"
              ? "Review the documents below, then verify and activate this partner."
              : status === "VERIFIED"
                ? "Documents verified. Activate the partner so they can log in."
                : status === "ACTIVE"
                  ? "This partner is active and can log in."
                  : "This application was rejected."}
          </p>
        </div>
        <PartnerStatusBadge status={status} />
      </div>

      {/* Progress timeline */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          Applied ·{" "}
          <span className="font-medium text-foreground">
            {new Date(partner.joinedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </span>
        {fmt(partner.verifiedAt) && (
          <span>
            Verified ·{" "}
            <span className="font-medium text-foreground">
              {fmt(partner.verifiedAt)}
            </span>
          </span>
        )}
        {fmt(partner.activatedAt) && (
          <span>
            Activated ·{" "}
            <span className="font-medium text-foreground">
              {fmt(partner.activatedAt)}
            </span>
          </span>
        )}
      </div>

      {status === "REJECTED" && partner.rejectionReason && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span className="font-medium">Rejection reason:</span>{" "}
          {partner.rejectionReason}
        </div>
      )}

      {/* Identity details */}
      {identityShown.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {identityShown.map((i) => (
            <div
              key={i.label}
              className="rounded-xl border border-border bg-background px-3 py-2"
            >
              <p className="text-xs text-muted-foreground">{i.label}</p>
              <p className="truncate text-sm font-medium text-foreground">
                {i.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* KYC documents */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          KYC documents{" "}
          <span className="font-normal text-muted-foreground">
            ({uploaded.length}/{docs.length} uploaded)
          </span>
        </p>
        {uploaded.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nothing uploaded yet — you can add each document here on the
            partner’s behalf.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {docs.map((d) => (
            <DocumentTile
              key={d.label}
              label={d.label}
              url={d.url}
              busy={uploadingField === d.field}
              onPick={(file) =>
                documentMutation.mutate({ field: d.field, file })
              }
            />
          ))}
        </div>
      </div>

      {/* Grooming photos */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Grooming photos{" "}
          <span className="font-normal text-muted-foreground">
            ({groomingUploaded.length}/{grooming.length} uploaded)
          </span>
        </p>
        {groomingUploaded.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            This partner hasn’t uploaded any grooming photos.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {grooming.map((g) => (
              <DocumentTile key={g.label} label={g.label} url={g.url} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {(status === "PENDING" || status === "REJECTED") && (
          <button
            onClick={() => onTransition("VERIFIED")}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Verify documents
          </button>
        )}
        {status === "VERIFIED" && (
          <button
            onClick={() => onTransition("ACTIVE")}
            disabled={busy}
            className="rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Activate partner
          </button>
        )}
        {status === "ACTIVE" && (
          <button
            onClick={() => onTransition("PENDING")}
            disabled={busy}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
          >
            Move back to review
          </button>
        )}
        {status !== "REJECTED" && (
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
          >
            Reject application
          </button>
        )}
        {busy && <SpinnerIcon className="h-4 w-4 text-muted-foreground" />}
      </div>
    </section>
  );
}

/**
 * One document. `onPick` turns it into an upload slot — used for the KYC set,
 * where an admin routinely has to fix a blurred or missing scan. Grooming
 * photos pass no handler, so those tiles stay read-only and keep their own
 * approve/reject review flow.
 */
function DocumentTile({
  label,
  url,
  onPick,
  busy,
}: {
  label: string;
  url: string | null;
  onPick?: (file: File) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const picker = onPick ? (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first: picking the same file twice must still fire onChange.
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full border-t border-border px-2 py-1.5 text-xs font-medium text-primary transition hover:bg-accent disabled:opacity-60"
      >
        {busy ? "Uploading…" : url ? "Replace" : "Upload"}
      </button>
    </>
  ) : null;

  if (!url) {
    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-dashed border-border">
        <div className="flex h-28 items-center justify-center bg-muted/40 text-xs text-muted-foreground">
          Not uploaded
        </div>
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
        {picker}
      </div>
    );
  }
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border transition hover:border-primary">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external KYC document */}
        <img src={url} alt={label} className="h-28 w-full object-cover" />
      </a>
      <div className="px-2 py-1.5 text-xs font-medium text-foreground">
        {label}
      </div>
      {picker}
    </div>
  );
}

function RejectDialog({
  busy,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">
          Reject this application?
        </h3>
        <p className="text-sm text-muted-foreground">
          The partner won’t be able to log in. The reason below is shown to them
          so they can fix and re-apply.
        </p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          placeholder="e.g. Aadhaar photo is blurred, please re-upload."
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-danger focus:ring-2 focus:ring-danger/30"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy && <SpinnerIcon className="h-4 w-4" />}
            Reject partner
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric";
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Lifetime earnings, wallet and job history.
 *
 * Loaded separately from the profile so a slow aggregate never delays the page
 * an admin opened just to edit a phone number.
 */
function PartnerLedgerSection({ professionalId }: { professionalId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.partnerEarnings(professionalId),
    queryFn: () => dispatcherApi.getPartnerEarnings(professionalId),
    enabled: Number.isFinite(professionalId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-2xl border border-border bg-card p-8">
        <SpinnerIcon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Could not load earnings for this partner.
      </div>
    );
  }

  const { earnings, wallet, jobs } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Money
          label="Lifetime earnings"
          value={earnings.lifetimeEarned}
          hint={`${jobs.completed} completed · avg ₹${inr(earnings.averagePerJob)}`}
          accent
        />
        <Money
          label="Wallet balance"
          value={wallet.balance}
          hint={`₹${inr(wallet.totalCredited)} in · ₹${inr(wallet.totalDebited)} out`}
        />
        <Money
          label="Platform charges"
          value={earnings.commissionPaid + earnings.leadFeesPaid}
          hint={`₹${inr(earnings.commissionPaid)} commission · ₹${inr(earnings.leadFeesPaid)} lead fees`}
        />
        <Money
          label="Net after charges"
          value={earnings.netAfterPlatformCharges}
          hint="Earnings minus commission and lead fees"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service history */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Service history
            </h2>
            <span className="text-xs text-muted-foreground">
              {jobs.total} jobs
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tally
              label="Completed"
              value={jobs.completed}
              tone="text-success"
            />
            <Tally
              label="Cancelled"
              value={jobs.cancelled}
              tone="text-danger"
            />
            <Tally label="In progress" value={jobs.inProgress} />
            <Tally label="Leads rejected" value={jobs.rejectedLeads} />
          </div>

          {jobs.total > 0 && (
            <p className="text-xs text-muted-foreground">
              Cancellation rate {jobs.cancellationRate}%
              {jobs.firstJobAt
                ? ` · first job ${istDate(jobs.firstJobAt)}`
                : ""}
              {jobs.lastJobAt ? ` · last job ${istDate(jobs.lastJobAt)}` : ""}
            </p>
          )}

          {jobs.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Job</th>
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 text-right font-medium">Earned</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.recent.map((j) => (
                    <tr key={j.bookingId}>
                      <td className="py-2 pr-2 text-foreground">
                        {j.service}
                        <span className="block text-xs text-muted-foreground">
                          #{j.bookingId}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {istDate(j.bookingDate)}
                      </td>
                      <td className="py-2 pr-2 text-right text-foreground">
                        ₹{inr(j.partnerEarning)}
                        {/* The customer can pay less than the partner earns on a
                            coupon booking — the discount is the platform's cost. */}
                        {j.customerPaid !== j.partnerEarning && (
                          <span className="block text-xs text-muted-foreground">
                            customer paid ₹{inr(j.customerPaid)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`text-xs font-medium ${statusTone(j.status)}`}
                        >
                          {j.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Wallet ledger */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Wallet ledger
            </h2>
            <span className="text-xs text-muted-foreground">
              Balance ₹{inr(wallet.balance)}
            </span>
          </div>

          {wallet.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No wallet activity yet.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wallet.transactions.map((t) => (
                    <tr key={t.walletTransactionId}>
                      <td className="py-2 pr-2 text-foreground">
                        {t.description ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {istDate(t.createdAt)}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          t.type === "CREDIT" ? "text-success" : "text-danger"
                        }`}
                      >
                        {t.type === "CREDIT" ? "+" : "−"}₹{inr(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Rupees with Indian grouping and no trailing paise noise. */
function inr(n: number) {
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function istDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "text-success";
  if (status === "CANCELLED") return "text-danger";
  return "text-muted-foreground";
}

function Money({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}
      >
        ₹{inr(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-accent/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Avatar({ partner }: { partner: PartnerDetail }) {
  if (partner.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external partner image
      <img
        src={partner.profileImage}
        alt={partner.name}
        className="h-14 w-14 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = partner.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-semibold text-white">
      {initials || "?"}
    </div>
  );
}
