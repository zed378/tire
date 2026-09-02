import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { USER_ROLE_LABELS } from "@c26/contracts";
import { useSession } from "../../lib/session.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";
import { HERO_IMAGE, IMAGE_CREDITS, TREAD_IMAGE, WHEEL_IMAGE } from "./image-credits.ts";

/**
 * The public page.
 *
 * What the system does, in the words the people who use it already use —
 * Pengajuan, Pass QC, Perlu Revisi — and shows real fleet imagery.
 */
export function LandingPage(): ReactNode {
  return (
    <div className="min-h-dvh bg-canvas text-body">
      <SiteHeader />
      <main>
        <Hero />
        <TheProblem />
        <HowItWorks />
        <WhatItRefuses />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader(): ReactNode {
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent shadow-sm transition-transform group-hover:scale-105">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm sm:text-base font-bold tracking-tight text-body group-hover:text-accent-text transition-colors">
              Commercial 2026
            </span>
            <span className="hidden text-xs text-muted sm:inline border-l border-line pl-2">
              Data Ban Bus &amp; Truk
            </span>
          </div>
        </Link>

        {/* Right Actions & Auth State */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {user !== null ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* User Identity Chip */}
              <div className="hidden sm:flex items-center gap-2 h-9 px-2.5 rounded-lg border border-line bg-surface-sunken/70 text-left">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-on-accent font-bold text-[11px]">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col pr-1">
                  <span className="text-xs font-semibold text-body leading-tight truncate max-w-[130px]">
                    {user.displayName}
                  </span>
                  <span className="text-[10px] text-muted leading-tight">
                    {USER_ROLE_LABELS[user.role]}
                  </span>
                </div>
              </div>

              {/* Direct Dashboard Action */}
              <Link
                to="/welcome"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 sm:px-4 text-xs sm:text-sm font-medium text-on-accent shadow-sm transition-all hover:bg-accent-hover active:scale-[0.98]"
              >
                <span>Dashboard</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/register"
                className="hidden sm:inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3.5 text-xs sm:text-sm font-medium text-body transition-colors hover:bg-surface-sunken"
              >
                Daftar
              </Link>
              <Link
                to="/login"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs sm:text-sm font-medium text-on-accent shadow-sm transition-all hover:bg-accent-hover active:scale-[0.98]"
              >
                <span>Masuk</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero(): ReactNode {
  const { user } = useSession();

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 pt-10 sm:pb-24 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <p className="text-sm font-medium text-accent-text">
            Untuk supplier data, admin QC, dan PM di lapangan
          </p>

          <h1 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight text-body sm:text-4xl lg:text-5xl">
            Data ban yang bisa dipertanggungjawabkan, sampai ke posisi bannya.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            Setiap pemeriksaan punya nomor seri, foto per posisi ban, dan riwayat keputusan QC
            yang tidak bisa dihapus. Petugas mengisi dari HP di garasi — termasuk saat sinyal
            hilang — dan fotonya menyusul begitu ada jaringan.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {user !== null ? (
              <Link
                to="/welcome"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover shadow-sm"
              >
                <span>Buka Dashboard ({user.displayName})</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover shadow-sm"
                >
                  Masuk ke sistem
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-surface px-5 text-sm font-medium text-body transition-colors hover:bg-surface-sunken"
                >
                  Daftar akun
                </Link>
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-subtle">
            Akun dibuat oleh admin. Pendaftaran mandiri menunggu persetujuan sebelum aktif.
          </p>
        </div>

        <figure className="lg:justify-self-end">
          <img
            src={HERO_IMAGE.src}
            alt={HERO_IMAGE.alt}
            width={1280}
            height={960}
            loading="eager"
            fetchPriority="high"
            className="w-full rounded-xl border border-line object-cover shadow-sm"
          />
          <figcaption className="mt-2 text-xs text-subtle">
            Bus AKDP di Probolinggo, Jawa Timur — jenis armada yang datanya dicatat sistem ini.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/**
 * The reason the rewrite exists, said plainly.
 *
 * These are the real defects from the legacy system (PLAN/00 §2.2), not
 * invented pain points — which is why they are specific enough to be
 * uncomfortable.
 */
const PROBLEMS: { before: string; after: string }[] = [
  {
    before: "Rincian poros bisa berjumlah 3 sementara Jumlah Poros dipilih 6, dan tetap tersimpan.",
    after:
      "Ditolak dengan menyebut angkanya: “Rincian poros berjumlah 3, sedangkan Jumlah Poros yang dipilih adalah 6.”",
  },
  {
    before: "Supplier mengirim data lalu tidak tahu apa-apa. Hasil QC dikejar lewat WhatsApp.",
    after:
      "Daftar pengajuan dengan status dan alasan revisi menempel di barisnya, plus notifikasi.",
  },
  {
    before: "Filter tanggal dan status di layar QC tidak mengubah hasil sama sekali.",
    after: "Filter berjalan di server dan hasilnya benar-benar berubah.",
  },
  {
    before: "Tiga tombol di halaman login yang bisa masuk sebagai Supplier, Admin, atau PM/SPV.",
    after: "Tidak ada. Setiap akun punya kata sandi, dan admin wajib mendaftarkan 2FA.",
  },
];

function TheProblem(): ReactNode {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-body sm:text-3xl">
            Dibangun dari daftar hal yang dulu rusak
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Sistem sebelumnya berjalan di atas spreadsheet dan formulir. Ia bekerja, sampai
            volumenya naik. Empat di antaranya yang paling sering menggigit:
          </p>
        </div>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {PROBLEMS.map((item) => (
            <li key={item.before} className="bg-surface p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-muted line-through decoration-danger/60">
                {item.before}
              </p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-body">{item.after}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "Cari platnya dulu",
    body: "Kalau kendaraannya sudah pernah diperiksa, datanya muncul untuk dikonfirmasi — bukan diketik ulang. Kalau belum, isi identitas dan konfigurasi porosnya.",
  },
  {
    title: "Slot foto dibuat otomatis",
    body: "Dari konfigurasi poros, sistem menghitung jumlah ban dan menamai setiap posisinya: Steer 1 Kanan, Drive 1 Kiri Dalam, dan seterusnya. Tidak ada slot yang terlewat karena tidak ada yang manual.",
  },
  {
    title: "Foto menunggu sinyal, bukan hilang",
    body: "Foto dikompres di perangkat lalu masuk antrean lokal. Pengiriman ditahan sampai semuanya terunggah — layar menyebut angkanya, misalnya “3 dari 6 foto menunggu sinyal.”",
  },
  {
    title: "QC memutuskan, dan keputusannya tercatat",
    body: "Pass, Perlu Revisi, atau Drop. Revisi dan Drop wajib disertai alasan, dan setiap perubahan status menulis satu baris audit yang tidak bisa diubah siapa pun.",
  },
];

function HowItWorks(): ReactNode {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-body sm:text-3xl">
            Empat langkah, dari plat nomor sampai keputusan
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Alurnya sama untuk truk dan bus, TB maupun LT. Yang berbeda hanya jumlah ban — dan
            itu dihitung, bukan diketik.
          </p>

          <figure className="mt-8">
            <img
              src={WHEEL_IMAGE.src}
              alt={WHEEL_IMAGE.alt}
              width={1000}
              height={666}
              loading="lazy"
              className="w-full rounded-xl border border-line object-cover shadow-sm"
            />
            <figcaption className="mt-2 text-xs text-subtle">
              Satu posisi ban, satu slot foto, satu kartu spesifikasi.
            </figcaption>
          </figure>
        </div>

        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line-strong text-sm font-semibold text-accent-text"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-body">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const REFUSALS: string[] = [
  "Menyimpan konfigurasi poros yang jumlahnya tidak cocok.",
  "Mengirim pengajuan sebelum seluruh fotonya terunggah.",
  "Menghapus baris audit — tabelnya append-only, dan izin hapusnya dicabut di level basis data.",
  "Mengubah status pengajuan lewat jalur lain selain transisi resmi.",
  "Menghapus data bisnis secara permanen. Yang ada hanya penandaan terhapus.",
];

function WhatItRefuses(): ReactNode {
  return (
    <section className="relative border-y border-line">
      {/* Texture, not illustration: it sits behind the text at low opacity and
          carries no information, so it is marked decorative for screen readers. */}
      <img
        src={TREAD_IMAGE.src}
        alt=""
        aria-hidden="true"
        width={1000}
        height={714}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-[0.06]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-body sm:text-3xl">
          Hal-hal yang sistem ini tolak lakukan
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Aturan yang bisa ditegakkan basis data, ditegakkan basis data — bukan diserahkan pada
          kedisiplinan pengisi formulir.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REFUSALS.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-muted shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClosingCta(): ReactNode {
  const { user } = useSession();

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-body">
            {user !== null ? `Masuk sebagai ${user.displayName}` : "Sudah punya akun?"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {user !== null
              ? `Anda saat ini terotentikasi sebagai ${USER_ROLE_LABELS[user.role]}. Klik tombol di sebelah kanan untuk melanjutkan pekerjaan Anda di dashboard.`
              : "Masuk dengan User ID dan kata sandi Anda. Admin dan operator akan diminta mendaftarkan 2FA pada login pertama."}
          </p>
        </div>
        {user !== null ? (
          <Link
            to="/welcome"
            className="inline-flex min-h-11 flex-none items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover shadow-sm"
          >
            <span>Buka Dashboard</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ) : (
          <Link
            to="/login"
            className="inline-flex min-h-11 flex-none items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover shadow-sm"
          >
            Masuk ke sistem
          </Link>
        )}
      </div>
    </section>
  );
}

function SiteFooter(): ReactNode {
  const { user } = useSession();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-body">Commercial 2026</p>
            <p className="mt-1 text-xs text-muted">Sistem Data Ban Bus &amp; Truk</p>
          </div>
          <nav aria-label="Tautan kaki halaman" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {user !== null ? (
              <Link to="/welcome" className="text-muted hover:text-body">
                Dashboard ({user.displayName})
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-muted hover:text-body">
                  Masuk
                </Link>
                <Link to="/register" className="text-muted hover:text-body">
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Kredit foto
          </h2>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
            {IMAGE_CREDITS.map((credit) => (
              <li key={credit.src}>
                <span className="text-body">{credit.alt}</span> — {credit.author},{" "}
                {credit.licenseUrl === "" ? (
                  <span>{credit.license}</span>
                ) : (
                  <a
                    href={credit.licenseUrl}
                    rel="license noopener noreferrer"
                    target="_blank"
                    className="underline underline-offset-2 hover:text-body"
                  >
                    {credit.license}
                  </a>
                )}
                , via{" "}
                <a
                  href={credit.sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-body"
                >
                  Wikimedia Commons
                </a>
                .
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
