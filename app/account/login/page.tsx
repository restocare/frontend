"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { normalizeMobileNumber } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  ClockIcon,
  LockIcon,
  PhoneIcon,
  SpinnerIcon,
  WalletIcon,
} from "@/src/components/icons";

// three.js backdrop: client-only and loaded after first paint.
const DotWave = dynamic(
  () => import("@/src/components/landing/dot-wave").then((m) => m.DotWave),
  { ssr: false },
);

const LOGO_URL =
  "https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png";

const RESEND_TIMEOUT = 30;

const BENEFITS = [
  {
    Icon: BadgeCheckIcon,
    title: "Verified professionals",
    text: "Background-checked chefs, helpers and technicians.",
  },
  { Icon: ClockIcon, title: "Book by the hour", text: "Pick the date and the hours you need." },
  { Icon: WalletIcon, title: "Online or COD", text: "Pay the way that suits your restaurant." },
];

/** True from the lg breakpoint up; false until mounted. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    queueMicrotask(sync);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

/* ------------------------------ animation ------------------------------ */

const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const RISE: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const STEP: Variants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2, ease: "easeIn" } },
};

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginContent />
    </Suspense>
  );
}

function CustomerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const { isLoggedIn, isHydrating, isLoading, sendOtp, resendOtp, verifyOtp } =
    useCustomerAuth();

  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_TIMEOUT);
  const isDesktop = useIsDesktop();

  const normalizedMobile = normalizeMobileNumber(mobile);
  const isMobileValid = normalizedMobile.length === 10;
  const isOtpValid = otp.replace(/\D/g, "").length >= 4;

  // Already logged in → bounce to the redirect target.
  useEffect(() => {
    if (!isHydrating && isLoggedIn) router.replace(redirectTo);
  }, [isHydrating, isLoggedIn, redirectTo, router]);

  // Resend countdown while on the OTP step.
  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

  const toMessage = (e: unknown, fallback: string) =>
    e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;

  const handleSendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isMobileValid) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    try {
      await sendOtp(normalizedMobile);
      setStep("otp");
      setCountdown(RESEND_TIMEOUT);
    } catch (err) {
      setError(toMessage(err, "Failed to send OTP. Please try again."));
    }
  };

  const handleVerify = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!isOtpValid) {
      setError("Please enter the OTP sent to your mobile.");
      return;
    }
    try {
      await verifyOtp(normalizedMobile, otp);
      router.replace(redirectTo);
    } catch (err) {
      setError(toMessage(err, "Unable to verify the OTP."));
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    try {
      await resendOtp(normalizedMobile);
      setCountdown(RESEND_TIMEOUT);
    } catch (err) {
      setError(toMessage(err, "Unable to resend the OTP."));
    }
  };

  const primaryBtn =
    "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rc-yellow text-sm font-bold text-rc-ink shadow-md shadow-rc-yellow/25 transition-[filter,opacity] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

  return (
    <MotionConfig reducedMotion="user">
      <div data-theme="light" className="flex min-h-dvh flex-col bg-white text-rc-ink lg:flex-row">
        {/* ===== Brand panel: compact header on phones, full half on desktop ===== */}
        <aside className="relative overflow-hidden rounded-b-3xl bg-rc-ink text-white lg:sticky lg:top-0 lg:h-dvh lg:w-1/2 lg:rounded-none">
          {/* three.js dot wave, fading up into the panel colour */}
          {/* Desktop: the wave fills the lower part below the copy and fades
              in at its top edge. Phones: it sits behind the header copy under
              a dark wash so the text stays readable. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-full lg:h-[46%] lg:mask-[linear-gradient(to_bottom,transparent,black_45%)]"
          >
            <DotWave
              key={isDesktop ? "desktop" : "phone"}
              dense={isDesktop}
              className="h-full w-full"
            />
          </motion.div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-rc-ink from-35% via-rc-ink/70 to-rc-ink/10 lg:hidden"
          />
          <motion.div
            aria-hidden
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-rc-yellow/20 blur-3xl"
          />

          <motion.div
            variants={STAGGER}
            initial="hidden"
            animate="show"
            className="relative flex h-full flex-col px-5 pb-12 pt-5 sm:px-8 lg:px-14 lg:pb-12 lg:pt-12 xl:px-20"
          >
            {/* Logo row (Back link lives here on phones) */}
            <motion.div variants={RISE} className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- external CDN logo */}
                <img src={LOGO_URL} alt="" className="h-9 w-auto rounded-md object-contain" />
                <span className="text-lg font-bold tracking-tight">RestoCare</span>
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              >
                ← Home
              </Link>
            </motion.div>

            <div className="mt-6 max-w-lg lg:mt-[12vh]">
              <motion.h2
                variants={RISE}
                className="text-2xl font-bold leading-[1.1] tracking-tight sm:text-3xl lg:text-5xl"
              >
                Your restaurant,
                <br className="hidden lg:block" /> staffed and running.
              </motion.h2>
              <motion.p
                variants={RISE}
                className="mt-2 text-sm leading-relaxed text-white/65 sm:text-base lg:mt-5 lg:text-lg"
              >
                Book verified chefs, helpers, cleaning crews and technicians across Delhi NCR.
              </motion.p>

              {/* Phones: three compact chips */}
              <motion.ul variants={RISE} className="mt-5 flex flex-wrap gap-2 lg:hidden">
                {BENEFITS.map(({ Icon, title }) => (
                  <li
                    key={title}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-rc-yellow" />
                    {title}
                  </li>
                ))}
              </motion.ul>

              {/* Desktop: one clean column */}
              <ul className="mt-10 hidden space-y-5 lg:block">
                {BENEFITS.map(({ Icon, title, text }) => (
                  <motion.li key={title} variants={RISE} className="flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rc-yellow/15 text-rc-yellow ring-1 ring-rc-yellow/25">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-sm text-white/55">{text}</span>
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Help card, glass over the wave */}
            <motion.a
              variants={RISE}
              href="tel:+919953532995"
              whileHover={{ y: -2 }}
              className="mt-auto hidden w-fit items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-white/10 lg:flex"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-rc-yellow text-rc-ink">
                <PhoneIcon className="h-4.5 w-4.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-xs text-white/55">Need help? Mon–Sat, 10 AM – 6 PM</span>
                <span className="mt-0.5 block font-semibold">+91 99535 32995</span>
              </span>
            </motion.a>
          </motion.div>
        </aside>

        {/* ===== Login form ===== */}
        <main className="relative flex flex-1 flex-col px-4 pb-8 sm:px-8 lg:px-12">
          <div className="hidden justify-end pt-8 lg:flex">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-rc-line px-4 py-2 text-sm font-medium text-rc-ink-2 transition-colors hover:bg-gray-50 hover:text-rc-ink"
            >
              ← Back to home
            </Link>
          </div>

          <div className="flex items-start justify-center lg:flex-1 lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
              className="-mt-6 w-full max-w-md rounded-3xl border border-rc-line bg-white p-6 shadow-xl shadow-black/5 sm:p-8 lg:mt-0 lg:border-0 lg:p-0 lg:shadow-none"
            >
              {/* Step badge: phone → lock, flipping in as the step changes */}
              <div className="mb-6 flex items-center justify-between">
                <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-rc-yellow-tint text-rc-yellow-deep">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={step}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      exit={{ rotateY: -90, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex"
                    >
                      {step === "mobile" ? (
                        <PhoneIcon className="h-5 w-5" />
                      ) : (
                        <LockIcon className="h-5 w-5" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-rc-muted">
                  {(["mobile", "otp"] as const).map((s) => (
                    <motion.span
                      key={s}
                      aria-hidden
                      animate={{
                        width: step === s ? 18 : 6,
                        backgroundColor: step === s ? "#F4B400" : "#E7E8EE",
                      }}
                      transition={{ duration: 0.3 }}
                      className="h-1.5 rounded-full"
                    />
                  ))}
                  <span className="ml-1">Step {step === "mobile" ? 1 : 2} of 2</span>
                </span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {step === "mobile" ? (
                  <motion.form
                    key="mobile"
                    variants={STEP}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleSendOtp}
                    className="space-y-5"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
                      <p className="mt-1.5 text-sm text-rc-muted">
                        Log in with your mobile number to continue your booking.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="mobile" className="text-sm font-semibold text-rc-ink">
                        Mobile number
                      </label>
                      <div className="flex items-center rounded-2xl border border-rc-line bg-white transition focus-within:border-rc-yellow focus-within:ring-4 focus-within:ring-rc-yellow/20">
                        <span className="select-none border-r border-rc-line px-3.5 py-3.5 text-sm font-semibold text-rc-ink-2">
                          +91
                        </span>
                        <input
                          id="mobile"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          autoFocus
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          placeholder="98765 43210"
                          className="w-full bg-transparent px-3.5 py-3.5 text-base font-medium tracking-wide text-rc-ink outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
                        />
                      </div>
                      <p className="text-xs text-rc-muted">We&apos;ll send a one-time code to this number.</p>
                    </div>

                    <ErrorNote error={error} />

                    <motion.button
                      type="submit"
                      disabled={!isMobileValid || isLoading}
                      whileTap={isMobileValid ? { scale: 0.98 } : undefined}
                      className={primaryBtn}
                    >
                      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
                      {isLoading ? "Sending OTP…" : "Send OTP"}
                      {isLoading ? null : <ArrowRightIcon className="h-4 w-4" />}
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="otp"
                    variants={STEP}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleVerify}
                    className="space-y-5"
                  >
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Verify OTP</h1>
                      <p className="mt-1.5 text-sm text-rc-muted">
                        Enter the code sent to{" "}
                        <span className="font-semibold text-rc-ink">+91 {normalizedMobile}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setStep("mobile");
                            setOtp("");
                            setError(null);
                          }}
                          className="ml-2 font-semibold text-rc-yellow-deep hover:underline"
                        >
                          Edit
                        </button>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="otp" className="text-sm font-semibold text-rc-ink">
                        OTP code
                      </label>
                      <input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={8}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="• • • •"
                        className="w-full rounded-2xl border border-rc-line bg-white px-4 py-3.5 text-center text-2xl font-bold tracking-[0.5em] text-rc-ink outline-none transition placeholder:text-gray-300 focus:border-rc-yellow focus:ring-4 focus:ring-rc-yellow/20"
                      />
                    </div>

                    <ErrorNote error={error} />

                    <motion.button
                      type="submit"
                      disabled={!isOtpValid || isLoading}
                      whileTap={isOtpValid ? { scale: 0.98 } : undefined}
                      className={primaryBtn}
                    >
                      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
                      {isLoading ? "Verifying…" : "Verify & continue"}
                      {isLoading ? null : <ArrowRightIcon className="h-4 w-4" />}
                    </motion.button>

                    <p className="text-center text-sm text-rc-muted">
                      Didn&apos;t get it?{" "}
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={countdown > 0 || isLoading}
                        className="font-semibold text-rc-yellow-deep hover:underline disabled:cursor-not-allowed disabled:text-rc-muted disabled:no-underline"
                      >
                        {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                      </button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="mt-8 text-center text-xs text-rc-muted">
                By continuing you agree to RestoCare&apos;s{" "}
                <a href="/terms-and-conditions" className="underline underline-offset-2 hover:text-rc-ink">
                  Terms
                </a>{" "}
                &amp;{" "}
                <a href="/privacy-policy" className="underline underline-offset-2 hover:text-rc-ink">
                  Privacy Policy
                </a>
                .
              </p>
            </motion.div>
          </div>

          {/* Admins / super admins sign in with email + password instead of OTP. */}
          <div className="mt-8 flex flex-col items-center gap-3 text-xs text-rc-muted lg:mt-0">
            <a href="tel:+919953532995" className="flex items-center gap-1.5 lg:hidden">
              <PhoneIcon className="h-3.5 w-3.5 text-rc-yellow-deep" />
              Need help? <span className="font-semibold text-rc-ink">+91 99535 32995</span>
            </a>
            <Link
              href="/login"
              className="font-medium underline-offset-2 hover:text-rc-ink hover:underline"
            >
              Are you an admin? Sign in with email &amp; password →
            </Link>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {error ? (
        <motion.p
          key={error}
          role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl bg-rc-red/5 px-4 py-3 text-sm text-rc-red ring-1 ring-rc-red/20"
        >
          {error}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
