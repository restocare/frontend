"use client";

/**
 * Roles & permissions cards view: pick a role, then flip module/action
 * toggles on a grid of module cards and save. Design mirrors the AI sales
 * agent panel's "clean cards" role manager, adapted to this panel's RBAC
 * model (permission keys are "module.action" strings saved via updateRole).
 */
import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, rbacApi, type RbacRoleRow } from "@/src/api/api";
import { Btn, Field, Modal, Notice, inputCls } from "@/src/components/crm/ui";
import { hasPermission, isSuperAdmin } from "@/src/lib/auth";
import {
  BagIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CartIcon,
  ChartIcon,
  ClipboardIcon,
  ClockIcon,
  EyeIcon,
  GridIcon,
  ImageIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  SettingsIcon,
  ShieldIcon,
  SpinnerIcon,
  StarIcon,
  StoreIcon,
  TrashIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "@/src/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/* ── Presentation metadata (icon / colour) keyed by backend module + action ──
   Falls back gracefully for any module/action the backend adds later. */

const MODULE_META: Record<
  string,
  { icon: Icon; color: string; bg: string; desc: string }
> = {
  crm: {
    icon: GridIcon,
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.12)",
    desc: "CRM overview access",
  },
  analytics: {
    icon: ChartIcon,
    color: "#4f7cff",
    bg: "rgba(79,124,255,0.12)",
    desc: "KPIs, trends & breakdowns",
  },
  // Separate from analytics on purpose: it reads the same numbers out loud and
  // holds the microphone open, so it is granted deliberately.
  "ai-analyst": {
    icon: ChartIcon,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    desc: "Voice analyst — clap twice, hear the week",
  },
  // WhatsApp marketing. "manage" can message every customer in a segment, so
  // the super admin hands it out deliberately rather than it riding along with
  // general CRM access.
  campaigns: {
    icon: ImageIcon,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    desc: "WhatsApp blasts to customer segments",
  },
  categories: {
    icon: StoreIcon,
    color: "#ffc845",
    bg: "rgba(255,200,69,0.12)",
    desc: "Service categories",
  },
  banners: {
    icon: ImageIcon,
    color: "#e879f9",
    bg: "rgba(232,121,249,0.12)",
    desc: "Landing page banners",
  },
  dispatcher: {
    icon: RouteIcon,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    desc: "Teams, zones & allocation",
  },
  customers: {
    icon: UsersIcon,
    color: "#4f7cff",
    bg: "rgba(79,124,255,0.12)",
    desc: "Customer accounts",
  },
  partners: {
    icon: BriefcaseIcon,
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.12)",
    desc: "Service partners",
  },
  bookings: {
    icon: BagIcon,
    color: "#3dd68c",
    bg: "rgba(61,214,140,0.12)",
    desc: "Bookings & jobs",
  },
  contact: {
    icon: MailIcon,
    color: "#fb7185",
    bg: "rgba(251,113,133,0.12)",
    desc: "Contact us enquiries",
  },
  wallets: {
    icon: WalletIcon,
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    desc: "Partner wallet balances",
  },
  payouts: {
    icon: WalletIcon,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    desc: "Partner payout requests",
  },
  vendors: {
    icon: CartIcon,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    desc: "Vendor storefronts",
  },
  employees: {
    icon: UserCircleIcon,
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
    desc: "Employee records",
  },
  attendance: {
    icon: ClockIcon,
    color: "#2dd4bf",
    bg: "rgba(45,212,191,0.12)",
    desc: "Attendance tracking",
  },
  leaves: {
    icon: CalendarIcon,
    color: "#f472b6",
    bg: "rgba(244,114,182,0.12)",
    desc: "Leave requests",
  },
  appraisals: {
    icon: StarIcon,
    color: "#ffc845",
    bg: "rgba(255,200,69,0.12)",
    desc: "Performance appraisals",
  },
  staff: {
    icon: ShieldIcon,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    desc: "Panel staff logins",
  },
  roles: {
    icon: LockIcon,
    color: "#ff7eb3",
    bg: "rgba(255,126,179,0.12)",
    desc: "Role configuration",
  },
  departments: {
    icon: ClipboardIcon,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    desc: "Departments & designations",
  },
  offices: {
    icon: MapPinIcon,
    color: "#818cf8",
    bg: "rgba(129,140,248,0.12)",
    desc: "Office locations",
  },
  payments: {
    icon: WalletIcon,
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    desc: "Payments & payouts",
  },
  tasks: {
    icon: ClipboardIcon,
    color: "#818cf8",
    bg: "rgba(129,140,248,0.12)",
    desc: "Task board & reports",
  },
  workspaces: {
    icon: BuildingIcon,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    desc: "Workspace access & ownership",
  },
  ess: {
    icon: UserCircleIcon,
    color: "#2dd4bf",
    bg: "rgba(45,212,191,0.12)",
    desc: "Tabs in the employee's panel",
  },
  settings: {
    icon: SettingsIcon,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    desc: "Panel settings & password",
  },
  configure: {
    icon: WrenchIcon,
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
    desc: "Platform credentials",
  },
  // SaaS platform (the /real-estate section) — its feature modules, so a panel
  // role can be granted access to each part of the SaaS app.
  saas: {
    icon: BuildingIcon,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    desc: "SaaS · show the platform tab",
  },
  users: {
    icon: UsersIcon,
    color: "#4f7cff",
    bg: "rgba(79,124,255,0.12)",
    desc: "SaaS · platform users",
  },
  forms: {
    icon: ClipboardIcon,
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    desc: "SaaS · dynamic forms",
  },
  leads: {
    icon: BriefcaseIcon,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    desc: "SaaS · lead management",
  },
  projects: {
    icon: MapPinIcon,
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
    desc: "SaaS · real-estate projects",
  },
  reports: {
    icon: ChartIcon,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    desc: "SaaS · reports & analytics",
  },
};

/* ── Parent tabs ──────────────────────────────────────────────────────────
   Mirrors the sidebar's top-level groups so a super admin toggles access the
   same way it appears to the user. Every backend module is listed exactly once;
   anything the backend adds later that isn't mapped falls into "Other modules"
   so it is never hidden from this screen. */

const MODULE_GROUPS: {
  id: string;
  label: string;
  desc: string;
  icon: Icon;
  modules: string[];
}[] = [
  {
    id: "my-space",
    label: "My Space",
    desc: "The employee's own panel — one tab per switch",
    icon: UserCircleIcon,
    modules: ["ess"],
  },
  {
    id: "crm",
    label: "CRM",
    desc: "Clients, pipeline, support & revenue",
    icon: GridIcon,
    modules: [
      "crm",
      "restaurants",
      "sales-leads",
      "customers",
      "bookings",
      "ops",
      "finance",
      "tickets",
      "campaigns",
      "crm-reports",
      "contact",
    ],
  },
  {
    id: "hr",
    label: "HR Management",
    desc: "Employee records, attendance, payroll & hiring",
    icon: UsersIcon,
    modules: [
      "employees",
      "attendance",
      "leaves",
      "appraisals",
      "payroll",
      "offer-letters",
      "positions",
      "holidays",
      "departments",
      "offices",
    ],
  },
  {
    id: "dispatch",
    label: "Dispatch & Partners",
    desc: "Service partners, zones, wallets & payouts",
    icon: RouteIcon,
    modules: ["partners", "dispatcher", "wallets", "payouts", "referrals"],
  },
  {
    id: "tasks",
    label: "Task Management",
    desc: "Assign work, track progress & pull completion reports",
    icon: ClipboardIcon,
    modules: ["tasks"],
  },
  {
    id: "admin",
    label: "Admin Panel",
    desc: "Storefront, tools & platform settings",
    icon: SettingsIcon,
    modules: [
      "analytics",
      "ai-analyst",
      "categories",
      "banners",
      "vendors",
      "payments",
      "styling",
      "ai-tutor",
      "pdf-editor",
      "resume-builder",
      "settings",
    ],
  },
  {
    id: "workspaces",
    label: "Workspaces",
    desc: "Hand a self-contained mini-panel to a workspace admin",
    icon: BuildingIcon,
    modules: ["workspaces"],
  },
  {
    id: "access",
    label: "Access Control",
    desc: "Who may administer roles and panel logins",
    icon: LockIcon,
    modules: ["roles", "staff"],
  },
  {
    id: "saas",
    label: "Real Estate (SaaS)",
    desc: "The platform section and its feature modules",
    icon: BuildingIcon,
    modules: [
      "saas",
      "users",
      "forms",
      "leads",
      "projects",
      "reports",
      "configure",
    ],
  },
];

const ACTION_META: Record<string, { icon: Icon; cls: string }> = {
  view: { icon: EyeIcon, cls: "text-[#4f7cff] border-[rgba(79,124,255,0.25)]" },
  create: {
    icon: PlusIcon,
    cls: "text-[#3dd68c] border-[rgba(61,214,140,0.25)]",
  },
  update: {
    icon: PencilIcon,
    cls: "text-[#ffc845] border-[rgba(255,200,69,0.25)]",
  },
  edit: {
    icon: PencilIcon,
    cls: "text-[#ffc845] border-[rgba(255,200,69,0.25)]",
  },
  delete: {
    icon: TrashIcon,
    cls: "text-[#ff5e6b] border-[rgba(255,94,107,0.25)]",
  },
  export: {
    icon: ChartIcon,
    cls: "text-[#38bdf8] border-[rgba(56,189,248,0.25)]",
  },
  manage: {
    icon: SettingsIcon,
    cls: "text-[#fb923c] border-[rgba(251,146,60,0.25)]",
  },
  approve: {
    icon: ShieldIcon,
    cls: "text-[#2dd4bf] border-[rgba(45,212,191,0.25)]",
  },
  assign: {
    icon: UsersIcon,
    cls: "text-[#a78bfa] border-[rgba(167,139,250,0.25)]",
  },
  report: {
    icon: ChartIcon,
    cls: "text-[#38bdf8] border-[rgba(56,189,248,0.25)]",
  },
  "manage-types": {
    icon: SettingsIcon,
    cls: "text-[#fb923c] border-[rgba(251,146,60,0.25)]",
  },
  "adjust-balance": {
    icon: WalletIcon,
    cls: "text-[#34d399] border-[rgba(52,211,153,0.25)]",
  },
  // My Space tabs — each action is one sidebar entry in the employee's panel.
  portal: {
    icon: GridIcon,
    cls: "text-[#4f7cff] border-[rgba(79,124,255,0.25)]",
  },
  attendance: {
    icon: ClockIcon,
    cls: "text-[#2dd4bf] border-[rgba(45,212,191,0.25)]",
  },
  leaves: {
    icon: CalendarIcon,
    cls: "text-[#f472b6] border-[rgba(244,114,182,0.25)]",
  },
  payslips: {
    icon: WalletIcon,
    cls: "text-[#34d399] border-[rgba(52,211,153,0.25)]",
  },
  "offer-letters": {
    icon: MailIcon,
    cls: "text-[#fb7185] border-[rgba(251,113,133,0.25)]",
  },
  increments: {
    icon: ChartIcon,
    cls: "text-[#a78bfa] border-[rgba(167,139,250,0.25)]",
  },
  holidays: {
    icon: CalendarIcon,
    cls: "text-[#ffc845] border-[rgba(255,200,69,0.25)]",
  },
  positions: {
    icon: BriefcaseIcon,
    cls: "text-[#38bdf8] border-[rgba(56,189,248,0.25)]",
  },
  tasks: {
    icon: ClipboardIcon,
    cls: "text-[#818cf8] border-[rgba(129,140,248,0.25)]",
  },
};

/* Where an action maps to a literal sidebar tab, label it as the user sees it
   rather than as the raw permission verb. */
const ACTION_LABEL: Record<string, Record<string, string>> = {
  attendance: {
    update: "Fix missed check-in / check-out",
  },
  ess: {
    view: "Show My Space",
    portal: "My Portal",
    attendance: "My Attendance",
    leaves: "My Leaves",
    payslips: "Payslips",
    "offer-letters": "Offer Letters",
    increments: "Increments",
    holidays: "Holidays",
    positions: "Open positions",
    tasks: "My Tasks",
  },
  campaigns: {
    // "Manage" is the consequential one: it creates a campaign AND sends it,
    // which puts a real WhatsApp message on hundreds of real phones and cannot
    // be recalled. Naming that on the switch matters more than consistency
    // with the generic View/Manage wording elsewhere.
    view: "See campaigns & delivery results",
    manage: "Create and SEND campaigns to customers",
    // Separate from "manage" on purpose: this changes what the business is
    // allowed to say, and every template goes to Meta for review.
    templates: "Create & delete WhatsApp templates",
    // A support seat: what customers write back to the business number, and
    // answering them. Deliberately not bundled with sending campaigns.
    inbox: "WhatsApp inbox — read customer replies and answer them",
  },
  tasks: {
    view: "All Tasks (tab)",
    report: "Task Reports (tab)",
    create: "Create task",
    update: "Edit task",
    assign: "Assign to employee",
    delete: "Delete task",
  },
};

const actionLabel = (module: string, action: string) =>
  ACTION_LABEL[module]?.[action] ?? titleCase(action);

const moduleMeta = (id: string) =>
  MODULE_META[id] ?? {
    icon: GridIcon,
    color: "#818cf8",
    bg: "rgba(129,140,248,0.12)",
    desc: "Module access",
  };

const actionMeta = (action: string) =>
  ACTION_META[action] ?? {
    icon: GridIcon,
    cls: "text-muted-foreground border-border",
  };

const titleCase = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ────────────────────────────── Switch ─────────────────────────────── */

function Switch({
  checked,
  onChange,
  disabled,
  small,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  small?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        small ? "h-4.5 w-8.5" : "h-5.5 w-10"
      } ${checked ? "bg-success" : "bg-muted"}`}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow transition ${
          small
            ? `h-3.5 w-3.5 ${checked ? "translate-x-4.5" : "translate-x-0.5"}`
            : `h-4.5 w-4.5 ${checked ? "translate-x-5" : "translate-x-0.5"}`
        }`}
      />
    </button>
  );
}

/* ─────────────────────────── Module card ───────────────────────────── */

function ModuleCard({
  module,
  actions,
  selected,
  canEdit,
  onToggleKey,
  onToggleModule,
}: {
  module: string;
  actions: { action: string; key: string }[];
  selected: Set<string>;
  canEdit: boolean;
  onToggleKey: (key: string, on: boolean) => void;
  onToggleModule: (keys: string[], on: boolean) => void;
}) {
  const meta = moduleMeta(module);
  const ModuleIcon = meta.icon;
  const keys = actions.map((a) => a.key);
  const onCount = keys.filter((k) => selected.has(k)).length;
  const enabled = onCount > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition ${
        enabled ? "border-primary/30" : "border-border"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent transition-opacity ${
          enabled ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Card header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: meta.bg, color: meta.color }}
          >
            <ModuleIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {titleCase(module)}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {meta.desc}
            </span>
          </span>
        </div>
        <Switch
          checked={enabled}
          disabled={!canEdit}
          onChange={(on) => onToggleModule(keys, on)}
          label={`Toggle all ${module} permissions`}
        />
      </div>

      <div className="mb-3 h-px bg-border" />

      {/* Permission rows — one per backend action */}
      <div className="flex flex-col gap-1.5">
        {actions.map(({ action, key }) => {
          const am = actionMeta(action);
          const ActionIcon = am.icon;
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-md border bg-muted/50 ${am.cls}`}
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {actionLabel(module, action)}
                </span>
              </span>
              <Switch
                small
                checked={selected.has(key)}
                disabled={!canEdit}
                onChange={(on) => onToggleKey(key, on)}
                label={`${module} ${action}`}
              />
            </div>
          );
        })}
      </div>

      {/* Card footer */}
      <div className="mt-3 border-t border-border pt-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          <span className="font-semibold text-primary">{onCount}</span>/
          {keys.length} permissions
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────── Parent-tab section ───────────────────────── */

function GroupSection({
  group,
  mods,
  selected,
  canEdit,
  onToggleKey,
  onToggleModule,
}: {
  group: { id: string; label: string; desc: string; icon: Icon };
  mods: { module: string; actions: string[]; keys: string[] }[];
  selected: Set<string>;
  canEdit: boolean;
  onToggleKey: (key: string, on: boolean) => void;
  onToggleModule: (keys: string[], on: boolean) => void;
}) {
  const GroupIcon = group.icon;
  const groupKeys = mods.flatMap((m) => m.keys);
  const onCount = groupKeys.filter((k) => selected.has(k)).length;
  // "Highlight parent tab": lit whenever anything inside it is granted.
  const active = onCount > 0;
  const activeModules = mods.filter((m) =>
    m.keys.some((k) => selected.has(k)),
  ).length;

  return (
    <section
      className={`overflow-hidden rounded-2xl border transition ${
        active
          ? "border-primary/40 bg-primary/[0.04]"
          : "border-border bg-card/40"
      }`}
    >
      {/* Parent header — one switch flips every module inside. */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 transition ${
          active ? "border-primary/25 bg-primary/[0.06]" : "border-border"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
              active
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <GroupIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`truncate text-sm font-semibold ${
                  active ? "text-primary" : "text-foreground"
                }`}
              >
                {group.label}
              </h3>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {activeModules}/{mods.length} modules
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {group.desc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="font-semibold text-primary">{onCount}</span>/
            {groupKeys.length}
          </span>
          <Switch
            checked={active}
            disabled={!canEdit}
            onChange={(on) => onToggleModule(groupKeys, on)}
            label={`Toggle every permission under ${group.label}`}
          />
        </div>
      </header>

      {/* Every module of this parent tab, shown inside it. */}
      <div
        className="grid gap-4 p-5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {mods.map((mod) => (
          <ModuleCard
            key={mod.module}
            module={mod.module}
            actions={mod.actions.map((action, i) => ({
              action,
              key: mod.keys[i],
            }))}
            selected={selected}
            canEdit={canEdit}
            onToggleKey={onToggleKey}
            onToggleModule={onToggleModule}
          />
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── New-role modal ──────────────────────────── */

function NewRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (role: RbacRoleRow) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () =>
      rbacApi.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: onCreated,
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : "Could not create the role."),
  });

  return (
    <Modal title="Create new role" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <p className="text-sm text-muted-foreground">
          Add a custom role, then flip its permissions on the cards.
        </p>
        <Field label="Role name">
          <input
            className={inputCls}
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regional Manager"
          />
        </Field>
        <Field label="Description" hint="What this role is for (optional)">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            busy={create.isPending}
            disabled={name.trim().length < 2}
          >
            Create role
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── Main panel ──────────────────────────── */

export function RolesPermissionsPanel() {
  const qc = useQueryClient();
  const canEditRoles = hasPermission("roles.update");
  const canCreate = hasPermission("roles.create");
  const canDelete = hasPermission("roles.delete");

  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncKey, setSyncKey] = useState("");
  const [showNewRole, setShowNewRole] = useState(false);
  // Built-in (product-shipped) roles start hidden — the list should lead with
  // the roles this panel created.
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const rolesQuery = useQuery({
    queryKey: crmQueryKeys.rbacRoles,
    queryFn: rbacApi.roles,
  });
  const catalogQuery = useQuery({
    queryKey: crmQueryKeys.rbacCatalog,
    queryFn: rbacApi.permissionCatalog,
  });

  // The backend already omits super_admin for non-super-admin callers; this
  // client-side filter is belt-and-braces for cached/stale query data.
  const allRoles = useMemo(
    () =>
      (rolesQuery.data ?? []).filter(
        (r) => r.name !== "super_admin" || isSuperAdmin(),
      ),
    [rolesQuery.data],
  );
  // Built-in roles are hidden by default so the list leads with the ones this
  // panel actually created; the toggle below brings them back when needed.
  const builtInCount = allRoles.filter((r) => r.isSeeded).length;
  const roles = useMemo(
    () => (showBuiltIn ? allRoles : allRoles.filter((r) => !r.isSeeded)),
    [allRoles, showBuiltIn],
  );
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  // Fall back to the first role until the user explicitly picks one.
  const effectiveRoleId = activeRoleId ?? roles[0]?.roleId ?? null;
  const activeRole = roles.find((r) => r.roleId === effectiveRoleId) ?? null;

  // The permission set that lives on the server for the active role.
  const serverSelected = useMemo(
    () => new Set(activeRole?.permissions ?? []),
    [activeRole],
  );

  // Reset the editable selection whenever the active role (or its server-side
  // permissions) change — "adjust state during render", no effect needed.
  const serverKey = activeRole
    ? `${activeRole.roleId}:${[...serverSelected].sort().join(",")}`
    : "";
  if (serverKey !== syncKey) {
    setSyncKey(serverKey);
    setSelected(new Set(serverSelected));
  }

  const dirty = useMemo(() => {
    if (selected.size !== serverSelected.size) return true;
    for (const k of selected) if (!serverSelected.has(k)) return true;
    return false;
  }, [selected, serverSelected]);

  const toggleKey = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleModule = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  // Bucket the backend catalog into the sidebar's parent tabs. Modules the map
  // doesn't know about still render, under "Other modules", so a newly added
  // backend module is never invisible here.
  const groupedCatalog = useMemo(() => {
    type Section = {
      group: { id: string; label: string; desc: string; icon: Icon };
      mods: (typeof catalog)[number][];
    };
    const byModule = new Map(catalog.map((m) => [m.module, m]));
    const taken = new Set<string>();
    const sections: Section[] = MODULE_GROUPS.map((group) => {
      const mods = group.modules
        .map((id) => byModule.get(id))
        .filter((m): m is (typeof catalog)[number] => {
          if (!m) return false;
          taken.add(m.module);
          return true;
        });
      return { group, mods };
    }).filter((s) => s.mods.length > 0);

    const leftovers = catalog.filter((m) => !taken.has(m.module));
    if (leftovers.length) {
      sections.push({
        group: {
          id: "other",
          label: "Other modules",
          desc: "Not yet mapped to a parent tab",
          icon: GridIcon,
        },
        mods: leftovers,
      });
    }
    return sections;
  }, [catalog]);

  const allKeys = useMemo(() => catalog.flatMap((m) => m.keys), [catalog]);
  const allEnabled =
    allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const saveMutation = useMutation({
    mutationFn: () =>
      rbacApi.updateRole(effectiveRoleId!, { permissions: [...selected] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac"] });
      setNotice({ kind: "success", text: "Permissions saved." });
    },
    onError: (e) =>
      setNotice({
        kind: "error",
        text: e instanceof ApiError ? e.message : "Could not save permissions.",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rbacApi.deleteRole(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ["rbac"] });
      if (effectiveRoleId === id) setActiveRoleId(null);
      setConfirmDelete(false);
      setNotice({ kind: "success", text: "Role deleted." });
    },
    onError: (e) => {
      setConfirmDelete(false);
      setNotice({
        kind: "error",
        text: e instanceof ApiError ? e.message : "Could not delete the role.",
      });
    },
  });

  // Derived stats for the chips row.
  const activeModuleCount = catalog.filter((m) =>
    m.keys.some((k) => selected.has(k)),
  ).length;

  const loading = rolesQuery.isLoading || catalogQuery.isLoading;
  const loadError = rolesQuery.isError || catalogQuery.isError;

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  if (loadError) {
    // A 403 here means the signed-in role simply lacks roles.view — reporting
    // that as "couldn't load" sends people hunting for a bug that isn't there.
    const err = rolesQuery.error ?? catalogQuery.error;
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      return (
        <Notice kind="error">
          Your role doesn’t have access to Roles &amp; Permissions
          {err.message?.includes("Missing permissions")
            ? ` — ${err.message.toLowerCase()}`
            : ""}
          . Ask a super admin to grant it.
        </Notice>
      );
    }
    return (
      <Notice kind="error">
        Couldn’t load roles or the permission catalog.
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Role tabs */}
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.roleId}
              onClick={() => setActiveRoleId(r.roleId)}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                effectiveRoleId === r.roleId
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <span className="h-1.75 w-1.75 shrink-0 rounded-full bg-current opacity-70" />
              {titleCase(r.name)}
              {r.isSystem && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  sys
                </span>
              )}
            </button>
          ))}
          {roles.length === 0 && (
            <span className="text-sm text-muted-foreground">
              {builtInCount > 0
                ? "No roles of your own yet — create one, or show the built-in roles."
                : "No roles yet. Create one to get started."}
            </span>
          )}
          {builtInCount > 0 && (
            <button
              onClick={() => setShowBuiltIn((v) => !v)}
              className="rounded-full border border-dashed border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              {showBuiltIn
                ? "Hide built-in"
                : `Show built-in (${builtInCount})`}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn
            small
            tone="ghost"
            disabled={!dirty}
            onClick={() => setSelected(new Set(serverSelected))}
          >
            ↺ Reset
          </Btn>
          {canCreate && (
            <Btn small tone="ghost" onClick={() => setShowNewRole(true)}>
              <PlusIcon className="h-4 w-4" /> Create role
            </Btn>
          )}
          {canDelete && activeRole && !activeRole.isSystem && (
            <Btn small tone="danger" onClick={() => setConfirmDelete(true)}>
              Delete role
            </Btn>
          )}
          {canEditRoles && (
            <Btn
              small
              busy={saveMutation.isPending}
              disabled={!effectiveRoleId || !dirty}
              onClick={() => saveMutation.mutate()}
            >
              ✓ Save changes
            </Btn>
          )}
        </div>
      </div>

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {/* Stats chips */}
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          Modules active:{" "}
          <strong className="font-semibold text-foreground">
            {activeModuleCount}
          </strong>
        </span>
        <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          Permissions on:{" "}
          <strong className="font-semibold text-foreground">
            {selected.size}
          </strong>
        </span>
        <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
          Role:{" "}
          <strong className="font-semibold text-foreground">
            {activeRole ? titleCase(activeRole.name) : "—"}
          </strong>
        </span>
        {activeRole != null && (
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
            Users:{" "}
            <strong className="font-semibold text-foreground">
              {activeRole.userCount ?? 0}
            </strong>
          </span>
        )}
      </div>

      {!canEditRoles && (
        <Notice kind="error">
          You have read-only access to roles — editing requires the roles.update
          permission.
        </Notice>
      )}

      {/* Section head */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Modules
        </span>
        {canEditRoles && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Enable all
            <Switch
              checked={allEnabled}
              onChange={(on) => setSelected(new Set(on ? allKeys : []))}
              label="Enable all permissions"
            />
          </span>
        )}
      </div>

      {/* Modules, grouped under the parent tab they appear in */}
      <div className="flex flex-col gap-5">
        {groupedCatalog.map(({ group, mods }) => (
          <GroupSection
            key={group.id}
            group={group}
            mods={mods}
            selected={selected}
            canEdit={canEditRoles && !!activeRole}
            onToggleKey={toggleKey}
            onToggleModule={toggleModule}
          />
        ))}
      </div>

      {showNewRole && (
        <NewRoleModal
          onClose={() => setShowNewRole(false)}
          onCreated={(created) => {
            qc.invalidateQueries({ queryKey: ["rbac"] });
            setActiveRoleId(created.roleId);
            setShowNewRole(false);
            setNotice({
              kind: "success",
              text: `Role “${created.name}” created.`,
            });
          }}
        />
      )}

      {confirmDelete && activeRole && (
        <Modal title="Delete role" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-muted-foreground">
            Delete{" "}
            <span className="font-medium text-foreground">
              {titleCase(activeRole.name)}
            </span>
            ? Staff members holding it lose its access. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Btn>
            <Btn
              tone="danger"
              busy={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(activeRole.roleId)}
            >
              Delete
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
