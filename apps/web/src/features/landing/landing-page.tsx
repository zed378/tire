import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";

export function LandingPage(): ReactNode {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-cyan-500/30 dark:selection:text-cyan-200 transition-colors duration-200">
      {/* Background Cyber Grid & Ambient Glowing Lights */}
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid opacity-15 dark:opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-tire-radial opacity-30 dark:opacity-100" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 dark:bg-blue-600/15 blur-[140px] animate-glow-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-400/10 dark:bg-cyan-500/15 blur-[140px] animate-glow-pulse" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-[140px] animate-glow-pulse" />

      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/75 dark:border-slate-800/80 dark:bg-slate-950/70 px-4 sm:px-8 py-3.5 backdrop-blur-xl transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
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

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-brand-600 dark:hover:text-cyan-400 transition-colors">Fitur Unggulan</a>
            <a href="#showcase" className="hover:text-brand-600 dark:hover:text-cyan-400 transition-colors">Platform</a>
            <a href="#workflow" className="hover:text-brand-600 dark:hover:text-cyan-400 transition-colors">Alur Kerja</a>
            <a href="#faq" className="hover:text-brand-600 dark:hover:text-cyan-400 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>SYSTEM ONLINE</span>
            </div>

            <ThemeToggle />

            <Link to="/login">
              <Button variant="secondary" className="min-h-9 px-3.5 text-xs sm:text-sm">
                Masuk
              </Button>
            </Link>
            <Link to="/register">
              <Button className="min-h-9 bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 px-3.5 text-xs sm:text-sm text-white shadow-md shadow-brand-500/20 hover:from-brand-500 hover:to-cyan-500">
                Daftar Akun
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 dark:border-cyan-500/30 dark:bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-brand-700 dark:text-cyan-300 uppercase backdrop-blur-md">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Next-Gen Fleet Telemetry &amp; Tire Management
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl leading-[1.15]">
            Sistem Pengolahan Data Ban <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Bus &amp; Truk Terintegrasi
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Platform inspeksi armada modern dengan visualisasi konfigurasi poros (axle mapping), approval Quality Control bertingkat, dan jejak audit tak terbantahkan.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
            <Link to="/register">
              <Button className="min-h-12 bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 px-7 text-sm sm:text-base font-semibold text-white shadow-xl shadow-brand-500/25 hover:from-brand-500 hover:to-cyan-500 active:scale-[0.99] transition-all">
                Mulai Registrasi →
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="min-h-12 px-7 text-sm sm:text-base font-semibold shadow-sm">
                Masuk ke Terminal
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Image Showcase */}
        <div className="mt-14 sm:mt-16 relative mx-auto max-w-5xl">
          <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/70 dark:bg-slate-900/70 p-2 sm:p-3 shadow-2xl backdrop-blur-2xl">
            {/* Top Accent Line */}
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-brand-500 dark:via-cyan-500 to-transparent" />
            
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl aspect-[16/9] sm:aspect-[21/9] bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=80"
                alt="Armada Truk Komersial di Jalan Raya - Photo by Marcin Jozwiak di Unsplash"
                className="h-full w-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
              
              {/* Overlay Badges */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 rounded-lg bg-slate-900/85 border border-slate-700/80 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-lg">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono font-semibold">100% Audit Precision</span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-wrap items-end justify-between gap-3 text-white">
                <div>
                  <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Fleet Monitoring Gateway</div>
                  <div className="text-sm sm:text-xl font-bold">Pengelolaan Ban Truk Berat &amp; Bus Lintas Wilayah</div>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs backdrop-blur-md">
                  <span>Poros TB &amp; LT Didukung Penuh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-10 border-y border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-10 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8 text-center">
            <div className="p-3">
              <div className="text-2xl sm:text-4xl font-extrabold text-brand-600 dark:text-cyan-400">1.500+</div>
              <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Pola Pattern &amp; Ukuran Ban</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-4xl font-extrabold text-blue-600 dark:text-blue-400">100%</div>
              <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Jejak Audit Append-Only</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">32+</div>
              <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Provinsi &amp; 290+ Kota</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">0%</div>
              <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Bypass QC Tanpa Bukti</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-cyan-400">Fitur Terdepan</h2>
          <p className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dirancang Khusus untuk Ketelitian dan Keandalan Data Armada
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm hover:shadow-xl hover:border-brand-500/40 dark:hover:border-cyan-500/40 transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 via-cyan-500/10 to-indigo-500/10 text-brand-600 dark:text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
                {feat.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visual Platform Showcase with Free Stock Photos */}
      <section id="showcase" className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-cyan-400">Platform Dalam Aksi</h2>
            <p className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Solusi Terpadu Lapangan Hingga Manajemen
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Card 1: Bus & Heavy Transport */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 overflow-hidden shadow-lg backdrop-blur-md flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-slate-900 relative">
                <img
                  src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80"
                  alt="Armada Bus Komersial Modern - Photo by Ant Rozetsky di Unsplash"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-3 right-3 text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded backdrop-blur-sm">
                  Bus Fleet
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Manajemen Armada Bus Komersial</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Pengawasan komprehensif untuk trayek antar kota &amp; provinsi dengan segmentasi data per kota dan provinsi yang ketat.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-brand-600 dark:text-cyan-400">
                  ✓ Penugasan Wilayah Operator
                </div>
              </div>
            </div>

            {/* Card 2: Tire & Wheel Maintenance */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 overflow-hidden shadow-lg backdrop-blur-md flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-slate-900 relative">
                <img
                  src="https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80"
                  alt="Pengecekan dan Pemeliharaan Roda & Ban Truk - Photo by Chuttersnap di Unsplash"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-3 right-3 text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded backdrop-blur-sm">
                  Physical Inspection
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Inspeksi Roda &amp; Kedalaman Alur</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Verifikasi kondisi ban per posisi roda, pencatatan ply rating, status vulkanisir, serta bukti foto slot beresolusi tinggi.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-blue-600 dark:text-blue-400">
                  ✓ 3-Slot Foto Bukti Fisik
                </div>
              </div>
            </div>

            {/* Card 3: Telemetry & Analytics */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 overflow-hidden shadow-lg backdrop-blur-md flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-slate-900 relative">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                  alt="Dashboard Analitik dan Metrik Data - Photo by Luke Chesser di Unsplash"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-3 right-3 text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded backdrop-blur-sm">
                  Data Analytics
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Dashboard Analitik Real-Time</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Metrik agregat peran ganda (Supplier, QC Reviewer, Manager, Admin) dengan visualisasi tren 6 bulan dan export spreadsheet.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  ✓ Laporan Ekspor Excel &amp; PDF
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-cyan-400">Alur Kerja Standar</h2>
          <p className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Empat Langkah Mudah Menuju Transparansi Data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((step, idx) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-6 backdrop-blur-md shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-mono font-bold text-sm mb-4">
                0{idx + 1}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-20 sm:py-24 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-cyan-400">Pertanyaan Umum</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Pertanyaan Seputar Platform</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-cyan-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="ml-4 flex-shrink-0 text-slate-400">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 px-4 sm:px-5 py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50/50 dark:bg-slate-950/40">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-gradient-to-r from-brand-600/15 via-cyan-600/15 to-indigo-600/15 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-2xl">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Siap Mengoptimalkan Pengelolaan Data Armada Anda?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Daftar akun sekarang untuk kemudahan validasi, pelacakan histori serial number, dan integrasi data ban terpercaya.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register">
              <Button className="min-h-12 bg-gradient-to-r from-brand-600 via-cyan-600 to-indigo-600 px-8 text-sm sm:text-base font-semibold text-white shadow-xl shadow-brand-500/25 hover:from-brand-500 hover:to-cyan-500">
                Buat Akun Sekarang
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="min-h-12 px-8 text-sm sm:text-base font-semibold">
                Masuk ke Akun
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer & Image Credits */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-cyan-500 text-white font-bold text-xs">
                  C26
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Commercial 2026</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sistem Informasi Pengolahan Data Ban Bus &amp; Truk Komersial dengan standar integritas dan audit enterprise.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Modul Utama</h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li><Link to="/inspections" className="hover:text-brand-600 dark:hover:text-cyan-400">Pengajuan Inspeksi</Link></li>
                <li><Link to="/qc" className="hover:text-brand-600 dark:hover:text-cyan-400">Quality Control</Link></li>
                <li><Link to="/reports" className="hover:text-brand-600 dark:hover:text-cyan-400">Laporan &amp; Analisis</Link></li>
                <li><Link to="/master-data" className="hover:text-brand-600 dark:hover:text-cyan-400">Master Data Wilayah &amp; Ban</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Keamanan &amp; Standar</h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>Enkripsi TLS 1.3 &amp; Argon2id</li>
                <li>Autentikasi Dua Faktor (TOTP)</li>
                <li>Jejak Audit Append-Only</li>
                <li>Offline Sync Service Worker</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Akses Cepat</h3>
              <div className="flex flex-col gap-2">
                <Link to="/login" className="text-xs text-brand-600 dark:text-cyan-400 hover:underline">
                  Portal Masuk Petugas →
                </Link>
                <Link to="/register" className="text-xs text-slate-600 dark:text-slate-400 hover:underline">
                  Registrasi Supplier Baru →
                </Link>
              </div>
            </div>
          </div>

          {/* Photo Credit Section (Explicit Attribution for Free Stock Photos) */}
          <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-6 pb-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Kredit &amp; Atribusi Foto Bebas Royalti (Unsplash):</span>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span>
                  • Truk Komersial: Foto oleh{" "}
                  <a href="https://unsplash.com/@marcinjozwiak" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-600 dark:hover:text-cyan-400">
                    Marcin Jozwiak
                  </a>{" "}
                  di Unsplash
                </span>
                <span>
                  • Armada Bus: Foto oleh{" "}
                  <a href="https://unsplash.com/@rozetsky" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-600 dark:hover:text-cyan-400">
                    Ant Rozetsky
                  </a>{" "}
                  di Unsplash
                </span>
                <span>
                  • Roda &amp; Ban: Foto oleh{" "}
                  <a href="https://unsplash.com/@chuttersnap" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-600 dark:hover:text-cyan-400">
                    Chuttersnap
                  </a>{" "}
                  di Unsplash
                </span>
                <span>
                  • Analitik Data: Foto oleh{" "}
                  <a href="https://unsplash.com/@lukethewebguy" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-600 dark:hover:text-cyan-400">
                    Luke Chesser
                  </a>{" "}
                  di Unsplash
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
            Commercial 2026 &copy; Sistem Informasi Pengolahan Data Ban Bus &amp; Truk. Hak cipta dilindungi undang-undang.
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: "Axle Mapping & Posisi Ban",
    description: "Konfigurasi cerdas tata letak poros roda (steer, drive, trailer) untuk kendaraan TB dan LT dengan penomoran posisi otomatis.",
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: "Quality Control (QC) Gate",
    description: "Alur peninjauan foto fisik independen dengan keputusan Pass, Drop, atau Revisi sebelum spesifikasi ban dapat diisi.",
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
        <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
        <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
        <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
      </svg>
    ),
    title: "Master Data Pattern & Ukuran",
    description: "Katalog lebih dari 1.500 pola ban dan puluhan ukuran standar yang tersinkronisasi untuk menghindari inkonsistensi pengetikan.",
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Audit Trail Append-Only",
    description: "Setiap perubahan data dicatat permanen dalam transaksi database yang sama, lengkap dengan aktor, timestamp, dan diff data.",
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    title: "Analitik & Ekspor Laporan",
    description: "Visualisasi metrik operasional harian dan bulanan dengan fitur ekspor data spreadsheet untuk kebutuhan audit dan reporting.",
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Segregasi Wilayah & Peran",
    description: "Pemisahan data berdasarkan wilayah penugasan (provinsi/kota) dan peran pengguna (Supplier, Operator, QC, Manager, Admin).",
  },
];

const workflowSteps = [
  {
    title: "Input Nomor Polisi & Poros",
    description: "Masukkan identitas armada komersial dan tentukan jumlah serta jenis poros (single/double mounting).",
  },
  {
    title: "Unggah Bukti Foto Fisik",
    description: "Ambil dan unggah foto tampak kendaraan serta setiap posisi ban dengan kompresi otomatis.",
  },
  {
    title: "Verifikasi Quality Control",
    description: "Tim QC memeriksa kelayakan foto bukti dan memberikan catatan teknis jika perlu perbaikan.",
  },
  {
    title: "Spesifikasi & Analisis",
    description: "Lengkapi data merk, pattern, ukuran, dan kedalaman alur untuk menghasilkan laporan analitik performa.",
  },
];

const faqs = [
  {
    q: "Apa perbedaan kategori kendaraan TB dan LT di sistem ini?",
    a: "TB merujuk pada Truck & Bus (kendaraan angkutan berat), sedangkan LT merujuk pada Light Truck (truk ringan komersial). Konfigurasi pola pattern dan ukuran ban dikelompokkan secara terpisah untuk kedua kategori ini.",
  },
  {
    q: "Apakah aplikasi dapat digunakan secara offline di bengkel atau garasi?",
    a: "Ya. Aplikasi dilengkapi Service Worker dan antrean upload lokal (offline-first queue), sehingga pengisian data dan foto tetap dapat dilakukan saat koneksi internet tidak stabil.",
  },
  {
    q: "Bagaimana cara mendapatkan akun untuk inspektur atau supplier?",
    a: "Anda dapat mendaftar melalui halaman Registrasi. Akun baru akan diverifikasi oleh administrator sistem dan diberikan penugasan wilayah operasional sebelum mulai melakukan input pengajuan.",
  },
  {
    q: "Bagaimana sistem menjamin keaslian data hasil inspeksi?",
    a: "Sistem menerapkan audit trail append-only pada tingkat database PostgreSQL, hash SHA-256 untuk setiap file foto yang diunggah, serta kontrol akses berbasis peran (RBAC) yang ketat.",
  },
];
