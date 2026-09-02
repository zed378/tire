import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@c26/contracts";
import { isApiError } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { Banner } from "../../components/ui/feedback.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";

/**
 * Login (PLAN/04 §4).
 *
 * WHAT IS NOT HERE: the demo panel. D-16 found three buttons on the legacy login
 * page that authenticated as Supplier, Admin, or PM/SPV with no credentials at
 * all — the most severe finding in the audit if that application had ever
 * touched real data. There is no path here that skips password verification, and
 * gate G-10 greps the source to make sure one does not reappear.
 *
 * The red dismissible banner is a deliberate port: it was the one piece of error
 * handling the legacy system got right (K-08), so it became the standard rather
 * than being replaced.
 */
export function LoginPage(): ReactNode {
  const { user, login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  if (user !== null) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/inspections"} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      const result = await login(values);

      if (result.status === "mfa_required") {
        setNeedsTotp(true);
        setTimeout(() => setFocus("totpCode"), 0);
        return;
      }

      if (result.status === "mfa_enrollment_required") {
        void navigate("/profile/mfa", { replace: true });
        return;
      }

      if (result.status === "must_change_password") {
        void navigate("/profile/password", { replace: true });
        return;
      }

      const from = (location.state as { from?: string } | null)?.from;
      void navigate(from ?? "/inspections", { replace: true });
    } catch (caught) {
      setError(caught);
      if (isApiError(caught) && caught.code === "INVALID_CREDENTIALS" && needsTotp) {
        setTimeout(() => setFocus("totpCode"), 0);
      }
    }
  });

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-cyan-500/30 dark:selection:text-cyan-200 transition-colors duration-200">
      {/* Background Cyber Grid & Ambient Glowing Lights */}
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid opacity-15 dark:opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-tire-radial opacity-40 dark:opacity-100" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 dark:bg-blue-600/20 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-400/10 dark:bg-cyan-500/20 blur-[120px] animate-glow-pulse" />

      {/* Top Navigation Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/60 px-4 sm:px-6 py-3.5 sm:py-4 backdrop-blur-md transition-colors duration-200">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-cyan-500 to-indigo-500 p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-white dark:bg-slate-950">
              <svg className="h-5 w-5 text-brand-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" strokeDasharray="3 3" className="animate-spin-very-slow" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
              </svg>
            </div>
          </div>
          <span className="text-base font-bold tracking-wider text-slate-900 dark:text-white">
            COMMERCIAL<span className="text-brand-600 dark:text-cyan-400">2026</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Beranda</span>
            </Button>
          </Link>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 sm:px-3 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span>SYSTEM ONLINE</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-12 lg:flex-row lg:gap-16">
        
        {/* Left Hero & Telemetry Info */}
        <div className="mb-8 w-full max-w-lg lg:mb-0 lg:w-1/2">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 dark:border-cyan-500/30 dark:bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-brand-700 dark:text-cyan-300 uppercase backdrop-blur-md">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Next-Gen Fleet Telemetry
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Sistem Pengolahan <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Data Ban Bus &amp; Truk
            </span>
          </h1>

          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed sm:text-base">
            Platform inspeksi armada terintegrasi dengan pemantauan tekanan, kedalaman alur, dan analisis kondisi ban secara presisi tinggi.
          </p>

          {/* Feature Badges */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm transition-all hover:border-brand-500/40 dark:hover:border-cyan-500/40">
              <div className="mb-1 text-brand-600 dark:text-cyan-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Real-time QC</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Inspeksi Digital</div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm transition-all hover:border-brand-500/40 dark:hover:border-cyan-500/40">
              <div className="mb-1 text-blue-600 dark:text-blue-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Axle Mapping</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Konfigurasi Poros</div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm transition-all hover:border-brand-500/40 dark:hover:border-cyan-500/40">
              <div className="mb-1 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Audit Ready</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Integrasi Data</div>
            </div>
          </div>
        </div>

        {/* Right Glassmorphism Form Card */}
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl border border-slate-200/90 bg-white/90 dark:border-slate-800/90 dark:bg-slate-900/80 p-5 sm:p-7 shadow-xl dark:shadow-[0_0_60px_rgba(37,99,235,0.12)] backdrop-blur-2xl transition-all duration-300">
            
            {/* Top Accent Glow */}
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-500 dark:via-cyan-500 to-transparent opacity-80" />

            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white">
                  Otentikasi Pengguna
                </h2>
                <span className="rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-cyan-400 border border-slate-200 dark:border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono">
                  TLS 1.3
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Masukkan kredensial akun Anda untuk mengakses terminal
              </p>
            </div>

            <form
              onSubmit={(event) => void onSubmit(event)}
              noValidate
              className="space-y-4"
            >
              {error !== null ? <ErrorSummary error={error} onDismiss={() => setError(null)} /> : null}

              <Field label="User ID" htmlFor="username" error={errors.username?.message} required>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  invalid={errors.username !== undefined}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/30"
                  {...register("username")}
                />
              </Field>

              <Field label="Password" htmlFor="password" error={errors.password?.message} required>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    invalid={errors.password !== undefined}
                    className="pr-10 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/30"
                    {...register("password")}
                  />
                  <span
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </span>
                </div>
              </Field>

              {needsTotp ? (
                useRecoveryCode ? (
                  <Field
                    label="Kode pemulihan"
                    htmlFor="recoveryCode"
                    error={errors.recoveryCode?.message}
                    hint="Gunakan salah satu kode sekali pakai yang Anda simpan saat mendaftarkan autentikasi dua faktor."
                  >
                    <Input
                      id="recoveryCode"
                      autoComplete="one-time-code"
                      invalid={errors.recoveryCode !== undefined}
                      className="border-slate-800 dark:border-slate-700 bg-slate-950/80 dark:bg-slate-900/80 text-white dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/30"
                      {...register("recoveryCode")}
                    />
                  </Field>
                ) : (
                  <Field
                    label="Kode autentikasi"
                    htmlFor="totpCode"
                    error={errors.totpCode?.message}
                    hint="Enam angka dari aplikasi authenticator Anda. Kode ini bekerja tanpa sinyal."
                  >
                    <Input
                      id="totpCode"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      invalid={errors.totpCode !== undefined}
                      className="border-slate-800 dark:border-slate-700 bg-slate-950/80 dark:bg-slate-900/80 text-center font-mono text-lg tracking-widest text-white dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/30"
                      {...register("totpCode")}
                    />
                  </Field>
                )
              ) : null}

              <Button
                type="submit"
                className="w-full border-0 bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 py-2.5 font-semibold tracking-wide text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:from-brand-500 hover:to-cyan-500 active:scale-[0.99]"
                loading={isSubmitting}
                loadingText="Memproses…"
              >
                {needsTotp ? "Verifikasi" : "Masuk"}
              </Button>

              {needsTotp ? (
                <span
                  className="mt-2 block w-full cursor-pointer text-center text-xs text-cyan-400 underline transition-colors hover:text-cyan-300"
                  onClick={() => setUseRecoveryCode((current) => !current)}
                >
                  {useRecoveryCode
                    ? "Gunakan kode dari aplikasi authenticator"
                    : "Kehilangan akses ke authenticator? Pakai kode pemulihan"}
                </span>
              ) : null}
            </form>

            {/* Redirect to Register Page */}
            <div className="mt-5 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Belum memiliki akun?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-brand-600 hover:text-brand-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors underline-offset-2 hover:underline"
                >
                  Daftar akun baru di sini →
                </Link>
              </p>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Lupa password? Hubungi admin untuk mengatur ulang.
            </p>
          </div>

          {/* Back to Home Button under the form */}
          <div className="mt-4 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Kembali ke Beranda
            </Link>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/80 px-6 py-3 text-center text-xs text-slate-500 dark:text-slate-400 backdrop-blur-md">
        Commercial 2026 &copy; Sistem Pengolahan Data Ban Bus &amp; Truk. All rights reserved.
      </footer>
    </div>
  );
}

function ErrorSummary({ error, onDismiss }: { error: unknown; onDismiss: () => void }): ReactNode {
  if (!isApiError(error)) {
    return <Banner onDismiss={onDismiss}>Terjadi kesalahan. Silakan coba lagi.</Banner>;
  }

  return (
    <Banner
      tone={error.code === "ACCOUNT_LOCKED" ? "warning" : "error"}
      onDismiss={onDismiss}
      requestId={error.code === "INTERNAL_ERROR" ? error.requestId : undefined}
    >
      {error.envelope.message}
    </Banner>
  );
}
