"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qcApi, type QcProduct, type QcOrderStatus } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const istDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "—";

const ORDER_STATUS: Record<QcOrderStatus, { text: string; cls: string }> = {
  PLACED: { text: "Placed", cls: "bg-warning/10 text-warning" },
  ACCEPTED: { text: "Accepted", cls: "bg-primary/10 text-primary" },
  PICKED_UP: { text: "On the way", cls: "bg-primary/10 text-primary" },
  DELIVERED: { text: "Delivered", cls: "bg-success/10 text-success" },
  CANCELLED: { text: "Cancelled", cls: "bg-danger/10 text-danger" },
};

type Tab = "products" | "orders" | "revenue";

/**
 * The vendor's own portal: their store at a glance, product management
 * (with image upload + live stock), incoming orders, and revenue history.
 * Every request is scoped server-side to the logged-in vendor's store.
 */
export default function MyStorePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("products");
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QcProduct | null>(null);

  const me = useQuery({ queryKey: ["qc-me"], queryFn: qcApi.vendorMe });
  const products = useQuery({
    queryKey: ["qc-my-products"],
    queryFn: qcApi.vendorProducts,
    enabled: tab === "products",
  });
  const orders = useQuery({
    queryKey: ["qc-my-orders"],
    queryFn: qcApi.vendorOrders,
    enabled: tab === "orders",
  });
  const revenue = useQuery({
    queryKey: ["qc-my-revenue"],
    queryFn: qcApi.vendorRevenue,
    enabled: tab === "revenue",
  });

  const invalidateProducts = () => qc.invalidateQueries({ queryKey: ["qc-my-products"] });
  const onErr = (e: unknown) => setNotice(e instanceof ApiError ? e.message : "Something went wrong");

  const bumpStock = useMutation({
    mutationFn: ({ p, delta }: { p: QcProduct; delta: number }) =>
      qcApi.vendorUpdateProduct(p.qcProductId, { stock: Math.max(0, p.stock + delta) }),
    onSuccess: invalidateProducts,
    onError: onErr,
  });
  const toggleActive = useMutation({
    mutationFn: (p: QcProduct) => qcApi.vendorUpdateProduct(p.qcProductId, { isActive: !p.isActive }),
    onSuccess: invalidateProducts,
    onError: onErr,
  });
  const removeProduct = useMutation({
    mutationFn: (p: QcProduct) => qcApi.vendorDeleteProduct(p.qcProductId),
    onSuccess: (r) => {
      setNotice(r.message);
      invalidateProducts();
    },
    onError: onErr,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {me.data ? me.data.storeName : "My Store"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {me.data
              ? `${me.data.productCount} products · ${me.data.inStock} in stock${me.data.city ? ` · ${me.data.city}` : ""}`
              : "Your quick-commerce store"}
          </p>
        </div>
        {tab === "products" && (
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            ＋ Add product
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { key: "products", label: "Products" },
            { key: "orders", label: "Orders" },
            { key: "revenue", label: "Revenue" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Products ── */}
      {tab === "products" &&
        (products.isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(products.data ?? []).map((p) => (
              <div key={p.qcProductId} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex h-36 items-center justify-center bg-muted">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl">🛍️</span>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category?.name}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {p.isActive ? "Live" : "Hidden"}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-bold text-foreground">{inr(p.price)}</span>
                    {p.mrp != null && p.mrp > p.price && (
                      <span className="ml-2 text-xs text-muted-foreground line-through">{inr(p.mrp)}</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => bumpStock.mutate({ p, delta: -1 })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground transition hover:bg-accent"
                      >
                        −
                      </button>
                      <span className={`min-w-10 text-center text-sm font-semibold ${p.stock === 0 ? "text-danger" : "text-foreground"}`}>
                        {p.stock === 0 ? "Out" : p.stock}
                      </span>
                      <button
                        onClick={() => bumpStock.mutate({ p, delta: 1 })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground transition hover:bg-accent"
                      >
                        ＋
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ImageUploadButton product={p} onDone={invalidateProducts} onError={onErr} />
                      <button
                        onClick={() => setEditing(p)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive.mutate(p)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
                      >
                        {p.isActive ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => removeProduct.mutate(p)}
                        className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-medium text-danger transition hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!products.data?.length && (
              <p className="col-span-full rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
                No products yet — add your first one.
              </p>
            )}
          </div>
        ))}

      {/* ── Orders ── */}
      {tab === "orders" &&
        (orders.isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    {["Order", "Customer", "My items", "My amount", "Status", "Placed", "Delivered"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(orders.data ?? []).map((o) => (
                    <tr key={o.qcOrderId} className="border-t border-border align-top hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">#QC-{o.qcOrderId}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{o.customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{o.customer?.mobile ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.items.map((i) => (
                          <div key={`${o.qcOrderId}-${i.name}`}>{i.quantity} × {i.name}</div>
                        ))}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{inr(o.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS[o.status].cls}`}>
                          {ORDER_STATUS[o.status].text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{istDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{istDateTime(o.deliveredAt)}</td>
                    </tr>
                  ))}
                  {!orders.data?.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {/* ── Revenue ── */}
      {tab === "revenue" &&
        (revenue.isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : revenue.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "Today", value: inr(revenue.data.today) },
                { label: "Last 7 days", value: inr(revenue.data.week) },
                { label: "Last 30 days", value: inr(revenue.data.month) },
                { label: "All time", value: inr(revenue.data.allTime) },
                { label: "Units sold", value: revenue.data.unitsSold },
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">Units sold</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.data.products.map((p) => (
                    <tr key={p.qcProductId} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.units}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{inr(p.revenue)}</td>
                    </tr>
                  ))}
                  {!revenue.data.products.length && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                        Nothing delivered yet — revenue appears once orders are delivered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null)}

      {(formOpen || editing) && (
        <ProductModal
          product={editing ?? undefined}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onDone={() => {
            setFormOpen(false);
            setEditing(null);
            invalidateProducts();
            qc.invalidateQueries({ queryKey: ["qc-me"] });
          }}
        />
      )}
    </div>
  );
}

function ImageUploadButton({
  product,
  onDone,
  onError,
}: {
  product: QcProduct;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await qcApi.vendorUploadImage(product.qcProductId, file);
            onDone();
          } catch (err) {
            onError(err);
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        title="Upload product photo"
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
      >
        {busy ? "…" : "📷"}
      </button>
    </>
  );
}

function ProductModal({
  product,
  onClose,
  onDone,
}: {
  product?: QcProduct;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = !!product;
  const { data: categories } = useQuery({ queryKey: ["qc-categories"], queryFn: qcApi.categories });
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product ? String(product.qcCategoryId) : "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [mrp, setMrp] = useState(product?.mrp != null ? String(product.mrp) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "10");
  const [description, setDescription] = useState(product?.description ?? "");
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        qcCategoryId: Number(categoryId),
        price: Number(price),
        mrp: mrp.trim() ? Number(mrp) : undefined,
        stock: Number(stock) || 0,
        description: description.trim() || undefined,
      };
      return isEdit
        ? qcApi.vendorUpdateProduct(product.qcProductId, body)
        : qcApi.vendorCreateProduct(body);
    },
    onSuccess: onDone,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">
          {isEdit ? `Edit ${product.name}` : "Add product"}
        </h3>
        {err && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Classic White Shirt" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category *</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {(categories ?? []).map((c) => (
                <option key={c.qcCategoryId} value={c.qcCategoryId}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock</span>
            <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price *</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inputCls} placeholder="799" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MRP (strike-through)</span>
            <input value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" className={inputCls} placeholder="999" />
          </label>
          <div className="sm:col-span-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => {
              setErr(null);
              if (!name.trim()) return setErr("Name is required.");
              if (!categoryId) return setErr("Pick a category.");
              if (!(Number(price) > 0)) return setErr("Price must be a positive number.");
              save.mutate();
            }}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>
    </div>
  );
}
