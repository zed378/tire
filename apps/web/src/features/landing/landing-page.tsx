import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";

export function LandingPage(): ReactNode {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600" />
              <span className="text-xl font-bold text-white">Commercial 2026</span>
            </div>
            <div className="flex gap-4">
              <Link to="/login">
                <Button variant="secondary" className="text-slate-300 hover:text-white border-slate-700 bg-slate-800">
                  Masuk
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-blue-600 hover:bg-blue-700">Daftar</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Sistem Informasi Pengolahan Data Ban
          </h1>
          <p className="mt-6 text-xl text-slate-300">
            Platform terintegrasi untuk pengelolaan inspeksi ban bus dan truk dengan transparansi penuh
            dan audit trail yang komprehensif.
          </p>
          <div className="mt-10 flex gap-4 justify-center">
            <Link to="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-base min-h-12">
                Mulai Sekarang
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="text-white border-slate-600 bg-slate-800 hover:bg-slate-700 px-8 py-3 text-base min-h-12">
                Masuk ke Akun
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-slate-700 bg-slate-800/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-white mb-16">Fitur Utama</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 hover:border-slate-600 transition">
                <div className="mb-4 inline-block rounded-lg bg-blue-600/20 p-3">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">Mengapa Memilih Platform Kami?</h2>
            <ul className="space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 items-start">
                  <span className="text-blue-400 font-bold mt-1">✓</span>
                  <span className="text-slate-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-slate-700 rounded-lg p-12 aspect-square flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-slate-300">Dashboard analitik real-time untuk semua pengguna</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-slate-700 bg-slate-800/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-white mb-16">Bagaimana Cara Kerjanya?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="rounded-full bg-blue-600 w-12 h-12 flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto">
                  {idx + 1}
                </div>
                <h3 className="font-semibold text-white text-center mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm text-center">{step.description}</p>
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-8 h-px bg-slate-700" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-700 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Siap untuk Memulai?</h2>
          <p className="text-slate-300 mb-8 text-lg">Daftar hari ini dan mulai mengelola data inspeksi Anda dengan lebih efisien.</p>
          <Link to="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-base min-h-12">
              Buat Akun Gratis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">Tentang</h3>
              <p className="text-slate-400 text-sm">Platform terintegrasi untuk pengelolaan inspeksi kendaraan komersial.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Produk</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition">Dashboard</a></li>
                <li><a href="#" className="hover:text-white transition">Inspeksi</a></li>
                <li><a href="#" className="hover:text-white transition">Laporan</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Dukungan</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition">Dokumentasi</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
                <li><a href="#" className="hover:text-white transition">Hubungi Kami</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition">Privasi</a></li>
                <li><a href="#" className="hover:text-white transition">Syarat & Ketentuan</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2026 Commercial 2026. Semua hak cipta dilindungi.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: "📋",
    title: "Manajemen Inspeksi",
    description: "Kelola data pengajuan inspeksi ban dengan mudah dan terorganisir.",
  },
  {
    icon: "✅",
    title: "QC Review",
    description: "Proses QC yang terintegrasi dengan workflow yang jelas dan terukur.",
  },
  {
    icon: "📊",
    title: "Laporan Analitik",
    description: "Dashboard dan laporan komprehensif untuk analisis data bisnis.",
  },
  {
    icon: "🔒",
    title: "Keamanan Tingkat Enterprise",
    description: "Enkripsi, audit trail, dan role-based access control untuk perlindungan maksimal.",
  },
];

const benefits = [
  "Transparansi penuh dengan jejak audit yang komprehensif",
  "Manajemen pengguna dengan role-based access control",
  "Dashboard real-time untuk monitoring performa",
  "Export laporan dalam berbagai format",
  "Notifikasi real-time untuk setiap perubahan status",
  "Support untuk multi-region dan penugasan wilayah",
  "Mobile-friendly dan PWA-ready untuk akses dari mana saja",
];

const steps = [
  {
    title: "Daftar Akun",
    description: "Buat akun baru dengan informasi dasar Anda.",
  },
  {
    title: "Verifikasi Email",
    description: "Admin akan mengaktifkan akun dan memberikan peran yang sesuai.",
  },
  {
    title: "Setup & Login",
    description: "Login ke dashboard dengan kredensial Anda.",
  },
  {
    title: "Mulai Inspeksi",
    description: "Mulai mengelola inspeksi kendaraan Anda.",
  },
];
