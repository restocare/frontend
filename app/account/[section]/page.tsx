"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { customerAuthApi } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";

type SectionType = "coming-soon" | "settings" | "sos" | "support";

interface SectionConfig {
  title: string;
  icon: string;
  type: SectionType;
  accent: string;
}

const SECTIONS: Record<string, SectionConfig> = {
  loyalty: { title: "Loyalty", icon: "💖", type: "coming-soon", accent: "#7C3AED" },
  wallet: { title: "Wallet", icon: "💳", type: "coming-soon", accent: "#0F766E" },
  wishlist: { title: "Wishlist", icon: "🤍", type: "coming-soon", accent: "#DC2626" },
  join: { title: "Join Us", icon: "🔗", type: "coming-soon", accent: "#EA580C" },
  settings: { title: "Settings", icon: "⚙️", type: "settings", accent: "#2563EB" },
  sos: { title: "SOS", icon: "🆘", type: "sos", accent: "#BE123C" },
  contact: { title: "Support Center", icon: "🎧", type: "support", accent: "#0891B2" },
};

export default function AccountSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const router = useRouter();
  const { isLoggedIn, isHydrating } = useCustomerAuth();

  const config = SECTIONS[section];

  useEffect(() => {
    if (!isHydrating && !isLoggedIn) {
      router.replace(`/account/login?redirect=/account/${section}`);
    }
  }, [isHydrating, isLoggedIn, router, section]);

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

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <LandingHeader search="" onSearchChange={() => {}} />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/account" className="text-2xl leading-none text-gray-900" aria-label="Back">
            ←
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            {config?.title ?? "Account"}
          </h1>
        </div>

        {!config ? (
          <NotFoundSection />
        ) : config.type === "settings" ? (
          <SettingsSection />
        ) : config.type === "sos" ? (
          <SosSection />
        ) : config.type === "support" ? (
          <SupportSection />
        ) : (
          <ComingSoon icon={config.icon} title={config.title} accent={config.accent} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function NotFoundSection() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <p className="text-5xl">🔍</p>
      <p className="mt-3 text-sm text-gray-500">This section doesn&apos;t exist.</p>
      <Link
        href="/account"
        className="mt-6 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Back to account
      </Link>
    </div>
  );
}

function ComingSoon({
  icon,
  title,
  accent,
}: {
  icon: string;
  title: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-8 py-16 text-center shadow-sm">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full text-4xl"
        style={{ backgroundColor: `${accent}14` }}
      >
        {icon}
      </div>
      <span
        className="mt-5 rounded-full px-3.5 py-1.5 text-xs font-extrabold tracking-wider text-white"
        style={{ backgroundColor: accent }}
      >
        COMING SOON
      </span>
      <h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
        We&apos;re working hard on this feature. Stay tuned — it will be available in an upcoming
        update!
      </p>
    </div>
  );
}

const SETTINGS_CARDS = [
  {
    id: "notifications",
    title: "Notifications",
    description: "Booking updates, offers, and reminders",
    comingSoon: true,
  },
  {
    id: "language",
    title: "Language",
    description: "English selected for your app experience",
    comingSoon: true,
  },
];

function SettingsSection() {
  const router = useRouter();
  const { logout } = useCustomerAuth();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await customerAuthApi.deleteAccount();
      logout();
      router.replace("/account/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete your account right now.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {SETTINGS_CARDS.map((c) => (
        <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{c.title}</p>
            {c.comingSoon && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{c.description}</p>
        </div>
      ))}

      {/* Logout */}
      <button
        onClick={() => {
          logout();
          router.replace("/");
        }}
        className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left text-sm font-semibold text-gray-900 transition hover:border-gray-300"
      >
        Log out
      </button>

      {/* Delete account */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-700">Delete account</p>
        <p className="mt-1 text-xs text-red-500">
          Permanently removes your account, bookings, addresses and all other data. This cannot be
          undone.
        </p>
        {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}

        {confirming ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isDeleting ? <SpinnerIcon className="h-4 w-4" /> : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 w-full rounded-xl border border-red-300 bg-white py-2.5 text-sm font-bold text-red-600 hover:bg-red-100"
          >
            Delete Account
          </button>
        )}
      </div>
    </div>
  );
}

const SOS_CONTACTS = [
  {
    id: "rc",
    title: "RestoCare Emergency Desk",
    phone: "+91 99535 32995",
    availability: "24/7 support",
  },
  { id: "city", title: "City Safety Helpline", phone: "+91 112", availability: "Emergency assistance" },
];

function SosSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        In an emergency during a booking, reach out immediately using the contacts below.
      </p>
      {SOS_CONTACTS.map((c) => (
        <a
          key={c.id}
          href={`tel:${c.phone.replace(/\s/g, "")}`}
          className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="text-sm font-bold text-gray-900">{c.title}</p>
            <p className="text-xs text-gray-400">{c.availability}</p>
          </div>
          <span className="rounded-full bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-700">
            {c.phone}
          </span>
        </a>
      ))}
    </div>
  );
}

const SUPPORT_OPTIONS = [
  {
    id: "whatsapp",
    icon: "💬",
    title: "WhatsApp",
    subtitle: "+91 99535 32995",
    href: "https://wa.me/919953532995",
  },
  { id: "call", icon: "📞", title: "Call us", subtitle: "+91 99535 32995", href: "tel:+919953532995" },
  {
    id: "email",
    icon: "✉️",
    title: "Email",
    subtitle: "support@restocare.in",
    href: "mailto:support@restocare.in",
  },
];

function SupportSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Need help with a booking, payment or your account? We&apos;re here for you.
      </p>
      {SUPPORT_OPTIONS.map((o) => (
        <a
          key={o.id}
          href={o.href}
          target={o.id === "whatsapp" ? "_blank" : undefined}
          rel="noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
            {o.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{o.title}</p>
            <p className="truncate text-xs text-gray-400">{o.subtitle}</p>
          </div>
          <span className="text-gray-300">›</span>
        </a>
      ))}
    </div>
  );
}
