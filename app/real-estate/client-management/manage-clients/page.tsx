
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { clientApi } from "@/app/api/api";
import { DangerConfirmModal } from "@/app/real-estate/components/DangerConfirmModal";

interface ClientService {
  service_name: string;
}

interface Client {
  id: string;
  client_name: string;
  company_name: string;
  email: string;
  phone?: string;
  website?: string;
  industry: string;
  company_size: string;
  monthly_budget: string;
  additional_notes?: string;
  created_at: string;
  services?: ClientService[];
  isBlocked: boolean;
}

interface EditFormState {
  client_name: string;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  company_size: string;
  monthly_budget: string;
  additional_notes: string;
}

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-teal-500",
];

function avatarColor(id: string) {
  const total = id.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

// ─── FIELD ───────────────────────────────────────────────────────────────────

function Field({
  label, name, value, onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />
    </div>
  );
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

function EditModal({
  client, onClose, onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: (client: Client) => void;
}) {
  const [form, setForm] = useState<EditFormState>({
    client_name: client.client_name,
    company_name: client.company_name,
    email: client.email,
    phone: client.phone || "",
    website: client.website || "",
    industry: client.industry,
    company_size: client.company_size,
    monthly_budget: client.monthly_budget,
    additional_notes: client.additional_notes || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaved({ ...client, ...form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">Edit Client</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client Name" name="client_name" value={form.client_name} onChange={handleChange} />
            <Field label="Company Name" name="company_name" value={form.company_name} onChange={handleChange} />
            <Field label="Email" name="email" value={form.email} onChange={handleChange} />
            <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Field label="Industry" name="industry" value={form.industry} onChange={handleChange} />
            <Field label="Budget" name="monthly_budget" value={form.monthly_budget} onChange={handleChange} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Additional Notes
            </label>
            <textarea
              name="additional_notes"
              value={form.additional_notes}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white transition-colors hover:bg-violet-500"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ManageClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const rawData = await clientApi.getClients();
      const normalizedData = (Array.isArray(rawData) ? rawData : []).map((c: any) => ({
        id: c.id || c._id || "",
        client_name: c.clientName || c.client_name || c.name || "Unknown Client",
        company_name: c.companyName || c.company_name || c.name || "Unknown Company",
        email: c.email || "-",
        phone: c.phone || "-",
        website: c.website || "-",
        industry: c.industry || "-",
        company_size: c.companySize || c.company_size || "-",
        monthly_budget: c.monthlyBudget || c.monthly_budget || "-",
        additional_notes: c.notes || c.additional_notes || "",
        created_at: c.createdAt || c.created_at || new Date().toISOString(),
        services: c.services || c.servicesNeeded || [],
        isBlocked: c.isBlocked ?? false,
      })) as Client[];
      setClients(normalizedData);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      void fetchClients();
    }, 0);
  }, [fetchClients]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) =>
      c.client_name.toLowerCase().includes(q) ||
      c.company_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.industry.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleEditSaved = async (updated: Client) => {
    try {
      await clientApi.updateClient(updated.id, {
        name: updated.company_name || updated.client_name || "Unknown",
        clientName: updated.client_name, companyName: updated.company_name,
        email: updated.email, phone: updated.phone, website: updated.website,
        industry: updated.industry, companySize: updated.company_size,
        monthlyBudget: updated.monthly_budget, notes: updated.additional_notes,
        servicesNeeded: [],
      });
      toast.success("Client updated successfully");
      setEditingClient(null);
      void fetchClients();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update client");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await clientApi.deleteClient(deleteTarget.id);
      toast.success(res?.message ?? "Client deleted successfully");
      setDeleteTarget(null);
      void fetchClients();
    } catch (e) {
      console.error(e);
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete client",
      );
    } finally {
      setDeleting(false);
    }
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleBlock = async (client: Client) => {
    setTogglingId(client.id);
    try {
      const result = await clientApi.toggleBlock(client.id);
      toast.success(result.message ?? (client.isBlocked ? "Client unblocked" : "Client blocked"));
      void fetchClients();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update client status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="@container/main flex w-full flex-col gap-4 md:gap-6">
      {editingClient && (
        <EditModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={handleEditSaved}
        />
      )}

      <DangerConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="Delete this client permanently?"
        confirmLabel="Delete client"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-semibold text-neutral-900 dark:text-white">
              {deleteTarget?.company_name ||
                deleteTarget?.client_name ||
                deleteTarget?.email}
            </span>{" "}
            and everything belonging to it. This action cannot be undone.
          </>
        }
        bullets={[
          "All users and their role assignments",
          "All projects, properties and media",
          "All forms, submissions and leads",
          "All calls, manual leads, audit logs and settings",
        ]}
      />

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Users className="size-4" />
            </div>
            <h1 className="font-semibold text-xl tracking-tight">Manage Clients</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            View, search, and manage your clients in the system.
          </p>
        </div>

        <button
          onClick={() => void fetchClients()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── SEARCH ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Client", "Contact", "Industry", "Budget", "Added"].map((h) => (
                    <th key={h} className="px-5 py-4 font-medium text-muted-foreground">{h}</th>
                  ))}
                  <th className="px-5 py-4 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-muted animate-pulse shrink-0" style={{ animationDelay: `${i * 50}ms` }} />
                          <div className="flex flex-col gap-1.5">
                            <div className="h-3.5 w-28 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" style={{ animationDelay: `${i * 50 + 25}ms` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="h-3 w-36 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                          <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" style={{ animationDelay: `${i * 50 + 25}ms` }} />
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-6 w-20 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 50}ms` }} /></td>
                      <td className="px-5 py-4"><div className="h-3 w-20 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} /></td>
                      <td className="px-5 py-4"><div className="h-3 w-20 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} /></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <div className="h-7 w-14 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                          <div className="h-6 w-11 bg-muted rounded-full animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                          <div className="h-7 w-16 bg-muted rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map((client) => (
                    <tr key={client.id} className="transition-colors hover:bg-muted/40">

                      {/* CLIENT */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(client.id)}`}>
                            {getInitials(client.client_name)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{client.client_name}</p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="size-3" />
                              {client.company_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CONTACT */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-foreground/70">
                            <Mail className="size-3 shrink-0" />
                            {client.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="size-3 shrink-0" />
                            {client.phone}
                          </div>
                        </div>
                      </td>

                      {/* INDUSTRY */}
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground/70">
                          {client.industry}
                        </span>
                      </td>

                      {/* BUDGET */}
                      <td className="px-5 py-4 text-foreground/70">
                        {client.monthly_budget}
                      </td>

                      {/* DATE */}
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {formatDate(client.created_at)}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingClient(client)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <Edit2 className="size-3" />
                            Edit
                          </button>

                          {/* Block / Unblock toggle */}
                          <button
                            onClick={() => void handleToggleBlock(client)}
                            disabled={togglingId === client.id}
                            title={client.isBlocked ? "Unblock client" : "Block client"}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                              client.isBlocked
                                ? "bg-red-500"
                                : "bg-emerald-500"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                                client.isBlocked ? "translate-x-0" : "translate-x-5"
                              }`}
                            />
                          </button>

                          <button
                            onClick={() => setDeleteTarget(client)}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ── PAGINATION ── */}
      {!loading && filteredClients.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredClients.length)} of {filteredClients.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3" /> Prev
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

