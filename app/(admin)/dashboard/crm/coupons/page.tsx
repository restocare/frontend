"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryApi,
  customersApi,
  queryKeys,
  type CampaignCoupon,
  type CampaignCouponRules,
  type CouponAudienceMember,
  type CouponVisibility,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  inputCls,
} from "@/src/components/crm/ui";
import { PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const statusTone: Record<CampaignCoupon["status"], string> = {
  ACTIVE: "success",
  DISABLED: "muted",
  EXPIRED: "danger",
  EXHAUSTED: "warning",
};

const QUERY_KEY = ["admin", "coupon-campaigns"] as const;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "20% off up to ₹300" / "₹1 total" — the offer in the admin's words. */
function offerLabel(c: CampaignCoupon): string {
  if (c.discountType === "FLAT_TOTAL" && c.flatTotal != null)
    return `${rupees(c.flatTotal)} total`;
  const pct = `${c.discountPercent ?? 0}% off`;
  return c.maxDiscount != null ? `${pct} up to ${rupees(c.maxDiscount)}` : pct;
}

/**
 * Campaign coupons — one code each eligible customer may redeem once.
 *
 * What a coupon is worth is a percentage off (optionally capped) or a fixed
 * total the customer pays; who may use it is everyone or a private list the
 * sales team chooses; and it can be limited to certain service categories and
 * to bookings above a minimum amount. The partner is unaffected by all of it —
 * they are still paid, and charged commission on, the job's full list price,
 * so the discount comes out of the platform's pocket rather than theirs.
 */
export default function CampaignCouponsPage() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CampaignCoupon | null>(null);
  const canManage = hasPermission("customers.update");

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => customersApi.campaigns(),
  });

  const coupons = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Coupons"
        subtitle="Percentage or fixed-price offers, public or for chosen customers, with the categories and minimum amount they apply to."
        action={
          canManage ? (
            <Btn onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" /> New coupon
            </Btn>
          ) : undefined
        }
      />

      <Card>
        <TableShell
          head={[
            "Code",
            "Offer",
            "Conditions",
            "Valid till",
            "Used",
            "Status",
            "",
          ]}
        >
          {isLoading && <EmptyRow cols={7} label="Loading…" />}
          {!isLoading && !coupons.length && (
            <EmptyRow
              cols={7}
              label="No coupons yet — create one to run a promotion."
            />
          )}
          {coupons.map((c) => (
            <CouponRow
              key={c.couponId}
              coupon={c}
              canManage={canManage}
              onEdit={() => setEditing(c)}
            />
          ))}
        </TableShell>
      </Card>

      {creating && <CouponModal onClose={() => setCreating(false)} />}
      {editing && (
        <CouponModal coupon={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function CouponRow({
  coupon: c,
  canManage,
  onEdit,
}: {
  coupon: CampaignCoupon;
  canManage: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      customersApi.updateCampaign(c.couponId, { isActive: !c.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const conditions: string[] = [];
  if (c.minOrderAmount != null)
    conditions.push(`Bookings above ${rupees(c.minOrderAmount)}`);
  if (c.categories.length)
    conditions.push(c.categories.map((x) => x.name).join(", "));
  if (c.visibility === "PRIVATE")
    conditions.push(
      `${c.audienceCount} customer${c.audienceCount === 1 ? "" : "s"} only`,
    );
  if (c.visibility === "UNLISTED") conditions.push("Anyone with the code");
  if (c.usesPerCustomer > 1)
    conditions.push(`Up to ${c.usesPerCustomer} uses per customer`);

  return (
    <tr className="transition-colors hover:bg-accent/50">
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {c.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.imageUrl}
              alt=""
              className="h-9 w-14 rounded-md border border-border object-cover"
            />
          )}
          <span className="font-mono font-medium text-foreground">
            {c.code}
          </span>
          {c.visibility === "PRIVATE" && (
            <Tag title="Only the customers on its list can see or use it">
              Private
            </Tag>
          )}
          {c.visibility === "UNLISTED" && (
            <Tag title="Shown to nobody — anyone who types the code can use it">
              Code only
            </Tag>
          )}
          {c.prepaidOnly && (
            <Tag title="Refused on cash on delivery — the customer must pay online">
              Prepaid
            </Tag>
          )}
          {c.firstOrderOnly && (
            <Tag title="Only for customers who have never booked">
              First booking
            </Tag>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{c.description}</div>
      </td>
      <td className="px-4 py-3 text-foreground">{offerLabel(c)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {conditions.length ? (
          conditions.map((x) => <div key={x}>{x}</div>)
        ) : (
          <span>Any service, any amount</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {fmtDate(c.validTill)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {c.redemptions}
        {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
      </td>
      <td className="px-4 py-3">
        <Badge tone={statusTone[c.status]}>{c.status}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {canManage && (
          <div className="flex justify-end gap-1.5">
            <Btn small tone="ghost" onClick={onEdit}>
              Edit
            </Btn>
            <Btn
              small
              tone="ghost"
              busy={toggle.isPending}
              onClick={() => toggle.mutate()}
            >
              {c.isActive ? "Disable" : "Enable"}
            </Btn>
          </div>
        )}
      </td>
    </tr>
  );
}

function Tag({ children, title }: { children: string; title: string }) {
  return (
    <span
      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
      title={title}
    >
      {children}
    </span>
  );
}

/* ───────────────────────── Create / edit ───────────────────────── */

const toDateInput = (iso: string) => iso.slice(0, 10);

/**
 * One form for both creating and editing. On edit the code is fixed (it is
 * what customers have been told) and everything else — the offer, its cap,
 * the minimum, categories, the private list — can change.
 */
function CouponModal({
  coupon,
  onClose,
}: {
  coupon?: CampaignCoupon;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(coupon);

  const [code, setCode] = useState(coupon?.code ?? "");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FLAT_TOTAL">(
    coupon?.discountType ?? "PERCENT",
  );
  const [discountPercent, setDiscountPercent] = useState(
    coupon?.discountPercent != null ? String(coupon.discountPercent) : "20",
  );
  const [maxDiscount, setMaxDiscount] = useState(
    coupon?.maxDiscount != null ? String(coupon.maxDiscount) : "",
  );
  const [flatTotal, setFlatTotal] = useState(
    coupon?.flatTotal != null ? String(coupon.flatTotal) : "1",
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    coupon?.minOrderAmount != null ? String(coupon.minOrderAmount) : "",
  );
  const [validTill, setValidTill] = useState(
    coupon ? toDateInput(coupon.validTill) : "",
  );
  const [visibility, setVisibility] = useState<CouponVisibility>(
    coupon?.visibility ?? "PUBLIC",
  );
  const [audience, setAudience] = useState<CouponAudienceMember[]>(
    coupon?.audience ?? [],
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(
    coupon?.categoryIds ?? [],
  );
  const [firstOrderOnly, setFirstOrderOnly] = useState(
    coupon?.firstOrderOnly ?? false,
  );
  // Off by default: an offer is taken up more readily when it works either way,
  // and requiring prepayment is a deliberate decision about who carries the
  // risk when a customer discounts a job and then is not there.
  const [prepaidOnly, setPrepaidOnly] = useState(coupon?.prepaidOnly ?? false);
  // An auto-written description stays blank here so it keeps following the
  // terms; only text an admin actually wrote is shown for editing.
  const [description, setDescription] = useState(
    coupon && !coupon.descriptionIsAuto ? coupon.description : "",
  );
  const [maxRedemptions, setMaxRedemptions] = useState(
    coupon?.maxRedemptions != null ? String(coupon.maxRedemptions) : "",
  );
  const [usesPerCustomer, setUsesPerCustomer] = useState(
    String(coupon?.usesPerCustomer ?? 1),
  );
  // The offer's picture: uploaded as soon as it is chosen, saved with the form.
  const [image, setImage] = useState<{ url: string; publicId: string } | null>(
    coupon?.imageUrl
      ? { url: coupon.imageUrl, publicId: coupon.imagePublicId ?? "" }
      : null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const uploadImage = useMutation({
    mutationFn: (file: File) => customersApi.uploadCampaignImage(file),
    onSuccess: (r) => {
      setImage(r);
      setImageError(null);
    },
    onError: (e) =>
      setImageError(
        e instanceof ApiError ? e.message : "Could not upload the image.",
      ),
  });
  const [err, setErr] = useState("");

  const { data: categories } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: categoryApi.list,
  });

  const rules = (): CampaignCouponRules => ({
    discountType,
    ...(discountType === "PERCENT"
      ? {
          discountPercent: Number(discountPercent),
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        }
      : { flatTotal: Number(flatTotal) }),
    minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
    visibility,
    categoryIds,
    userIds:
      visibility === "PRIVATE" ? audience.map((a) => a.userId) : undefined,
    firstOrderOnly,
    prepaidOnly,
    description: description.trim() || undefined,
    maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
    usesPerCustomer: Number(usesPerCustomer) || 1,
    imageUrl: image?.url ?? null,
    imagePublicId: image?.publicId ?? null,
  });

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? customersApi.updateCampaign(coupon!.couponId, {
            ...rules(),
            // A blank description on edit means "write the standard one".
            description: description.trim(),
            validTill,
          })
        : customersApi.createCampaign({
            ...rules(),
            code: code.trim().toUpperCase(),
            validTill,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.message
          : `Could not ${isEdit ? "save" : "create"} the coupon.`,
      ),
  });

  const submit = () => {
    setErr("");
    if (!isEdit && !code.trim()) return setErr("Give the coupon a code.");
    if (discountType === "PERCENT") {
      const pct = Number(discountPercent);
      if (!(pct >= 1 && pct <= 100))
        return setErr("The percentage must be between 1 and 100.");
      if (maxDiscount && !(Number(maxDiscount) >= 1))
        return setErr("The maximum discount must be at least ₹1.");
    } else if (!(Number(flatTotal) >= 1)) {
      return setErr("The lowest chargeable amount is ₹1.");
    }
    if (minOrderAmount && !(Number(minOrderAmount) >= 1))
      return setErr("The minimum booking amount must be at least ₹1.");
    if (!validTill) return setErr("Choose the date this coupon stops working.");
    if (visibility === "PRIVATE" && !audience.length)
      return setErr("Add at least one customer, or make the coupon public.");
    if (!(Number(usesPerCustomer) >= 1))
      return setErr("Uses per customer must be at least 1.");
    save.mutate();
  };

  const toggleCategory = (id: number) =>
    setCategoryIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  return (
    <Modal
      title={isEdit ? `Edit ${coupon!.code}` : "New coupon"}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {err && <Notice kind="error">{err}</Notice>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            hint={
              isEdit
                ? "The code cannot change once customers have it."
                : undefined
            }
          >
            <input
              className={inputCls}
              value={code}
              disabled={isEdit}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SAVE20"
            />
          </Field>
          <Field label="Valid till">
            <input
              type="date"
              className={inputCls}
              value={validTill}
              onChange={(e) => setValidTill(e.target.value)}
            />
          </Field>
        </div>

        {/* The offer */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Discount</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              active={discountType === "PERCENT"}
              onClick={() => setDiscountType("PERCENT")}
              title="Percentage off"
              detail="e.g. 20% OFF, with an optional cap"
            />
            <Choice
              active={discountType === "FLAT_TOTAL"}
              onClick={() => setDiscountType("FLAT_TOTAL")}
              title="Fixed total"
              detail="the customer pays one amount, e.g. ₹1"
            />
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {discountType === "PERCENT" ? (
              <>
                <Field label="Percentage off">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={inputCls}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </Field>
                <Field
                  label="Maximum discount (₹, optional)"
                  hint="The most the coupon can take off one booking. Blank = no cap."
                >
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    placeholder="e.g. 300"
                  />
                </Field>
              </>
            ) : (
              <Field label="Customer pays (total, GST included)">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={flatTotal}
                  onChange={(e) => setFlatTotal(e.target.value)}
                />
              </Field>
            )}
            <Field
              label="Minimum booking amount (₹, optional)"
              hint="GST included, before the discount. Blank = any amount."
            >
              <input
                type="number"
                min={1}
                className={inputCls}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="e.g. 1000"
              />
            </Field>
          </div>
        </div>

        {/* Where it applies */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">
            Service categories
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tick the categories the coupon is good for. Nothing ticked = every
            category.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(categories ?? []).map((cat) => {
              const on = categoryIds.includes(cat.categoryId);
              return (
                <button
                  key={cat.categoryId}
                  type="button"
                  onClick={() => toggleCategory(cat.categoryId)}
                  className={`rounded-lg border px-3 py-1 text-xs transition ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
            {categories && !categories.length && (
              <span className="text-xs text-muted-foreground">
                No categories yet.
              </span>
            )}
          </div>
        </div>

        {/* Who gets it */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">
            Who can use it
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              active={visibility === "PUBLIC"}
              onClick={() => setVisibility("PUBLIC")}
              title="Public"
              detail="every customer sees it in their offers"
            />
            <Choice
              active={visibility === "PRIVATE"}
              onClick={() => setVisibility("PRIVATE")}
              title="Private"
              detail="only the customers you pick — e.g. codes the sales team hands out"
            />
            <Choice
              active={visibility === "UNLISTED"}
              onClick={() => setVisibility("UNLISTED")}
              title="Code only"
              detail="shown to nobody; anyone you give the code to can use it — no list to keep"
            />
          </div>
          {visibility === "PRIVATE" && (
            <AudiencePicker audience={audience} onChange={setAudience} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Check
            checked={firstOrderOnly}
            onChange={setFirstOrderOnly}
            title="First booking only"
            detail="Only customers who have never booked. Anyone with a booking, in any state, is excluded."
          />
          <Check
            checked={prepaidOnly}
            onChange={setPrepaidOnly}
            title="Online payment only"
            detail="Refused on cash on delivery. On COD a customer can take the discount and then not be there after the partner has travelled."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Description (shown to customers)"
            hint="Leave blank and the offer and its conditions are written for you."
          >
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                coupon?.descriptionIsAuto
                  ? coupon.description
                  : "20% off chef bookings above ₹1,000"
              }
            />
          </Field>
          <Field label="Maximum redemptions (optional)">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
          </Field>
        </div>

        <Field
          label="Uses per customer"
          hint="How many times the same customer may use this code. 1 = once each. A private or code-only coupon handed to a regular can be made good for several bookings."
        >
          <input
            type="number"
            min={1}
            max={1000}
            className={`${inputCls} max-w-[12rem]`}
            value={usesPerCustomer}
            onChange={(e) => setUsesPerCustomer(e.target.value)}
          />
        </Field>

        {/* Optional picture */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">
            Image (optional)
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A picture shown beside the offer in the app and on the website.
            JPEG, PNG or WebP, up to 3 MB; landscape works best.
          </p>
          <input
            ref={imageRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 3 * 1024 * 1024) {
                setImageError("The image must be 3 MB or smaller.");
                return;
              }
              uploadImage.mutate(file);
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt="Coupon"
                className="h-20 w-36 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                No image
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Btn
                tone="ghost"
                small
                busy={uploadImage.isPending}
                onClick={() => imageRef.current?.click()}
              >
                {image ? "Replace image" : "Upload image"}
              </Btn>
              {image && (
                <Btn tone="ghost" small onClick={() => setImage(null)}>
                  Remove
                </Btn>
              )}
            </div>
          </div>
          {imageError && (
            <div className="mt-2">
              <Notice kind="error">{imageError}</Notice>
            </div>
          )}
        </div>

        <p className="rounded-xl bg-accent/40 px-4 py-3 text-xs text-muted-foreground">
          {Number(usesPerCustomer) > 1
            ? `Each customer can use this code up to ${Number(usesPerCustomer)} times. `
            : "Each customer can use this code once. "}
          The partner is still paid the job&rsquo;s full price, so the discount
          is the platform&rsquo;s cost, not theirs.
        </p>

        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn busy={save.isPending} onClick={submit}>
            {isEdit ? "Save changes" : "Create coupon"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function Choice({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-medium text-foreground">{title}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function Check({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

/**
 * The private list: search customers by name or mobile and add them; the chips
 * are exactly who may use the code. Removing someone takes effect on save,
 * with the rest of the form.
 */
function AudiencePicker({
  audience,
  onChange,
}: {
  audience: CouponAudienceMember[];
  onChange: (next: CouponAudienceMember[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["admin", "coupon-audience-search", debounced],
    queryFn: () => customersApi.list(debounced),
    enabled: debounced.length >= 2,
  });

  const chosen = useMemo(
    () => new Set(audience.map((a) => a.userId)),
    [audience],
  );
  const candidates = (results ?? [])
    .filter((c) => !chosen.has(c.userId))
    .slice(0, 8);

  return (
    <div className="mt-3 space-y-3">
      <div>
        <input
          className={inputCls}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name or mobile…"
        />
        {debounced.length >= 2 && (
          <div className="mt-1 overflow-hidden rounded-xl border border-border">
            {isFetching && !results && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Searching…
              </div>
            )}
            {results && !candidates.length && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No more customers match.
              </div>
            )}
            {candidates.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => {
                  onChange([
                    ...audience,
                    { userId: c.userId, name: c.name, mobile: c.mobile },
                  ]);
                  setSearch("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.mobile ?? c.email ?? ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {audience.map((a) => (
          <span
            key={a.userId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
          >
            {a.name}
            {a.mobile ? (
              <span className="text-muted-foreground">· {a.mobile}</span>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onChange(audience.filter((x) => x.userId !== a.userId))
              }
              className="ml-0.5 text-muted-foreground hover:text-danger"
              aria-label={`Remove ${a.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {!audience.length && (
          <span className="text-xs text-muted-foreground">
            Nobody yet — search above to add customers.
          </span>
        )}
      </div>
      {audience.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {audience.length} customer{audience.length === 1 ? "" : "s"} will see
          this coupon.
        </p>
      )}
    </div>
  );
}
