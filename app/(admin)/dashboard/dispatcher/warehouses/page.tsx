"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  queryKeys,
  type LatLng,
  type WarehouseInput,
  type WarehouseRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { LocationPickerMap } from "@/src/components/dashboard/dispatch-map";
import {
  CloseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  WarehouseIcon,
} from "@/src/components/icons";

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorTarget, setEditorTarget] = useState<WarehouseRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseRow | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.warehouses(search.trim()),
    queryFn: () => dispatchApi.listWarehouses(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dispatcher", "warehouses"] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      dispatchApi.updateWarehouse(id, { isActive }),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dispatchApi.deleteWarehouse(id),
    onSuccess: (res) => {
      setNotice(res.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(e instanceof ApiError ? e.message : "Could not delete the warehouse.");
    },
  });

  const warehouses = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Hub-and-spoke pickup hubs with their map locations.
          </p>
        </div>
        <button
          onClick={() => setEditorTarget("new")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Warehouse
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or city"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {warehouses.length} warehouse{warehouses.length === 1 ? "" : "s"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2.5 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load warehouses.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <WarehouseIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No warehouses match your search." : "No warehouses yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Warehouse</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr
                    key={w.warehouseId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{w.name}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">{w.address}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{w.city ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {w.contactName ?? "—"}
                      {w.contactPhone && (
                        <span className="block text-xs">{w.contactPhone}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <button
                          role="switch"
                          aria-checked={w.isActive}
                          onClick={() =>
                            toggleMutation.mutate({ id: w.warehouseId, isActive: !w.isActive })
                          }
                          disabled={toggleMutation.isPending}
                          aria-label={w.isActive ? "Deactivate warehouse" : "Activate warehouse"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                            w.isActive ? "bg-success" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              w.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-medium ${
                            w.isActive ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {w.isActive ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditorTarget(w)}
                          aria-label="Edit warehouse"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(w)}
                          aria-label="Delete warehouse"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorTarget !== null && (
        <WarehouseFormDialog
          warehouse={editorTarget === "new" ? null : editorTarget}
          onClose={() => setEditorTarget(null)}
          onSaved={(message) => {
            setEditorTarget(null);
            setNotice(message);
            invalidate();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          danger
          title="Delete this warehouse?"
          confirmLabel="Delete"
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.warehouseId)}
          message={
            <>
              This will delete <strong className="text-foreground">{deleteTarget.name}</strong>.
              This action is irreversible.
            </>
          }
        />
      )}
    </div>
  );
}

/* ------------------------- Create / edit dialog ------------------------- */

function WarehouseFormDialog({
  warehouse,
  onClose,
  onSaved,
}: {
  warehouse: WarehouseRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [city, setCity] = useState(warehouse?.city ?? "");
  const [contactName, setContactName] = useState(warehouse?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(warehouse?.contactPhone ?? "");
  const [location, setLocation] = useState<LatLng | null>(
    warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : null,
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body: WarehouseInput = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        latitude: location!.lat,
        longitude: location!.lng,
      };
      return warehouse
        ? dispatchApi.updateWarehouse(warehouse.warehouseId, body)
        : dispatchApi.createWarehouse(body);
    },
    onSuccess: () => onSaved(warehouse ? "Warehouse updated." : "Warehouse created."),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the warehouse."),
  });

  const canSave =
    name.trim().length >= 2 && address.trim().length >= 3 && location != null && !mutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) mutation.mutate();
        }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {warehouse ? "Edit Warehouse" : "Add Warehouse"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Okhla Hub"
              autoFocus
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New Delhi"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-foreground">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="B-12, Okhla Phase 2"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Contact person <span className="font-normal text-muted-foreground">(Optional)</span>
            </label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Contact phone <span className="font-normal text-muted-foreground">(Optional)</span>
            </label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">
            Location{" "}
            <span className="font-normal text-muted-foreground">
              — click the map to place the pin, drag to adjust
            </span>
          </p>
          <div className="overflow-hidden rounded-2xl border border-border">
            <LocationPickerMap value={location} onChange={setLocation} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {location
              ? `Pinned at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
              : "No location pinned yet."}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            {warehouse ? "Save Changes" : "Create Warehouse"}
          </button>
        </div>
      </form>
    </div>
  );
}
