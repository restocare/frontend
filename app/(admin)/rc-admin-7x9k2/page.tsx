"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { authApi, type LoginResponse } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { isAuthenticated, persistSession } from "@/src/lib/auth";
import { firstAllowedRoute } from "@/src/components/dashboard/sidebar";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  SpinnerIcon,
} from "@/src/components/icons";

// three.js backdrop: client-only and loaded after first paint.
const DotWave = dynamic(
  () => import("@/src/components/landing/dot-wave").then((m) => m.DotWave),
  { ssr: false },
);

/** Page background; the dot field's fog fades into this colour. */
const BG = "#0B0F1A";

const LOGO_URL =
  "https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png";

// No-op store: the auth snapshot only needs to be read once on the client.
const noopSubscribe = () => () => {};

/* ------------------------------ animation ------------------------------ */

const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const RISE: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function LoginPage() {
  const router = useRouter();

  // `undefined` during server render + hydration, then the real boolean on the
  // client. Redirect away from the login page as soon as we confirm an existing session
  // so an already-logged-in user never sees the login form.
  const authed = useSyncExternalStore<boolean | undefined>(
    noopSubscribe,
    isAuthenticated,
    () => undefined,
  );

  useEffect(() => {
    if (authed === true) router.replace(firstAllowedRoute());
  }, [authed, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) => authApi.login(vars),
    onSuccess: (data: LoginResponse) => {
      persistSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
        user: data.user,
        // STAFF permissions scope the whole panel (sidebar + landing page).
        permissions: data.permissions,
        roleNames: data.roleNames,
      });
      router.replace(firstAllowedRoute());
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email: email.trim(), password });
  };

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? "Something went wrong. Please try again."
        : null;

  const pending = loginMutation.isPending;
  const inputCls =
    "w-full rounded-2xl border border-white/15 bg-white/8 py-3.5 pl-11 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none backdrop-blur-md transition placeholder:text-slate-400/70 focus:border-rc-yellow/70 focus:bg-white/12 focus:ring-4 focus:ring-rc-yellow/15";

  // While checking the session, or once we know the user is already signed in
  // (redirect is in flight), show a spinner instead of flashing the login form.
  if (authed !== false) {
    return (
      <div
        data-theme="dark"
        style={{ backgroundColor: BG }}
        className="flex min-h-dvh items-center justify-center text-slate-400"
      >
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <main
        data-theme="dark"
        style={{ backgroundColor: BG }}
        className="relative flex min-h-dvh flex-col overflow-hidden text-slate-100"
      >
        {/* three.js dot field across the lower half, fading up into the page */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2 }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[74%] mask-[linear-gradient(to_bottom,transparent,black_38%)]"
        >
          <DotWave background={BG} dense className="h-full w-full" />
        </motion.div>
        {/* Ambient brand glow behind the card */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute left-1/2 top-1/3 h-112 w-md -translate-x-1/2 -translate-y-1/2 rounded-full bg-rc-yellow/10 blur-3xl"
        />

        {/* Top bar: wordmark + environment chip */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center justify-between px-5 py-5 sm:px-8"
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- external CDN logo */}
            <img src={LOGO_URL} alt="RestoCare" className="h-9 w-9 rounded-[5px] object-cover" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">RestoCare</p>
              <p className="text-xs text-slate-400">Admin console</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-slate-300">
            <ShieldIcon className="h-3.5 w-3.5 text-rc-yellow" />
            Restricted access
          </span>
        </motion.header>

        {/* Card */}
        <div className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:pb-20">
          <motion.div
            variants={STAGGER}
            initial="hidden"
            animate="show"
            className="w-full max-w-md"
          >
            <motion.div variants={RISE} className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sign in to the console
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Use your RestoCare staff email and password.
              </p>
            </motion.div>

            <motion.div
              variants={RISE}
              className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/8 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150 sm:p-8"
            >
              {/* Glass sheen: a soft light sweep from the top-left corner */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/12 via-transparent to-transparent"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rc-yellow/15 blur-2xl"
              />
              {/* Thin brand line along the top edge */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-rc-yellow/80 to-transparent"
              />

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-300">
                    Email address
                  </label>
                  <div className="relative">
                    <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@restocare.in"
                      className={`${inputCls} pr-4`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-slate-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/30 bg-white/10 accent-rc-yellow"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="font-medium text-rc-yellow transition hover:text-yellow-300"
                  >
                    Forgot password?
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {errorMessage && (
                    <motion.div
                      key={errorMessage}
                      role="alert"
                      initial={{ opacity: 0, height: 0, x: 0 }}
                      animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {errorMessage}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={pending}
                  whileHover={pending ? undefined : { y: -1 }}
                  whileTap={pending ? undefined : { scale: 0.98 }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rc-yellow text-sm font-bold text-rc-ink shadow-[0_10px_30px_rgba(244,180,0,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition-[filter,opacity] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? <SpinnerIcon className="h-4 w-4" /> : null}
                  {pending ? "Signing in…" : "Sign in"}
                  {pending ? null : <ArrowRightIcon className="h-4 w-4" />}
                </motion.button>
              </form>
            </motion.div>

            <motion.p
              variants={RISE}
              className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"
            >
              <LockIcon className="h-3.5 w-3.5" />
              Protected area. Authorized administrators only.
            </motion.p>
          </motion.div>
        </div>
      </main>
    </MotionConfig>
  );
}
