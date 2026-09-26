"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi, GOOGLE_AUTH_URL, type LoginResponse } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { isAuthenticated, persistSession } from "@/src/lib/auth";
import { firstAllowedRoute } from "@/src/components/dashboard/sidebar";
import {
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  SpinnerIcon,
} from "@/src/components/icons";

// No-op store: the auth snapshot only needs to be read once on the client.
const noopSubscribe = () => () => {};

export default function LoginPage() {
  const router = useRouter();

  // `undefined` during server render + hydration, then the real boolean on the
  // client. Redirect away from /login as soon as we confirm an existing session
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

  // While checking the session, or once we know the user is already signed in
  // (redirect is in flight), show a spinner instead of flashing the login form.
  if (authed !== false) {
    return (
      <div
        data-theme="dark"
        className="flex min-h-dvh items-center justify-center bg-[#070b18] text-slate-400"
      >
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <main
      data-theme="dark"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#070b18] px-4 py-10 text-slate-100"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.15),transparent_60%)]" />

      <div className="relative w-full max-w-md">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-900/40">
            RC
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to the RestoCare admin console
          </p>
        </div>

        {/* card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@restocare.in"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1325] py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1325] py-3 pl-11 pr-11 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
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
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-blue-500"
                />
                Remember me
              </label>
              <button type="button" className="font-medium text-blue-400 hover:text-blue-300">
                Forgot password?
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:from-blue-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending && <SpinnerIcon className="h-4 w-4" />}
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* divider */}
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-slate-500">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Google login */}
          <a
            href={GOOGLE_AUTH_URL}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <GoogleIcon />
            Continue with Google
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Protected area · authorized administrators only
        </p>
      </div>
    </main>
  );
}
