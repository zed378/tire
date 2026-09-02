import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@c26/contracts";
import { isApiError } from "../../lib/api-client.ts";
import { Banner } from "../../components/ui/feedback.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";

export function RegisterPage(): ReactNode {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
  });

  const password = watch("password") || "";

  // Password strength helper
  const getPasswordStrength = (pwd: string): { label: string; score: number; color: string } => {
    if (!pwd) return { label: "Belum diisi", score: 0, color: "bg-slate-300 dark:bg-slate-700" };
    let score = 0;
    if (pwd.length >= 10) score++;
    if (pwd.length >= 14) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: "Sangat Lemah", score: 1, color: "bg-red-500" };
    if (score === 2) return { label: "Cukup", score: 2, color: "bg-amber-500" };
    if (score === 3) return { label: "Baik", score: 3, color: "bg-blue-500" };
    return { label: "Kuat", score: 4, color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors && Array.isArray(data.fieldErrors)) {
          const firstErr = data.fieldErrors[0];
          throw new Error(firstErr.message || "Validasi gagal.");
        }
        throw new Error(data.message || "Pendaftaran gagal diproses.");
      }

      // Redirect to welcome dashboard upon registration
      void navigate("/welcome", { replace: true });
    } catch (caught: unknown) {
      setError(caught);
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
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span className="hidden xs:inline sm:inline">SYSTEM ONLINE</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 lg:flex-row lg:gap-16">
        
        {/* Left Hero & Onboarding Telemetry */}
        <div className="mb-8 w-full max-w-lg lg:mb-0 lg:w-1/2">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 dark:border-cyan-500/30 dark:bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-brand-700 dark:text-cyan-300 uppercase backdrop-blur-md">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Onboarding Terminal
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Pendaftaran Akun <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Operator &amp; Supplier
            </span>
          </h1>

          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed sm:text-base">
            Daftarkan akun baru Anda untuk mulai mengelola pengajuan inspeksi ban armada, konfigurasi poros kendaraan, dan alur kontrol kualitas terintegrasi.
          </p>

          {/* Onboarding Steps Highlights */}
          <div className="mt-6 sm:mt-8 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-cyan-500/10 dark:text-cyan-400 font-bold text-xs">
                1
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Isi Kredensial Unik</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Tentukan User ID dan password sesuai standar keamanan data.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-bold text-xs">
                2
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Aktivasi &amp; Penetapan Hak Akses</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Admin akan mengonfirmasi penugasan wilayah operasional Anda.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-3.5 backdrop-blur-md shadow-sm">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold text-xs">
                3
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Siap Operasional Digital</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Mulai input data pengajuan dan pantau status QC secara real-time.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Glassmorphism Form Card */}
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl border border-slate-200/90 bg-white/90 dark:border-slate-800/90 dark:bg-slate-900/80 p-5 sm:p-7 shadow-xl dark:shadow-[0_0_60px_rgba(37,99,235,0.12)] backdrop-blur-2xl transition-all duration-300">
            
            {/* Top Accent Glow */}
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-500 dark:via-cyan-500 to-transparent opacity-80" />

            <div className="mb-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white">
                  Buat Akun Baru
                </h2>
                <span className="rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-cyan-400 border border-slate-200 dark:border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono">
                  TLS 1.3
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Masukkan informasi di bawah untuk mendaftarkan akun terminal Anda
              </p>
            </div>

            <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-3.5">
              {error !== null ? (
                <Banner tone="error" onDismiss={() => setError(null)}>
                  {error instanceof Error ? error.message : isApiError(error) ? error.envelope.message : "Pendaftaran gagal. Silakan coba lagi."}
                </Banner>
              ) : null}

              <Field label="User ID" htmlFor="username" error={errors.username?.message} hint="3–64 karakter (huruf, angka, titik, strip)" required>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  placeholder="contoh: joko_inspector"
                  invalid={errors.username !== undefined}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/30"
                  {...register("username")}
                />
              </Field>

              <Field label="Nama Lengkap" htmlFor="displayName" error={errors.displayName?.message} required>
                <Input
                  id="displayName"
                  autoComplete="name"
                  placeholder="contoh: Joko Susanto"
                  invalid={errors.displayName !== undefined}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/30"
                  {...register("displayName")}
                />
              </Field>

              <Field label="Password" htmlFor="password" error={errors.password?.message} hint="Minimal 10 karakter" required>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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

                {password ? (
                  <div className="mt-2">
                    <div className="flex h-1.5 gap-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full flex-1 transition-all duration-300 ${strength.score >= 1 ? strength.color : ""}`} />
                      <div className={`h-full flex-1 transition-all duration-300 ${strength.score >= 2 ? strength.color : ""}`} />
                      <div className={`h-full flex-1 transition-all duration-300 ${strength.score >= 3 ? strength.color : ""}`} />
                      <div className={`h-full flex-1 transition-all duration-300 ${strength.score >= 4 ? strength.color : ""}`} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Kekuatan password:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{strength.label}</span>
                    </div>
                  </div>
                ) : null}
              </Field>

              <Field label="Konfirmasi Password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    invalid={errors.confirmPassword !== undefined}
                    className="pr-10 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/30"
                    {...register("confirmPassword")}
                  />
                  <span
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    title={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showConfirmPassword ? (
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

              <Button
                type="submit"
                className="w-full border-0 bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 py-2.5 font-semibold tracking-wide text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:from-brand-500 hover:to-cyan-500 active:scale-[0.99] mt-2"
                loading={isSubmitting}
                loadingText="Mendaftarkan…"
              >
                Daftar Akun Sekarang
              </Button>
            </form>

            <div className="mt-5 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sudah memiliki akun terdaftar?{" "}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors">
                  Masuk di sini →
                </Link>
              </p>
            </div>
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
