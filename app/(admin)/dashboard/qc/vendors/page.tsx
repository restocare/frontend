"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qcApi, type QcVendorRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Quick-commerce vendors. The super admin creates the store AND its panel
 * login here in one step — the vendor then signs into this same panel and
 * sees only "My Store".
 */
export default function QcVendorsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QcVendorRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canCreate = hasPermission("qc-vendors.create");
  const canUpdate = hasPermission("qc-vendors.update");

  const { data: vendors, isLoading } = useQuery({ queryKey: ["qc-vendors"], queryFn: qcApi.vendors });

  const toggleActive = useMutation({
    mutationFn: (v: QcVendorRow) => qcApi.updateVendor(v.qcVendorId, { isActive: !v.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qc-vendors"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Update failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">QC Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick-commerce stores. Creating a vendor also creates their panel login.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            ＋ Add vendor
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  {["Store", "Owner", "Login email", "Mobile", "City", "Products", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(vendors ?? []).map((v) => (
                  <tr key={v.qcVendorId} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{v.storeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.ownerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.mobile ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.city ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{v._count?.products ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${v.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {v.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canUpdate && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditing(v)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive.mutate(v)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 ${v.isActive ? "bg-danger" : "bg-success"}`}
                          >
                            {v.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!vendors?.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No vendors yet — add the first store.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <VendorModal
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setCreating(false);
            setNotice(msg);
            qc.invalidateQueries({ queryKey: ["qc-vendors"] });
          }}
        />
      )}
      {editing && (
        <VendorModal
          vendor={editing}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            setNotice(msg);
            qc.invalidateQueries({ queryKey: ["qc-vendors"] });
          }}
        />
      )}
    </div>
  );
}

function VendorModal({
  vendor,
  onClose,
  onDone,
}: {
  vendor?: QcVendorRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isEdit = !!vendor;
  const [storeName, setStoreName] = useState(vendor?.storeName ?? "");
  const [ownerName, setOwnerName] = useState(vendor?.ownerName ?? "");
  const [email, setEmail] = useState(vendor?.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState(vendor?.mobile ?? "");
  const [address, setAddress] = useState(vendor?.address ?? "");
  const [city, setCity] = useState(vendor?.city ?? "");
  // The store pin. The delivery app draws it as the pickup marker on the lead
  // alarm and navigates to it — a vendor without coordinates shows up as
  // "location not set" on every order it feeds.
  const [lat, setLat] = useState(vendor?.lat != null ? String(vendor.lat) : "");
  const [lng, setLng] = useState(vendor?.lng != null ? String(vendor.lng) : "");
  const [err, setErr] = useState<string | null>(null);

  const coord = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? qcApi.updateVendor(vendor.qcVendorId, {
            storeName: storeName.trim(),
            ownerName: ownerName.trim() || undefined,
            mobile: mobile.trim() || undefined,
            address: address.trim() || undefined,
            city: city.trim() || undefined,
            lat: coord(lat),
            lng: coord(lng),
            ...(password.trim() ? { password: password.trim() } : {}),
          }).then(() => "Vendor updated")
        : qcApi
            .createVendor({
              storeName: storeName.trim(),
              email: email.trim(),
              password: password.trim(),
              ownerName: ownerName.trim() || undefined,
              mobile: mobile.trim() || undefined,
              address: address.trim() || undefined,
              city: city.trim() || undefined,
              lat: coord(lat),
              lng: coord(lng),
            })
            .then((r) => r.message),
    onSuccess: (msg) => onDone(msg),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">
          {isEdit ? `Edit ${vendor.storeName}` : "Add vendor"}
        </h3>
        {!isEdit && (
          <p className="mt-1 text-sm text-muted-foreground">
            The email + password become the vendor&apos;s panel login.
          </p>
        )}
        {err && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Store name" required>
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Owner name">
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Login email" required>
            <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} className={`${inputCls} disabled:opacity-60`} />
          </Field>
          <Field label={isEdit ? "New password (optional)" : "Password"} required={!isEdit}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? "Leave blank to keep" : "Min 6 characters"} className={inputCls} />
          </Field>
          <Field label="Mobile">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputCls} />
          </Field>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Latitude">
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.6862" inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Longitude">
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.1379" inputMode="decimal" className={inputCls} />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The store pin the delivery partner navigates to. Copy it from Google Maps: right-click
            the shop → the first row is <span className="font-medium">latitude, longitude</span>.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => {
              setErr(null);
              if (!storeName.trim()) return setErr("Store name is required.");
              if (!isEdit && !email.trim()) return setErr("Login email is required.");
              if (!isEdit && password.trim().length < 6) return setErr("Password must be at least 6 characters.");
              const [latNum, lngNum] = [coord(lat), coord(lng)];
              if (latNum !== undefined && (!Number.isFinite(latNum) || Math.abs(latNum) > 90))
                return setErr("Latitude must be a number between -90 and 90.");
              if (lngNum !== undefined && (!Number.isFinite(lngNum) || Math.abs(lngNum) > 180))
                return setErr("Longitude must be a number between -180 and 180.");
              save.mutate();
            }}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}
