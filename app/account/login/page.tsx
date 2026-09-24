"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { normalizeMobileNumber } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

const LOGO_URL =
  "https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png";

const RESEND_TIMEOUT = 30;

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

  return (
    <div
      data-theme="light"
      className="relative flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 py-10"
    >
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900 sm:left-6 sm:top-6"
      >
        ← Back to home
      </Link>

      <Link href="/" className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- external CDN logo */}
        <img src={LOGO_URL} alt="RestoCare" className="h-10 w-auto object-contain" />
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {step === "mobile" ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Log in with your mobile number to continue your booking.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                Mobile number
              </label>
              <div className="flex items-center rounded-xl border border-gray-200 bg-white focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-900/10">
                <span className="select-none border-r border-gray-200 px-3 py-3 text-sm text-gray-500">
                  +91
                </span>
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Enter mobile number"
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={!isMobileValid || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {isLoading && <SpinnerIcon className="h-4 w-4" />}
              {isLoading ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Verify OTP
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Enter the code sent to +91 {normalizedMobile}.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium text-gray-700">
                OTP code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter OTP"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tracking-[0.3em] text-gray-900 placeholder:tracking-normal placeholder:text-gray-400 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={!isOtpValid || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {isLoading && <SpinnerIcon className="h-4 w-4" />}
              {isLoading ? "Verifying…" : "Verify & continue"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("mobile");
                  setOtp("");
                  setError(null);
                }}
                className="font-medium text-gray-500 hover:text-gray-900"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || isLoading}
                className="font-medium text-orange-600 hover:text-orange-700 disabled:text-gray-400"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        By continuing you agree to RestoCare&apos;s{" "}
        <a href="/terms-and-conditions" className="underline underline-offset-2 hover:text-gray-600">
          Terms
        </a>{" "}
        &amp;{" "}
        <a href="/privacy-policy" className="underline underline-offset-2 hover:text-gray-600">
          Privacy Policy
        </a>
        .
      </p>

      {/* Admins / super admins sign in with email + password instead of OTP. */}
      <Link
        href="/login"
        className="mt-4 text-center text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
      >
        Are you an admin? Sign in with email &amp; password →
      </Link>
    </div>
  );
}
