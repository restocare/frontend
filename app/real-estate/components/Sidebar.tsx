"use client";
import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";

import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Phone, Brain, ChevronDown, LogOut,
  Users, SlidersHorizontal, Mic, FileText, List,
  ShieldCheck, Building2, Settings, History, BarChart2,
  Database, ClipboardList, MoreVertical, UserCheck,UserPlus
} from "lucide-react";
import { LogoutModal } from "./LogoutModal";
import { authApi } from "@/app/api/api";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { usePermissions } from "@/hooks/usePermissions";
import { clearSession } from "@/src/lib/auth";

// ── Types ────────────────────────────────────────────────────────────────────

// `perm` is an optional RBAC gate ("module.action"). Undefined = always visible.
type SubLink = { href: string; label: string; perm?: string };

type NavLink = {
  href?: string;
  label: string;
  perm?: string;
  subLinks?: SubLink[];
};

type NavSection = {
  section: string;
  links: NavLink[];
};

// ── Role-scoped nav items ────────────────────────────────────────────────────

const superAdminNav: NavSection[] = [
  // Dashboard home + client/tenant management
  {
    section: "Overview",
    links: [
      { href: "/real-estate", label: "Dashboard" },
      {
        label: "Clients Management",
        subLinks: [
          { href: "/real-estate/client-management/add-clients", label: "Add Clients" },
          { href: "/real-estate/client-management/manage-clients", label: "Manage Clients" },
        ],
      },
    ],
  },
  // AI model training
  {
    section: "Train Your Model",
    links: [
      { href: "/real-estate/ai-training", label: "AI Training" },
    ],
  },
  // Platform-wide audit logs (user activity, login, system)
  {
    section: "Monitoring",
    links: [
      {
        label: "Audit Logs",
        subLinks: [
          { href: "/real-estate/audit-logs?tab=USER_ACTIVITY", label: "User Activities" },
          { href: "/real-estate/audit-logs?tab=LOGIN", label: "Login Logs" },
          { href: "/real-estate/audit-logs?tab=SYSTEM", label: "System Logs" },
        ],
      },
    ],
  },
  // API keys and account settings
  {
    section: "Configuration",
    links: [
      {
        label: "Settings",
        subLinks: [
          { href: "/real-estate/settings/api-keys", label: "API Keys" },
          { href: "/real-estate/settings/change-password", label: "Change Password" },
        ],
      },
    ],
  },
];

// Permission-tagged nav for every non-super-admin role. Items are filtered by
// the user's effective permissions so each role sees only the modules it can use.
const generalNav: NavSection[] = [
  // Dashboard home
  {
    section: "Overview",
    links: [
      { href: "/real-estate", label: "Dashboard" },
    ],
  },
  // Manage users, roles, and permissions
  {
    section: "User Management",
    links: [
      {
        label: "Users",
        perm: "users.view",
        subLinks: [
          { href: "/real-estate/user/add-user", label: "Add User", perm: "users.create" },
          { href: "/real-estate/user/manage-users", label: "Manage Users", perm: "users.view" },
        ],
      },
      {
        label: "Roles & Permissions",
        perm: "roles.view",
        subLinks: [
          { href: "/real-estate/roles/manage-role", label: "Manage Roles", perm: "roles.view" },
          { href: "/real-estate/roles/assign-role", label: "Assign Roles", perm: "users.update" },
        ],
      },
    ],
  },
  // Build and manage custom forms
  {
    section: "Forms Management",
    links: [
      {
        label: "Forms",
        perm: "forms.view",
        subLinks: [
          { href: "/real-estate/form/create-your-own", label: "Create Form", perm: "forms.create" },
          { href: "/real-estate/form/manage-forms", label: "Manage Forms", perm: "forms.view" },
        ],
      },
    ],
  },
  // Add and manage leads
  {
    section: "Lead Management",
    links: [
      {
        label: "Leads",
        perm: "leads.view",
        subLinks: [
          { href: "/real-estate/manual-lead/add", label: "Add Leads", perm: "leads.create" },
          { href: "/real-estate/lead-management", label: "Manage Leads", perm: "leads.view" },
        ],
      },
    ],
  },
  // Voice/AI calling — testing, cold calls, hot calls (currently disabled)
  // {
  //   section: "Voice Agent",
  //   links: [
  //     {
  //       label: "Calls",
  //       perm: "calls.view",
  //       subLinks: [
  //         { href: "/real-estate/voice-agent/testing", label: "Testing", perm: "calls.view" },
  //         { href: "/real-estate/voice-agent/cold-calls", label: "Cold Calls", perm: "calls.create" },
  //         { href: "/real-estate/voice-agent/hot-calls", label: "Hot Calls", perm: "calls.view" },
  //       ],
  //     },
  //   ],
  // },
  // Add/manage projects and property data uploads
  {
    section: "Project Management",
    links: [
      {
        label: "Projects",
        perm: "projects.view",
        subLinks: [
          { href: "/real-estate/project/add-project", label: "Add Project", perm: "projects.create" },
          { href: "/real-estate/project/manage-projects", label: "Manage Projects", perm: "projects.view" },
          { href: "/real-estate/project/upload-project-data", label: "Upload Project Data", perm: "projects.create" },
        ],
      },
    ],
  },
  // Manual lead entry (currently disabled — superseded by Lead Management above)
  // {
  //   section: "Manual Lead",
  //   links: [
  //     {
  //       label: "Manual Lead",
  //       subLinks: [
  //         { href: "/real-estate/manual-lead/add", label: "Add Manual Lead" },
  //         { href: "/real-estate/manual-lead/manage", label: "Manage Manual Lead" },
  //       ],
  //     },
  //   ],
  // },
  // Reporting/analytics
  {
    section: "Reports",
    links: [
      {
        href: "/real-estate/reports",
        label: "Reports",
        perm: "reports.view",
      },
    ],
  },
  // Account-level settings
  {
    section: "Configuration",
    links: [
      {
        label: "Settings",
        subLinks: [
          // { href: "/real-estate/settings/api-keys", label: "API Keys", perm: "roles.view" },
          { href: "/real-estate/settings/change-password", label: "Change Password" },
          { href: "/real-estate/settings/delete-account", label: "Delete Account" },
        ],
      },
    ],
  },
];

// Keep only the sections/links/sublinks the user is permitted to see.
function filterNavByPermissions(
  sections: NavSection[],
  has: (perm: string) => boolean,
): NavSection[] {
  return sections
    .map((section) => {
      const links = section.links
        .map((link) => {
          if (link.subLinks) {
            const subLinks = link.subLinks.filter((s) => !s.perm || has(s.perm));
            if (subLinks.length === 0) return null;
            return { ...link, subLinks };
          }
          if (link.perm && !has(link.perm)) return null;
          return link;
        })
        .filter((l): l is NavLink => l !== null);
      return { ...section, links };
    })
    .filter((section) => section.links.length > 0);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({
  isOpen,
  onClose,
  isDesktopOpen = true,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  isDesktopOpen?: boolean;
  onDesktopToggle?: () => void;
}) {
  const pathname = usePathname();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, clearAuth } = useAuthStore();
  const { has } = usePermissions();
  const firstRole = user?.roles?.[0];
  const role = typeof firstRole === "string"
    ? firstRole
    : (firstRole?.role?.name || firstRole?.name || null);

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      // The panel session (rc.* localStorage keys) is the source of truth here —
      // the zustand store is only a mirror. Without clearing it, /login still
      // sees a valid token via getToken() and bounces straight back in.
      clearSession();
      document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
      window.location.href = ADMIN_LOGIN_PATH;
    },
  });

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Lock body scroll on mobile when overlay sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  const handleLogoutClick = () => {
    setIsUserMenuOpen(false);
    if (onClose) onClose();
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    logoutMutation.mutate();
  };

  const getIcon = (label: string) => {
    let iconNode;
    switch (label) {
      case "Dashboard":
        iconNode = <LayoutDashboard className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "AI Calling":
        iconNode = <Phone className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Voice Agent":
      case "Calls":
        iconNode = <Mic className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "AI Training":
        iconNode = <Brain className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Clients Management":
      case "Users":
        iconNode = <Users className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Configure":
        iconNode = <SlidersHorizontal className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Dynamic Form":
        iconNode = <FileText className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Manage Forms":
        iconNode = <List className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Forms":
        iconNode = <ClipboardList className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Roles & Permissions":
        iconNode = <ShieldCheck className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Vector DB":
        iconNode = <Database className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Project":
      case "Projects":
        iconNode = <Building2 className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Settings":
        iconNode = <Settings className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Audit Logs":
        iconNode = <History className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Leads":
        iconNode = <UserCheck className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Manual Lead":
        iconNode = <UserPlus className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      case "Reports":
        iconNode = <BarChart2 className="w-4 h-4 shrink-0 sidebar-icon" />;
        break;
      default:
        return (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 sidebar-dot" />
        );
    }

    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 sidebar-icon-bg">
        {iconNode}
      </div>
    );
  };

  // Super admin keeps its dedicated (client/tenant) nav; every other role gets a
  // permission-filtered nav so it only sees the modules it actually has access to.
  const isSuperAdmin = role === "super_admin";
  const navItems: NavSection[] = useMemo(() => {
    return isSuperAdmin
      ? superAdminNav
      : filterNavByPermissions(generalNav, has);
  }, [isSuperAdmin, has]);

  // Role badge colours
  const roleBadgeClass = isSuperAdmin
    ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
    : "bg-sky-500/15 text-sky-400 border border-sky-500/25";

  // Show the actual role name (super_admin → "Super Admin", "hr" → "Hr", etc.).
  const roleLabel = role
    ? String(role).replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "User";

  return (
    <>
      {/* Mobile overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`
          lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm
          transition-opacity duration-200 ease-in-out
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* ── Sidebar ── */}
      <nav
        aria-label="Sidebar navigation"
        className={`
          fixed lg:static inset-y-0 left-0
          bg-background border-r border-border
          flex flex-col shrink-0 overflow-hidden
          transition-all duration-200 ease-in-out
          ${isOpen ? "translate-x-0 shadow-2xl z-100" : "-translate-x-full"}
          lg:translate-x-0 lg:shadow-none
          ${isDesktopOpen ? "lg:w-58" : "lg:w-14"}
          w-52
        `}
      >
        {/* Mobile-only close button row */}
        <div className="lg:hidden h-14 flex items-center justify-between px-3 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://restocare-asset.s3.ap-south-1.amazonaws.com/Clientlogo/6985da0674994.png"
              alt="RestoCare"
              className="h-7 w-auto shrink-0"
            />
            <span className="font-bold text-base text-foreground tracking-tight select-none">RestoCare</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
          </button>
        </div>

        {/* Role badge — visible only when expanded */}
        {role && (
          <div
            className={`mx-3 mt-3 mb-1 overflow-hidden transition-all duration-200 ${isDesktopOpen ? "opacity-100 max-h-10" : "lg:opacity-0 lg:max-h-0"
              }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest ${roleBadgeClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
              {roleLabel}
            </span>
          </div>
        )}

        {/* Nav links */}
        <div className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((section) => (
            <div key={section.section} className="mb-1 flex flex-col gap-0.5">
              {section.links.map((link) => {
                const isActive = link.href
                  ? pathname === link.href
                  : link.subLinks?.some(sub => pathname === sub.href) ?? false;
                const isDropdownOpen = link.label ? openDropdowns[link.label] : false;

                return (
                  <div key={link.label || link.href} className="flex flex-col">
                    {link.subLinks ? (
                      <button
                        type="button"
                        onClick={() => toggleDropdown(link.label)}
                        title={!isDesktopOpen ? link.label : undefined}
                        className={`
                          flex items-center rounded-full text-sm transition-colors duration-200 min-h-10 w-full group
                          ${isDesktopOpen ? "justify-between px-3" : "justify-between lg:justify-center px-3 lg:px-0"}
                          ${isActive
                            ? "sidebar-item-active font-medium shadow-sm"
                            : "sidebar-item-hover text-foreground dark:text-muted-foreground"
                          }
                        `}
                      >
                        <div className={`flex items-center ${isDesktopOpen ? "gap-2.5" : "gap-2.5 lg:gap-0"}`}>
                          {getIcon(link.label)}
                          <span className={`whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isDesktopOpen ? "opacity-100 max-w-40" : "lg:opacity-0 lg:max-w-0"}`}>
                            {link.label}
                          </span>
                        </div>
                        {isDesktopOpen && (
                          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""} sidebar-chevron`} />
                        )}
                      </button>
                    ) : (
                      <Link
                        href={link.href!}
                        onClick={onClose}
                        title={!isDesktopOpen ? link.label : undefined}
                        className={`
                          flex items-center rounded-full text-sm transition-colors duration-200 min-h-10 group
                          ${isDesktopOpen ? "gap-2.5 px-3" : "gap-2.5 lg:gap-0 px-3 lg:px-0 lg:justify-center"}
                          ${isActive
                            ? "sidebar-item-active font-medium shadow-sm"
                            : "sidebar-item-hover text-foreground dark:text-muted-foreground"
                          }
                        `}
                      >
                        {getIcon(link.label)}
                        {/* Label — fades out when desktop-collapsed */}
                        <span
                          className={`whitespace-nowrap overflow-hidden transition-opacity duration-200 ${isDesktopOpen ? "opacity-100 max-w-40" : "lg:opacity-0 lg:max-w-0"}`}
                        >
                          {link.label}
                        </span>
                      </Link>
                    )}

                    {/* Sublinks — use opacity+visibility so the transition stays on
                        the compositor (no layout/paint triggered by max-height). */}
                    {link.subLinks && (
                      <div
                        className={`flex flex-col gap-1.5 transition-opacity duration-200 ${isDropdownOpen && (isDesktopOpen || isOpen) ? "opacity-100 mt-0.5 pointer-events-auto" : "opacity-0 pointer-events-none h-0 overflow-hidden"
                          }`}
                      >
                        {link.subLinks.map(subLink => {
                          const isSubActive = pathname === subLink.href;
                          return (
                            <Link
                              key={subLink.href}
                              href={subLink.href}
                              onClick={onClose}
                              className={`
                                flex items-center gap-2.5 px-3 py-1.5 ml-6 rounded-full text-sm transition-colors duration-200 min-h-8 group
                                ${isSubActive
                                  ? "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 font-medium"
                                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                                }
                              `}
                            >
                              <span className="w-1 h-1 rounded-full shrink-0 bg-current opacity-60" />
                              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDesktopOpen ? "opacity-100 max-w-40" : "lg:opacity-0 lg:max-w-0"}`}>
                                {subLink.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* Subtle separation line after specific section links */}
                    {link.label === "Clients Management" && (
                      <div
                        className={`h-px bg-border/50 mx-2 mt-2 mb-2 transition-all duration-200 overflow-hidden ${isDesktopOpen ? "opacity-100 h-px" : "lg:opacity-0 lg:h-0 lg:mt-0 lg:mb-0"
                          }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom: User card with popover menu */}
        <div className="border-t border-border p-2 shrink-0" ref={userMenuRef}>
          {/* Popover menu — renders above the card */}
          {isUserMenuOpen && (
            <div className="absolute bottom-18 left-2 right-2 z-50 bg-popover border border-border rounded-xl shadow-lg p-1 animate-in fade-in zoom-in-95 duration-150">
              {/* User info header */}
              <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {user?.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="h-px bg-border mx-1 mb-1" />
              {/* Menu items */}
              <Link
                href="/real-estate/settings/change-password"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0 text-muted-foreground" />
                Change Password
              </Link>
              <div className="h-px bg-border mx-1 my-1" />
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Log out
              </button>
            </div>
          )}

          {/* User card trigger */}
          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            title={!isDesktopOpen ? user?.email ?? "User menu" : undefined}
            className={`w-full flex items-center rounded-lg text-sm hover:bg-accent transition-colors min-h-10 ${isDesktopOpen ? "gap-2.5 px-2" : "gap-2.5 lg:gap-0 px-2 lg:px-0 lg:justify-center"
              }`}
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className={`flex-1 min-w-0 text-left overflow-hidden transition-all duration-200 ${isDesktopOpen ? "opacity-100 max-w-full" : "lg:opacity-0 lg:max-w-0"}`}>
              <p className="text-xs font-medium text-foreground truncate">
                {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <MoreVertical
              className={`shrink-0 text-muted-foreground transition-all duration-200 ${isDesktopOpen ? "opacity-100 w-3.5 h-3.5" : "lg:opacity-0 lg:w-0"}`}
            />
          </button>
        </div>
      </nav>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}