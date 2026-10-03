"use client";
import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/src/lib/theme";
import {
  PanelLeft,
  Bell,
  Search,
  Settings,
  Users,
  PlusCircle,
  Database,
  Sun,
  Moon,
  LogOut,
  Activity,
  FileText,
  X,
  Lock,
} from "lucide-react";
import { LogoutModal } from "./LogoutModal";
import { ThemeToggle } from "../../../components/theme/ThemeToggle";
import Link from "next/link";
import { toast } from "sonner";
import { authApi } from "@/app/api/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { clearSession } from "@/src/lib/auth";
import apiClient from "@/app/api/apiClient";

interface FormConfig {
  id: string;
  title: string;
  description: string;
  status: string;
}

interface SearchItem {
  id: string;
  title: string;
  category: "Pages" | "Forms" | "Actions";
  href?: string;
  action?: () => void;
  icon: React.ReactNode;
  subtitle?: string;
}



export default function Header({
  onMenuClick,
  onDesktopToggle,
  isDesktopSidebarOpen,
}: {
  onMenuClick?: () => void;
  onDesktopToggle?: () => void;
  isDesktopSidebarOpen?: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { user, clearAuth } = useAuthStore();

  const firstRole = user?.roles?.[0];
  const role = typeof firstRole === "string"
    ? firstRole
    : (firstRole?.role?.name || firstRole?.name || null);

  const { data: forms = [] } = useQuery<FormConfig[]>({
    queryKey: ["meta-forms"],
    queryFn: async () => {
      const res = await apiClient.get("/api/meta-forms");
      return res.data;
    },
    enabled: role !== "super_admin" && !!user,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      // Also clear the panel session (rc.* keys) — the source of truth. Without
      // it, /login still sees a token via getToken() and bounces back in.
      clearSession();
      document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
      window.location.href = ADMIN_LOGIN_PATH;
    },
  });

  useEffect(() => {
    if (isSearchOpen) {
      // Focus input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setTimeout(() => {
        setSearchQuery("");
        setSelectedIndex(0);
      }, 0);
    }
  }, [isSearchOpen]);

  // Command Search index
  const isSuperAdmin = role === "super_admin";

  const allItems = useMemo(() => {
    const pagesItems: SearchItem[] = isSuperAdmin
      ? [
          {
            id: "dashboard",
            title: "Dashboard",
            subtitle: "Main overview and activity metrics",
            category: "Pages",
            href: "/real-estate",
            icon: <Activity className="size-4 text-emerald-400" />
          },
          {
            id: "add-clients",
            title: "Add Clients",
            subtitle: "Register new business clients & metadata",
            category: "Pages",
            href: "/real-estate/client-management/add-clients",
            icon: <Users className="size-4 text-blue-400" />
          },
          {
            id: "manage-clients",
            title: "Manage Clients",
            subtitle: "View and edit registered client list",
            category: "Pages",
            href: "/real-estate/client-management/manage-clients",
            icon: <Users className="size-4 text-cyan-400" />
          },
          {
            id: "vector-db",
            title: "Vector DB",
            subtitle: "Search and configure vectorized knowledge bases",
            category: "Pages",
            href: "/real-estate/vector-db",
            icon: <Database className="size-4 text-indigo-400" />
          },
          {
            id: "ai-training",
            title: "AI Training & Model Workspace",
            subtitle: "Manage dynamic knowledge items and logs",
            category: "Pages",
            href: "/real-estate/ai-training",
            icon: <Database className="size-4 text-amber-400" />
          },
          {
            id: "api-keys",
            title: "API Keys",
            subtitle: "Configure credentials and settings",
            category: "Pages",
            href: "/real-estate/settings/api-keys",
            icon: <Settings className="size-4 text-zinc-400" />
          }
        ]
      : [
          {
            id: "dashboard",
            title: "Dashboard",
            subtitle: "Main overview and activity metrics",
            category: "Pages",
            href: "/real-estate",
            icon: <Activity className="size-4 text-emerald-400" />
          },
          {
            id: "add-user",
            title: "Add User",
            subtitle: "Create new user profiles and assign roles",
            category: "Pages",
            href: "/real-estate/user/add-user",
            icon: <Users className="size-4 text-blue-400" />
          },
          {
            id: "manage-users",
            title: "Manage Users",
            subtitle: "View, update, or remove system users",
            category: "Pages",
            href: "/real-estate/user/manage-users",
            icon: <Users className="size-4 text-cyan-400" />
          },
          {
            id: "dynamic-form",
            title: "Create Dynamic Form",
            subtitle: "Design and export form field schemas",
            category: "Pages",
            href: "/real-estate/form/create-your-own",
            icon: <PlusCircle className="size-4 text-teal-400" />
          },
          {
            id: "manage-forms",
            title: "Manage Forms",
            subtitle: "Templates, status control & direct share paths",
            category: "Pages",
            href: "/real-estate/form/manage-forms",
            icon: <FileText className="size-4 text-pink-400" />
          },
          {
            id: "voice-agent-testing",
            title: "Voice Agent Testing",
            subtitle: "Test voice agent response and configurations",
            category: "Pages",
            href: "/real-estate/voice-agent/testing",
            icon: <Activity className="size-4 text-purple-400" />
          },
          {
            id: "cold-calls",
            title: "Cold Calls",
            subtitle: "Outbound cold call records and operations",
            category: "Pages",
            href: "/real-estate/voice-agent/cold-calls",
            icon: <Activity className="size-4 text-amber-400" />
          },
          {
            id: "hot-calls",
            title: "Hot Calls",
            subtitle: "Inbound and warm lead hot call metrics",
            category: "Pages",
            href: "/real-estate/voice-agent/hot-calls",
            icon: <Activity className="size-4 text-rose-400" />
          }
        ];

    const formsItems: SearchItem[] = isSuperAdmin
      ? []
      : forms.map((f) => ({
          id: `form-${f.id}`,
          title: f.title,
          subtitle: f.description || `Form slug: ${f.id} (${f.status})`,
          category: "Forms",
          href: `/real-estate/form/create-your-own?id=${f.id}`,
          icon: <FileText className="size-4 text-emerald-400" />
        }));

    const actionsItems: SearchItem[] = [
      {
        id: "theme-toggle",
        title: "Toggle Theme",
        subtitle: `Switch current theme (currently ${theme || "system"})`,
        category: "Actions",
        action: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          toast.success(`Switched theme to ${theme === "dark" ? "light" : "dark"} mode!`);
        },
        icon: theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-400" />
      },
      ...(isSuperAdmin ? [{
        id: "change-password",
        title: "Change Password",
        subtitle: "Update your super admin account password",
        category: "Actions" as const,
        href: "/real-estate/settings/change-password",
        icon: <Lock className="size-4 text-violet-400" />
      }] : []),
      {
        id: "logout",
        title: "Log Out",
        subtitle: "Safely terminate current session",
        category: "Actions",
        action: () => setIsLogoutModalOpen(true),
        icon: <LogOut className="size-4 text-rose-500" />
      }
    ];

    return [...pagesItems, ...formsItems, ...actionsItems];
  }, [isSuperAdmin, forms, theme, setTheme]);

  const filteredItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allItems, searchQuery]);

  const handleSelect = useCallback((item: SearchItem) => {
    setIsSearchOpen(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }, [router]);

  // Keyboard navigation & search toggle shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      if (!isSearchOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems.length > 0) {
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, filteredItems, selectedIndex, handleSelect]);

  // Close settings dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  // Lock body scroll when search is open
  useEffect(() => {
    if (isSearchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSearchOpen]);

  return (
    <>
      <header className="h-14 border-b border-border flex justify-between items-center px-4 lg:px-6 shrink-0 bg-background transition-colors">
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Mobile-only Layout */}
          <div className="flex lg:hidden items-center gap-3">
            <button
              onClick={onMenuClick}
              aria-label="Open navigation menu"
              className="min-w-9 min-h-9 flex justify-center items-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
            >
              <PanelLeft className="w-5 h-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://restocare-asset.s3.ap-south-1.amazonaws.com/Clientlogo/6985da0674994.png"
                alt="RestoCare"
                className="h-7 w-auto shrink-0"
              />
              <span className="font-bold text-base text-foreground tracking-tight select-none">RestoCare</span>
            </Link>
          </div>

          {/* Desktop Layout - Aligns Sidebar Icon Perfectly Centered on the Sidebar Border Line */}
          <div className={`hidden lg:flex items-center transition-all duration-205 ease-in-out relative ${isDesktopSidebarOpen ? "w-52" : "w-8"
            }`}>
            <Link href="/dashboard" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://restocare-asset.s3.ap-south-1.amazonaws.com/Clientlogo/6985da0674994.png"
                alt="RestoCare"
                className="h-7 w-auto shrink-0"
              />
              {isDesktopSidebarOpen && (
                <span className="font-bold text-base text-foreground tracking-tight select-none">RestoCare</span>
              )}
            </Link>

            <button
              onClick={onDesktopToggle}
              aria-label={isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="absolute left-full ml-3 min-w-8 min-h-8 flex justify-center items-center text-muted-foreground hover:text-foreground rounded-md bg-background border border-border shadow-xs transition-colors cursor-pointer"
            >
              <PanelLeft className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 ml-14 lg:ml-20">


            {/* Premium global search bar trigger button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="relative hidden md:flex items-center w-64 lg:w-80 h-8 pl-9 pr-3 rounded-md bg-accent/40 border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/65 hover:border-zinc-700/60 focus:outline-none transition-all duration-200 select-none text-left cursor-pointer"
            >
              <Search className="absolute left-3 size-3.5 text-muted-foreground" />
              <span>Search dashboard...</span>
              <span className="absolute right-2 px-1.5 py-0.5 rounded border border-border text-[9px] font-mono text-muted-foreground bg-accent/40">
                ⌘K
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search dashboard"
            className="md:hidden min-w-9 min-h-9 flex justify-center items-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notification bell */}
          <button
            onClick={() => toast("You have no unread notifications.", {
              style: {
                background: theme === "light" ? "#ffffff" : "#09090b",
                color: theme === "light" ? "#09090b" : "#ffffff",
                border: theme === "light" ? "1px solid #e4e4e7" : "1px solid #27272a"
              }
            })}
            aria-label="Notifications"
            className="min-w-9 min-h-9 flex justify-center items-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          </button>

          <ThemeToggle />

          {/* Avatar with settings dropdown */}
          <div ref={settingsRef} className="relative">
            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              aria-label="Open settings menu"
              className="w-8 h-8 rounded-md bg-accent border border-border flex items-center justify-center text-xs font-semibold text-foreground select-none hover:bg-accent/80 transition-colors cursor-pointer"
            >
              {role
                ? role.replace(/_/g, " ").split(" ").map((w: string) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2)
                : "U"}
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-popover shadow-lg z-50 p-1 animate-in fade-in zoom-in-95 duration-150">
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
                <button
                  onClick={() => { setIsSettingsOpen(false); router.push("/real-estate/settings/change-password"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
                >
                  <Lock className="size-4 shrink-0 text-muted-foreground" />
                  Change Password
                </button>
                <div className="h-px bg-border mx-1 my-1" />
                <button
                  onClick={() => { setIsSettingsOpen(false); setIsLogoutModalOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="size-4 shrink-0" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Menu Search Overlay Dialog */}
      {isSearchOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setIsSearchOpen(false)}
          className="fixed inset-0 z-9999 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-md transition-opacity duration-200"
        >
          <div
            ref={containerRef}
            className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl shadow-emerald-500/5 flex flex-col max-h-112.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type a command or search page/form..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="flex-1 h-full bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none border-none"
              />
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground bg-muted/60 select-none">
                ESC
              </span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="size-8 mx-auto text-muted-foreground/35 mb-3" />
                  <p className="text-xs text-muted-foreground">No matches found for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Try another search term or key combination.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {["Pages", "Forms", "Actions"].map((cat) => {
                    const catItems = filteredItems.filter((i) => i.category === cat);
                    if (catItems.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-0.5">
                        <div className="px-3 py-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                          {cat}
                        </div>
                        {catItems.map((item) => {
                          const globalIndex = filteredItems.indexOf(item);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer ${isSelected
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-1.5 rounded-md transition-colors ${isSelected
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-muted border border-border text-muted-foreground"
                                  }`}>
                                  {item.icon}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                                    {item.title}
                                  </p>
                                  {item.subtitle && (
                                    <p className="text-[10px] text-muted-foreground truncate max-w-70 mt-0.5">
                                      {item.subtitle}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 select-none animate-pulse">
                                  Select
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Help / Shortcut Bar */}
            <div className="px-4 py-2 border-t border-border shrink-0 flex items-center justify-between text-[9px] text-muted-foreground bg-muted/40 select-none font-sans">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="font-mono bg-muted border border-border px-1 rounded">↑↓</span> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-mono bg-muted border border-border px-1.5 rounded">Enter</span> Action
                </span>
              </div>
              <div>
                <span>Press <kbd className="font-mono text-foreground font-semibold">ESC</kbd> to exit</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <LogoutModal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          logoutMutation.mutate();
        }} 
      />
    </>
  );
}
