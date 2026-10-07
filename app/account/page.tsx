"use client";

import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, MotionConfig, type Variants } from "framer-motion";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { userApi } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { AddressPicker, useAddressBook } from "@/src/components/booking-v2/address-picker";
import { MyBookingsContent } from "./orders/_content";
import { SettingsSection, SosSection, SupportSection } from "./[section]/_content";
import {
  ArrowRightIcon,
  BagIcon,
  BriefcaseIcon,
  CloseIcon,
  LogoutIcon,
  MapPinIcon,
  PencilIcon,
  SettingsIcon,
  SpinnerIcon,
  StarIcon,
  StoreIcon,
  WalletIcon,
} from "@/src/components/icons";

// three.js dot field behind the profile card. Client-only, loaded after the
// first paint so it never delays the page.
const DotWave = dynamic(
  () => import("@/src/components/landing/dot-wave").then((m) => m.DotWave),
  { ssr: false },
);

/** Profile card colour; the dot field fades into it. */
const CARD_BG = "#1C1A17";

type IconProps = React.SVGProps<SVGSVGElement>;

/* A few icons the shared set doesn't have, drawn in the same 1.8px stroke. */

function HeartIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" />
    </svg>
  );
}

function SirenIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 19v-6a5 5 0 0 1 10 0v6" />
      <path d="M4 19h16" />
      <path d="M12 3v2M5.5 6l1.4 1.4M18.5 6l-1.4 1.4" />
    </svg>
  );
}

function HeadsetIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M19 19a3 3 0 0 1-3 2h-2" />
    </svg>
  );
}

/* --------------------------------- menu -------------------------------- */

type SectionId =
  | "orders"
  | "profile"
  | "addresses"
  | "settings"
  | "sos"
  | "contact"
  | "loyalty"
  | "wallet"
  | "wishlist"
  | "join";

interface MenuItem {
  id: SectionId;
  title: string;
  subtitle: string;
  icon: (p: IconProps) => ReactNode;
  /** Own page, opened on phones (desktop shows the section in the right pane). */
  href?: string;
  comingSoon?: boolean;
}

// Live items first, then the ones still being built. Mirrors the RN
// AccountScreen menu (chats filtered out, like the app does).
const MENU: MenuItem[] = [
  { id: "orders", title: "My Orders", subtitle: "Track your bookings & history", icon: BagIcon, href: "/account/orders" },
  { id: "profile", title: "Profile & restaurant", subtitle: "Your name, restaurant and GST", icon: StoreIcon },
  { id: "addresses", title: "Addresses", subtitle: "Where our team should come", icon: MapPinIcon },
  { id: "settings", title: "Settings", subtitle: "Preferences, privacy & account", icon: SettingsIcon, href: "/account/settings" },
  { id: "sos", title: "SOS", subtitle: "Emergency support", icon: SirenIcon, href: "/account/sos" },
  { id: "contact", title: "Support Center", subtitle: "WhatsApp, call & email", icon: HeadsetIcon, href: "/account/contact" },
  { id: "loyalty", title: "Loyalty", subtitle: "Points and perks", icon: StarIcon, href: "/account/loyalty", comingSoon: true },
  { id: "wallet", title: "Wallet", subtitle: "Balance and cashback", icon: WalletIcon, href: "/account/wallet", comingSoon: true },
  { id: "wishlist", title: "Wishlist", subtitle: "Saved services", icon: HeartIcon, href: "/account/wishlist", comingSoon: true },
  { id: "join", title: "Join Us", subtitle: "Partner with Restocare", icon: BriefcaseIcon, href: "/account/join", comingSoon: true },
];

const DEFAULT_SECTION: SectionId = "orders";

function isSectionId(v: string | null): v is SectionId {
  return MENU.some((m) => m.id === v);
}

/** Picks whichever profile image field the API happened to send. */
function profileImageOf(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  for (const key of ["profileImage", "profile_image", "image", "avatar", "photo"]) {
    const v = user[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* ------------------------------ animation ------------------------------ */

const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
};
const RISE: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
const PANE: Variants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const inputCls =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-rc-yellow focus:ring-4 focus:ring-rc-yellow/20 disabled:bg-gray-50 disabled:text-gray-500";

/* -------------------------------- modal -------------------------------- */

/** Centered dialog on desktop, bottom sheet on phones. */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-rc-ink/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="relative w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- profile form ---------------------------- */

function ProfileForm({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const { user, updateUser } = useCustomerAuth();
  const [name, setName] = useState(text(user?.name));
  const [restaurant, setRestaurant] = useState(text(user?.restaurantName));
  const [gst, setGst] = useState(text(user?.gstNumber));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = text(user?.mobile) || text(user?.phone);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        restaurantName: restaurant.trim(),
        ...(gst.trim() ? { gstNumber: gst.trim().toUpperCase() } : {}),
      };
      await userApi.updateProfile(user.id, payload);
      updateUser(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-800">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Owner or manager name"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-800">Mobile number</span>
          <input value={phone ? `+91 ${phone}` : ""} disabled className={inputCls} />
          <span className="mt-1 block text-xs text-gray-400">
            Your login number. To change it, contact support.
          </span>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-800">Restaurant name</span>
        <input
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="e.g. Govardhan, Karol Bagh"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-800">
          GST number <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <input
          value={gst}
          onChange={(e) => setGst(e.target.value)}
          placeholder="07AAAAA0000A1Z5"
          maxLength={15}
          className={`${inputCls} uppercase`}
        />
        <span className="mt-1 block text-xs text-gray-400">Printed on your invoices.</span>
      </label>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="overflow-hidden rounded-xl bg-rc-red/5 px-4 py-3 text-sm text-rc-red ring-1 ring-rc-red/20"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex gap-3 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        ) : null}
        <motion.button
          type="submit"
          disabled={saving}
          whileTap={saving ? undefined : { scale: 0.98 }}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-rc-yellow text-sm font-bold text-rc-ink transition hover:brightness-95 disabled:opacity-60 sm:max-w-xs"
        >
          {saving ? <SpinnerIcon className="h-4 w-4" /> : null}
          {saving ? "Saving…" : "Save changes"}
        </motion.button>
      </div>
    </form>
  );
}

/* ------------------------------ addresses ------------------------------ */

function AddressesSection() {
  // Same saved-address list and add form as checkout, so an address added
  // here is ready to pick when booking.
  const book = useAddressBook(null);
  return (
    <div className="space-y-4 [&_h2]:text-lg">
      <AddressPicker
        book={book}
        noun="team"
        heading="Saved addresses"
        // Tapping a saved address makes it the primary one (preselected at
        // checkout). A just-added address has a local id until the list
        // refetches, so it can't be made primary in the same tap.
        onSelect={(a) => {
          if (!a.id.startsWith("local-")) book.setPrimary(a.id);
        }}
      />
    </div>
  );
}

/* ----------------------------- coming soon ----------------------------- */

function ComingSoonPane({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <div className="flex flex-col items-center rounded-3xl border border-gray-100 bg-white px-8 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rc-yellow-tint text-rc-yellow-deep">
        <Icon className="h-9 w-9" />
      </span>
      <h2 className="mt-5 text-xl font-bold text-gray-900">{item.title}</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        {item.subtitle}. We are building this now; it will show up here when it is ready.
      </p>
    </div>
  );
}

/* ------------------------------ profile card --------------------------- */

function ProfileCard({
  compact,
  onEdit,
}: {
  /** Sidebar version: stacked, smaller type. */
  compact?: boolean;
  onEdit: () => void;
}) {
  const { user } = useCustomerAuth();
  const name = text(user?.name) || "Restocare User";
  const restaurant = text(user?.restaurantName);
  const contact = text(user?.email) || text(user?.mobile) || text(user?.phone);
  const initial = (name.charAt(0) || "U").toUpperCase();
  const photo = profileImageOf(user as Record<string, unknown> | null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ backgroundColor: CARD_BG }}
      className={`relative overflow-hidden rounded-3xl text-white shadow-xl shadow-black/10 ${
        compact ? "p-5" : "p-6 sm:p-8"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] mask-[linear-gradient(to_bottom,transparent,black_45%)]"
      >
        <DotWave background={CARD_BG} dense={false} className="h-full w-full" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rc-yellow/20 blur-3xl"
      />

      <div className={`relative flex gap-4 ${compact ? "flex-col" : "flex-wrap items-center gap-5"}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- external image
          <img
            src={photo}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-rc-yellow/60 sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rc-yellow text-2xl font-extrabold text-rc-ink sm:h-20 sm:w-20 sm:text-3xl">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{name}</p>
          {contact ? <p className="mt-0.5 truncate text-sm text-white/70">{contact}</p> : null}
          <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
            <StoreIcon className="h-3.5 w-3.5 shrink-0 text-rc-yellow" />
            <span className="truncate">{restaurant || "Add your restaurant"}</span>
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onEdit}
          whileTap={{ scale: 0.96 }}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:border-rc-yellow hover:bg-rc-yellow hover:text-rc-ink ${
            compact ? "w-full" : "basis-full sm:basis-auto"
          }`}
        >
          <PencilIcon className="h-4 w-4" />
          Edit profile
        </motion.button>
      </div>
    </motion.section>
  );
}

/* -------------------------------- page --------------------------------- */

function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isHydrating, logout } = useCustomerAuth();
  const [profileOpen, setProfileOpen] = useState(false); // phone-only modal
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [saved, setSaved] = useState(false); // "Profile saved" toast

  // Desktop: the open section lives in the URL (?section=orders) so a
  // refresh or a shared link lands on the same pane.
  const fromUrl = searchParams.get("section");
  const section: SectionId = isSectionId(fromUrl) ? fromUrl : DEFAULT_SECTION;
  const showSection = (id: SectionId) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (id === DEFAULT_SECTION) qs.delete("section");
    else qs.set("section", id);
    const query = qs.toString();
    router.replace(query ? `/account?${query}` : "/account", { scroll: false });
  };

  // Not logged in → bounce to the customer login (once hydration settles).
  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace("/account/login?redirect=/account");
  }, [isHydrating, isLoggedIn, router]);

  // The toast fades out on its own.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (isHydrating || !isLoggedIn) {
    return (
      <div data-theme="light" className="min-h-dvh bg-gray-50">
        <LandingHeader search="" onSearchChange={() => {}} />
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </div>
    );
  }

  const active = MENU.find((m) => m.id === section) ?? MENU[0];

  // Phones keep the tile list: profile opens a sheet, addresses scroll into
  // view, everything else is its own page.
  const openOnPhone = (item: MenuItem) => {
    if (item.id === "profile") setProfileOpen(true);
    else if (item.id === "addresses")
      document.getElementById("addresses")?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (item.href) router.push(item.href);
  };

  const confirmLogout = () => {
    setLogoutOpen(false);
    logout();
    router.replace("/");
  };

  const pane = (() => {
    switch (section) {
      case "orders":
        return <MyBookingsContent embedded />;
      case "profile":
        return (
          <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-7">
            <h2 className="text-lg font-bold text-gray-900">Profile & restaurant</h2>
            <p className="mb-6 mt-1 text-sm text-gray-500">
              Shown on your bookings and invoices.
            </p>
            <ProfileForm key={String(profileOpen)} onSaved={() => setSaved(true)} />
          </div>
        );
      case "addresses":
        return <AddressesSection />;
      case "settings":
        return <SettingsSection />;
      case "sos":
        return <SosSection />;
      case "contact":
        return <SupportSection />;
      default:
        return <ComingSoonPane item={active} />;
    }
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div data-theme="light" className="min-h-dvh bg-gray-50">
        <LandingHeader search="" onSearchChange={() => {}} />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-6 flex items-center gap-3"
          >
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:border-rc-yellow hover:bg-rc-yellow-tint"
            >
              <ArrowRightIcon className="h-4 w-4 rotate-180" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">My Account</h1>
          </motion.div>

          {/* ============ Desktop: sidebar + pane ============ */}
          <div className="hidden gap-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <ProfileCard compact onEdit={() => showSection("profile")} />

              <motion.nav
                variants={LIST}
                initial="hidden"
                animate="show"
                aria-label="Account sections"
                className="mt-4 rounded-3xl border border-gray-100 bg-white p-2"
              >
                {MENU.map((item, i) => {
                  const Icon = item.icon;
                  const isActive = item.id === section;
                  const soon = item.comingSoon === true;
                  return (
                    <motion.div key={item.id} variants={RISE}>
                      {/* Thin rule between the live items and the coming-soon ones */}
                      {soon && !MENU[i - 1]?.comingSoon ? (
                        <p className="mx-3 mb-1 mt-3 border-t border-gray-100 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          Coming soon
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => showSection(item.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? "bg-rc-ink text-white"
                            : soon
                              ? "text-gray-400 hover:bg-gray-50"
                              : "text-gray-700 hover:bg-rc-yellow-tint hover:text-rc-ink"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isActive
                              ? "bg-rc-yellow text-rc-ink"
                              : soon
                                ? "bg-gray-50 text-gray-300"
                                : "bg-rc-yellow-tint text-rc-yellow-deep group-hover:bg-rc-yellow group-hover:text-rc-ink"
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</span>
                        {isActive ? (
                          <ArrowRightIcon className="h-4 w-4 shrink-0 text-rc-yellow" />
                        ) : null}
                      </button>
                    </motion.div>
                  );
                })}

                <div className="mx-3 mt-2 border-t border-gray-100 pt-2">
                  <button
                    type="button"
                    onClick={() => setLogoutOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <LogoutIcon className="h-4 w-4" />
                    </span>
                    Log out
                  </button>
                </div>
              </motion.nav>
            </aside>

            <section className="min-w-0" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={section}
                  variants={PANE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {pane}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>

          {/* ============ Phones and tablets: card + tiles ============ */}
          <div className="mx-auto max-w-3xl lg:hidden">
            <ProfileCard onEdit={() => setProfileOpen(true)} />

            <motion.div
              variants={LIST}
              initial="hidden"
              animate="show"
              className="mt-6 grid gap-3 sm:grid-cols-2"
            >
              {MENU.map((item) => {
                const Icon = item.icon;
                const soon = item.comingSoon === true;
                return (
                  <motion.button
                    key={item.id}
                    variants={RISE}
                    whileHover={soon ? undefined : { y: -3 }}
                    whileTap={soon ? undefined : { scale: 0.98 }}
                    onClick={() => openOnPhone(item)}
                    className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-colors ${
                      soon
                        ? "border-gray-100 text-gray-400"
                        : "border-gray-200 hover:border-rc-yellow hover:shadow-lg hover:shadow-gray-900/5"
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        soon
                          ? "bg-gray-50 text-gray-300"
                          : "bg-rc-yellow-tint text-rc-yellow-deep group-hover:bg-rc-yellow group-hover:text-rc-ink"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${soon ? "text-gray-500" : "text-gray-900"}`}>
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-gray-400">{item.subtitle}</span>
                    </span>
                    {soon ? (
                      <span className="shrink-0 rounded-full bg-rc-yellow-tint px-2.5 py-1 text-[11px] font-bold text-rc-yellow-deep">
                        Soon
                      </span>
                    ) : (
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-rc-ink" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.section
              id="addresses"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.55 }}
              className="mt-10 scroll-mt-24"
            >
              <AddressesSection />
            </motion.section>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLogoutOpen(true)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <LogoutIcon className="h-4 w-4" />
              Log out
            </motion.button>
          </div>
        </main>

        <Footer />

        <Modal open={profileOpen} title="Profile & restaurant" onClose={() => setProfileOpen(false)}>
          <ProfileForm
            onCancel={() => setProfileOpen(false)}
            onSaved={() => {
              setProfileOpen(false);
              setSaved(true);
            }}
          />
        </Modal>

        <Modal open={logoutOpen} title="Log out?" onClose={() => setLogoutOpen(false)}>
          <p className="text-sm text-gray-600">
            You will need an OTP to sign in again. Your saved addresses and bookings stay with your
            account.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              className="h-12 flex-1 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Stay signed in
            </button>
            <motion.button
              type="button"
              onClick={confirmLogout}
              whileTap={{ scale: 0.98 }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-red-600 text-sm font-bold text-white transition hover:bg-red-700"
            >
              <LogoutIcon className="h-4 w-4" />
              Log out
            </motion.button>
          </div>
        </Modal>

        {/* Saved toast */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-rc-ink px-5 py-3 text-sm font-semibold text-white shadow-xl"
            >
              Profile saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

// useSearchParams needs a Suspense boundary around it.
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div data-theme="light" className="min-h-dvh bg-gray-50">
          <LandingHeader search="" onSearchChange={() => {}} />
          <div className="flex h-[60vh] items-center justify-center text-gray-400">
            <SpinnerIcon className="h-7 w-7" />
          </div>
        </div>
      }
    >
      <AccountPageInner />
    </Suspense>
  );
}
