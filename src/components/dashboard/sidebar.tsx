"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AuraIcon,
  BagIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CartIcon,
  ChartIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  GridIcon,
  ImageIcon,
  LogoutIcon,
  MailIcon,
  MapPinIcon,
  MonitorIcon,
  PaletteIcon,
  PolygonIcon,
  RouteIcon,
  SettingsIcon,
  ShieldIcon,
  SmartphoneIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  WrenchIcon,
} from "@/src/components/icons";
import {
  getPermissions,
  getStoredUser,
  isSuperAdmin,
  permissionsSnapshot,
  subscribePermissions,
} from "@/src/lib/auth";
import type { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// `permission` gates visibility for STAFF users (admins hold "*"). Leaves
// without a permission are visible to every panel session.
type NavLeaf = {
  label: string;
  href: string;
  icon: IconType;
  permission?: string;
  // A tool everyone gets regardless of role — chat is the only one today.
  // Without this, STAFF would be filtered out of it: their rule is "only
  // admin-panel entries the role explicitly grants".
  always?: boolean;
};
// `permission` on a group is the PARENT switch: when set and not granted, the
// whole group is hidden even if individual children are still granted.
type NavGroup = {
  label: string;
  icon: IconType;
  permission?: string;
  children: NavLeaf[];
};
type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => "children" in entry;

// Sections of the classic admin panel — hidden entirely from STAFF logins.
const ADMIN_NAV: NavEntry[] = [
  { label: "Overview", href: "/dashboard", icon: GridIcon },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: ChartIcon,
    permission: "analytics.view",
  },
  {
    label: "Categories",
    href: "/dashboard/categories",
    icon: StoreIcon,
    permission: "categories.view",
  },
  {
    label: "Banner",
    href: "/dashboard/banners",
    icon: ImageIcon,
    permission: "banners.view",
  },
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: BagIcon,
    permission: "bookings.view",
  },
  {
    label: "Tasks",
    icon: ClipboardIcon,
    children: [
      {
        label: "All Tasks",
        href: "/dashboard/tasks",
        icon: ClipboardIcon,
        permission: "tasks.view",
      },
      {
        label: "Task Reports",
        href: "/dashboard/tasks/reports",
        icon: ChartIcon,
        permission: "tasks.report",
      },
    ],
  },
  {
    label: "Quick Commerce",
    icon: StoreIcon,
    children: [
      {
        label: "Vendors",
        href: "/dashboard/qc/vendors",
        icon: UsersIcon,
        permission: "qc-vendors.view",
      },
      {
        label: "QC Orders",
        href: "/dashboard/qc/orders",
        icon: BagIcon,
        permission: "qc-orders.view",
      },
      {
        label: "Delivery Partners",
        href: "/dashboard/qc/delivery-partners",
        icon: UsersIcon,
        permission: "qc-orders.view",
      },
      {
        label: "QC Settings",
        href: "/dashboard/qc/settings",
        icon: TagIcon,
        permission: "qc-settings.manage",
      },
      // The vendor's own portal — the only entry a qc_vendor login can see.
      {
        label: "My Store",
        href: "/dashboard/qc/my-store",
        icon: StoreIcon,
        permission: "qc-vendor-portal.view",
      },
    ],
  },
  {
    label: "Dispatcher",
    icon: MapPinIcon,
    children: [
      {
        label: "Service Partners",
        href: "/dashboard/dispatcher/partners",
        icon: UsersIcon,
        permission: "partners.view",
      },
      {
        label: "Partner Progress",
        href: "/dashboard/dispatcher/partner-progress",
        icon: RouteIcon,
        permission: "partner-progress.view",
      },
      {
        label: "Partner MIS Report",
        href: "/dashboard/dispatcher/partner-mis",
        icon: ChartIcon,
        permission: "partners.view",
      },
      {
        label: "Bank & Payout MIS",
        href: "/dashboard/dispatcher/bank-payout-mis",
        icon: WalletIcon,
        permission: "payouts.view",
      },
      {
        label: "Teams",
        href: "/dashboard/dispatcher/teams",
        icon: UsersIcon,
        permission: "dispatcher.view",
      },
      {
        label: "Geo Fence",
        href: "/dashboard/dispatcher/geo-fence",
        icon: PolygonIcon,
        permission: "dispatcher.view",
      },
      {
        label: "Warehouses",
        href: "/dashboard/dispatcher/warehouses",
        icon: WarehouseIcon,
        permission: "dispatcher.view",
      },
      {
        label: "Auto Allocation",
        href: "/dashboard/dispatcher/allocation",
        icon: RouteIcon,
        permission: "dispatcher.view",
      },
      {
        label: "Pricing Rules",
        href: "/dashboard/dispatcher/pricing",
        icon: TagIcon,
        permission: "dispatcher.view",
      },
      {
        label: "Partner Wallets",
        href: "/dashboard/dispatcher/wallets",
        icon: WalletIcon,
        permission: "wallets.view",
      },
      {
        label: "Partner Payouts",
        href: "/dashboard/dispatcher/payouts",
        icon: WalletIcon,
        permission: "payouts.view",
      },
      {
        label: "Referrals",
        href: "/dashboard/dispatcher/referrals",
        icon: TagIcon,
        permission: "referrals.view",
      },
    ],
  },
  {
    label: "Workspaces",
    href: "/dashboard/workspaces",
    icon: BuildingIcon,
    permission: "workspaces.view",
  },
  {
    label: "Chat",
    icon: MailIcon,
    children: [
      // Messaging itself needs no permission — every panel login can chat.
      {
        label: "Team Chat",
        href: "/dashboard/chat",
        icon: MailIcon,
        always: true,
      },
      {
        label: "Chat Admin",
        href: "/dashboard/chat/admin",
        icon: ShieldIcon,
        permission: "chat.view",
      },
    ],
  },
  {
    label: "Contacts",
    href: "/dashboard/contacts",
    icon: MailIcon,
    permission: "contact.view",
  },
  {
    label: "Vendors",
    href: "/dashboard/vendors",
    icon: CartIcon,
    permission: "vendors.view",
  },
  {
    label: "Payments",
    href: "/dashboard/payments",
    icon: WalletIcon,
    permission: "payments.view",
  },
  {
    label: "Styling",
    icon: PaletteIcon,
    children: [
      {
        label: "Web Styling",
        href: "/dashboard/styling/web",
        icon: MonitorIcon,
        permission: "styling.view",
      },
      {
        label: "Mobile Styling",
        href: "/dashboard/styling/mobile",
        icon: SmartphoneIcon,
        permission: "styling.view",
      },
    ],
  },
  {
    label: "Tools",
    icon: WrenchIcon,
    children: [
      {
        label: "PDF Editor",
        href: "/dashboard/tools/pdf-editor",
        icon: FileTextIcon,
        permission: "pdf-editor.view",
      },
      {
        label: "Resume Builder",
        href: "/dashboard/tools/resume-builder",
        icon: ClipboardIcon,
        permission: "resume-builder.view",
      },
    ],
  },
  // Immersive AI teacher — grantable per role (admins hold "*").
  {
    label: "AI Tutor",
    href: "/dashboard/tutor",
    icon: GraduationCapIcon,
    permission: "ai-tutor.view",
  },
  // Aura — the AI life tracker's control room (its own React Native app).
  {
    label: "Aura",
    icon: AuraIcon,
    permission: "aura.view",
    children: [
      {
        label: "Overview",
        href: "/dashboard/aura",
        icon: GridIcon,
        permission: "aura.view",
      },
      {
        label: "Users",
        href: "/dashboard/aura/users",
        icon: UsersIcon,
        permission: "aura.view",
      },
      {
        label: "App Catalog",
        href: "/dashboard/aura/catalog",
        icon: SmartphoneIcon,
        permission: "aura.view",
      },
      {
        label: "Scoring",
        href: "/dashboard/aura/scoring",
        icon: ChartIcon,
        permission: "aura.manage",
      },
      {
        label: "Settings",
        href: "/dashboard/aura/settings",
        icon: SettingsIcon,
        permission: "aura.manage",
      },
    ],
  },
  // Platform credentials page — visible to staff only when their role holds
  // configure.view (the super admin grants it per role; admins always see it).
  {
    label: "Configure",
    href: "/dashboard/configure",
    icon: WrenchIcon,
    permission: "configure.view",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    permission: "settings.view",
  },
];

const CRM_NAV: NavGroup = {
  label: "CRM",
  icon: BriefcaseIcon,
  children: [
    {
      label: "CRM Overview",
      href: "/dashboard/crm",
      icon: GridIcon,
      permission: "crm.view",
    },
    {
      label: "Restaurants",
      href: "/dashboard/crm/restaurants",
      icon: StoreIcon,
      permission: "restaurants.view",
    },
    {
      label: "Sales Leads",
      href: "/dashboard/crm/sales-leads",
      icon: TagIcon,
      permission: "sales-leads.view",
    },
    {
      label: "Customers",
      href: "/dashboard/crm/customers",
      icon: UsersIcon,
      permission: "customers.view",
    },
    {
      label: "Coupons",
      href: "/dashboard/crm/coupons",
      icon: TagIcon,
      permission: "customers.view",
    },
    {
      label: "Partners",
      href: "/dashboard/crm/partners",
      icon: UsersIcon,
      permission: "partners.view",
    },
    {
      label: "Bookings",
      href: "/dashboard/crm/bookings",
      icon: BagIcon,
      permission: "bookings.view",
    },
    {
      label: "Operations",
      href: "/dashboard/crm/operations",
      icon: RouteIcon,
      permission: "ops.view",
    },
    {
      label: "Finance",
      href: "/dashboard/crm/finance",
      icon: WalletIcon,
      permission: "finance.view",
    },
    {
      label: "Support Tickets",
      href: "/dashboard/crm/tickets",
      icon: MailIcon,
      permission: "tickets.view",
    },
    {
      label: "Campaigns",
      href: "/dashboard/crm/campaigns",
      icon: ImageIcon,
      permission: "campaigns.view",
    },
    // Creating a template is a separate grant from sending one: it decides what
    // the business may say to customers and goes through Meta review.
    {
      label: "WhatsApp Templates",
      href: "/dashboard/crm/templates",
      icon: ImageIcon,
      permission: "campaigns.templates",
    },
    // What customers write back to the business number — replies to a
    // campaign, questions — and the admin's answers, laid out like WhatsApp.
    {
      label: "WhatsApp Inbox",
      href: "/dashboard/crm/whatsapp",
      icon: MailIcon,
      permission: "campaigns.inbox",
    },
    {
      label: "Reports",
      href: "/dashboard/crm/reports",
      icon: ChartIcon,
      permission: "crm-reports.view",
    },
  ],
};

// Keka-style employee self-service. Every leaf is gated on ess.view — assign
// the "employee" role to a staff login and this becomes their whole panel.
const MY_SPACE_NAV: NavGroup = {
  label: "My Space",
  icon: UsersIcon,
  // Parent switch — off hides the employee's whole self-service section.
  permission: "ess.view",
  children: [
    // One permission per tab (ess.<tab>) so a role can be given the whole
    // section or just part of it. "ess.view" is the parent switch — the super
    // admin flips it in Roles & Permissions to show/hide My Space wholesale.
    {
      label: "My Portal",
      href: "/dashboard/crm/my-portal",
      icon: GridIcon,
      permission: "ess.portal",
    },
    {
      label: "My Attendance",
      href: "/dashboard/crm/my-attendance",
      icon: ClockIcon,
      permission: "ess.attendance",
    },
    {
      label: "My Leaves",
      href: "/dashboard/crm/my-leaves",
      icon: CalendarIcon,
      permission: "ess.leaves",
    },
    {
      label: "My Shift",
      href: "/dashboard/crm/my-shift",
      icon: ClockIcon,
      permission: "ess.shifts",
    },
    {
      label: "Policies",
      href: "/dashboard/crm/my-policies",
      icon: FileTextIcon,
      permission: "ess.policies",
    },
    {
      label: "Payslips",
      href: "/dashboard/crm/my-payslips",
      icon: WalletIcon,
      permission: "ess.payslips",
    },
    {
      label: "Offer Letters",
      href: "/dashboard/crm/my-offer-letters",
      icon: FileTextIcon,
      permission: "ess.offer-letters",
    },
    {
      label: "Increments",
      href: "/dashboard/crm/my-increments",
      icon: ChartIcon,
      permission: "ess.increments",
    },
    {
      label: "Holidays",
      href: "/dashboard/crm/my-holidays",
      icon: CalendarIcon,
      permission: "ess.holidays",
    },
    {
      label: "Open positions",
      href: "/dashboard/crm/my-positions",
      icon: BriefcaseIcon,
      permission: "ess.positions",
    },
    {
      label: "My Tasks",
      href: "/dashboard/crm/my-tasks",
      icon: ClipboardIcon,
      permission: "ess.tasks",
    },
  ],
};

const HR_NAV: NavGroup = {
  label: "HR Management",
  icon: UsersIcon,
  children: [
    {
      label: "Employees",
      href: "/dashboard/crm/employees",
      icon: BriefcaseIcon,
      permission: "employees.view",
    },
    {
      label: "Attendance",
      href: "/dashboard/crm/attendance",
      icon: ClockIcon,
      permission: "attendance.view",
    },
    {
      label: "Leaves",
      href: "/dashboard/crm/leaves",
      icon: CalendarIcon,
      permission: "leaves.view",
    },
    {
      label: "Shifts",
      href: "/dashboard/crm/shifts",
      icon: ClockIcon,
      permission: "shifts.view",
    },
    {
      label: "HR Policy",
      href: "/dashboard/crm/policies",
      icon: FileTextIcon,
      permission: "hr-policies.view",
    },
    {
      label: "Appraisals",
      href: "/dashboard/crm/appraisals",
      icon: StarIcon,
      permission: "appraisals.view",
    },
    {
      label: "Payroll",
      href: "/dashboard/crm/payroll",
      icon: WalletIcon,
      permission: "payroll.view",
    },
    {
      label: "Offer Letters",
      href: "/dashboard/crm/offers",
      icon: FileTextIcon,
      permission: "offer-letters.view",
    },
    {
      label: "Positions",
      href: "/dashboard/crm/positions",
      icon: BriefcaseIcon,
      permission: "positions.view",
    },
    {
      label: "HR Settings",
      href: "/dashboard/crm/hr-settings",
      icon: ClipboardIcon,
      permission: "departments.view",
    },
  ],
};

const ACCESS_NAV: NavGroup = {
  label: "Roles & Permissions",
  icon: ShieldIcon,
  children: [
    {
      label: "Roles & Permissions",
      href: "/dashboard/crm/roles",
      icon: ShieldIcon,
      permission: "roles.view",
    },
    {
      label: "Staff",
      href: "/dashboard/crm/staff",
      icon: UsersIcon,
      permission: "staff.view",
    },
  ],
};

// Multi-tenant SaaS platform (mounted at /real-estate). The platform-operator
// features — dashboard, client/tenant management, AI training and audit logs —
// are surfaced here in the panel as a SaaS dropdown so they're reachable
// without entering the sub-app; the tenant-facing CRM modules keep their own
// nav inside the /real-estate shell.
// Every child is gated on "saas.view" so the whole SaaS tab is hidden unless a
// role has been granted SaaS access (super admins hold "*"). Without the grant
// the group has no visible children and drops out of the nav entirely.
const REAL_ESTATE_NAV: NavGroup = {
  label: "SaaS",
  icon: BuildingIcon,
  children: [
    {
      label: "Dashboard",
      href: "/real-estate",
      icon: GridIcon,
      permission: "saas.view",
    },
    {
      label: "Add Clients",
      href: "/real-estate/client-management/add-clients",
      icon: UsersIcon,
      permission: "saas.view",
    },
    {
      label: "Manage Clients",
      href: "/real-estate/client-management/manage-clients",
      icon: UsersIcon,
      permission: "saas.view",
    },
    {
      label: "AI Training",
      href: "/real-estate/ai-training",
      icon: MonitorIcon,
      permission: "saas.view",
    },
    {
      label: "Audit Logs",
      href: "/real-estate/audit-logs",
      icon: FileTextIcon,
      permission: "saas.view",
    },
  ],
};

// Admins get the classic panel plus the full CRM and HR groups. STAFF members
// get the CRM/HR sections plus any admin modules their roles grant — admin
// entries WITHOUT a permission (Overview, Payments, Styling, …) stay
// admin-only and never appear for staff.
function buildNav(): NavEntry[] {
  const user = getStoredUser();
  const perms = getPermissions();
  const allowed = (leaf: NavLeaf) =>
    !leaf.permission || perms.includes("*") || perms.includes(leaf.permission);
  const groupAllowed = (g: NavGroup) =>
    !g.permission || perms.includes("*") || perms.includes(g.permission);
  // Access administration is delegable — the section appears for whoever holds
  // roles.view / staff.view. What a delegate can see and grant inside it is
  // scoped server-side to their own permissions, so handing over this module
  // never hands over the others with it.
  const groups = [MY_SPACE_NAV, CRM_NAV, HR_NAV, REAL_ESTATE_NAV, ACCESS_NAV]
    .filter(groupAllowed)
    .map((g) => ({ ...g, children: g.children.filter(allowed) }))
    .filter((g) => g.children.length > 0);
  if (user?.role === "STAFF") {
    const staffAllowed = (leaf: NavLeaf) =>
      leaf.always === true || (!!leaf.permission && allowed(leaf));
    const adminEntries = ADMIN_NAV.map((entry) =>
      "children" in entry
        ? { ...entry, children: entry.children.filter(staffAllowed) }
        : entry,
    ).filter((entry) =>
      "children" in entry ? entry.children.length > 0 : staffAllowed(entry),
    );
    const entries = [...adminEntries, ...groups];
    // Settings always sits last, matching the admin layout.
    const settingsIdx = entries.findIndex(
      (e) => "href" in e && e.href === "/dashboard/settings",
    );
    if (settingsIdx !== -1) entries.push(...entries.splice(settingsIdx, 1));
    return entries;
  }
  // ADMIN accounts are permission-gated too. An admin inherits the system
  // "admin" RBAC role, so restricting that role has to actually hide what it no
  // longer grants — this used to return ADMIN_NAV unfiltered, which showed every
  // module to every admin regardless of what the super admin assigned.
  // SUPER_ADMIN holds "*", so nothing is filtered away for them.
  const adminNav = ADMIN_NAV.map((entry) =>
    "children" in entry
      ? { ...entry, children: entry.children.filter(allowed) }
      : entry,
  ).filter((entry) =>
    "children" in entry ? entry.children.length > 0 : allowed(entry),
  );
  return [...adminNav.slice(0, 1), ...groups, ...adminNav.slice(1)];
}

/** Every page link the current session may open (permission-gated). */
function allowedLeaves(): NavLeaf[] {
  return buildNav().flatMap((entry) =>
    "children" in entry ? entry.children : [entry],
  );
}

/**
 * Where to land after login: admins get the overview; STAFF get their first
 * granted page (e.g. Analytics for an analytics+settings role).
 */
export function firstAllowedRoute(): string {
  const user = getStoredUser();
  // Tenant (SaaS) users don't belong in the admin panel — send them straight
  // into the /real-estate section, which is scoped to their tenant.
  if (isTenantUser()) return "/real-estate";
  if (user?.role !== "STAFF") return "/dashboard";
  return allowedLeaves()[0]?.href ?? "/dashboard";
}

// A tenant user is any signed-in account that is not a platform role
// (ADMIN / SUPER_ADMIN / STAFF) — e.g. a multi-tenant CRM member.
export function isTenantUser(): boolean {
  const role = getStoredUser()?.role;
  return (
    !!role && role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "STAFF"
  );
}

/**
 * Whether the current session may view a pathname — used by the dashboard
 * layout to bounce panel users off pages their permissions don't grant.
 * Hiding a module from the menu is not access control on its own: without this
 * the URL still opened the page. Applies to admins as well as staff; the super
 * admin ("*") passes everything.
 */
export function routeAllowed(pathname: string): boolean {
  const user = getStoredUser();
  if (!user || isSuperAdmin()) return true;
  return allowedLeaves().some((leaf) => leafActive(leaf.href, pathname));
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  // Redraw when the layout re-syncs permissions from the server, so a module
  // the super admin just revoked disappears without a reload. The snapshot is
  // the stored STRING (not a fresh array), which keeps it referentially stable.
  useSyncExternalStore(subscribePermissions, permissionsSnapshot, () => "");
  // Safe to read localStorage here: the dashboard layout only mounts the
  // sidebar after the client-side auth check, so this never runs during SSR.
  const nav = buildNav();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "lg:w-20" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-3 border-b border-border px-5 transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png"
            alt="RestoCare Logo"
            className="h-9 w-9 shrink-0 rounded-[5px] object-cover"
          />
          {!collapsed && (
            <span className="truncate text-lg font-semibold text-foreground">
              Restocare
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((entry) =>
            isGroup(entry) ? (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            ) : (
              <NavLeafLink
                key={entry.href}
                leaf={entry}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            ),
          )}
        </nav>

        {/* Footer / logout */}
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? "Logout" : undefined}
            className={[
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-danger/10 hover:text-danger",
              collapsed ? "lg:justify-center" : "",
            ].join(" ")}
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// Section roots ("/dashboard", "/dashboard/crm") match exactly, else every
// child page would light them (and their group) up too.
const EXACT_HREFS = new Set([
  "/dashboard",
  "/dashboard/crm",
  "/dashboard/tasks",
  "/real-estate",
]);

function leafActive(href: string, pathname: string): boolean {
  return EXACT_HREFS.has(href) ? pathname === href : pathname.startsWith(href);
}

function NavLeafLink({
  leaf,
  pathname,
  collapsed,
  onNavigate,
  nested,
}: {
  leaf: NavLeaf;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
  nested?: boolean;
}) {
  const active = leafActive(leaf.href, pathname);
  const Icon = leaf.icon;
  return (
    <Link
      href={leaf.href}
      onClick={onNavigate}
      title={collapsed ? leaf.label : undefined}
      className={[
        "group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
        nested && !collapsed ? "px-3 pl-11" : "px-3",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
        collapsed ? "lg:justify-center" : "",
      ].join(" ")}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{leaf.label}</span>}
    </Link>
  );
}

function NavGroupItem({
  group,
  pathname,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const childActive = group.children.some((c) => leafActive(c.href, pathname));
  const [open, setOpen] = useState(childActive);
  // Always show children when on one of their routes; otherwise honor the toggle.
  const expanded = open || childActive;
  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? group.label : undefined}
        className={[
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          childActive
            ? "bg-sidebar-accent text-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
          collapsed ? "lg:justify-center" : "",
        ].join(" ")}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{group.label}</span>
            <ChevronDownIcon
              className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1">
          {group.children.map((child) => (
            <NavLeafLink
              key={child.href}
              leaf={child}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}
