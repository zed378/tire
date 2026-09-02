import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { USER_ROLE_LABELS } from "@c26/contracts";
import { useSession } from "../../lib/session.tsx";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";
import { HERO_IMAGE, IMAGE_CREDITS, TREAD_IMAGE, WHEEL_IMAGE } from "./image-credits.ts";

/**
 * The public page.
 *
 * WHAT IT DELIBERATELY IS NOT: the previous version opened with a pulsing
 * "SYSTEM ONLINE" badge over a cyber grid, three floating blurred orbs,
 * seventeen `backdrop-blur` surfaces and a heading called "Fitur Terdepan". It
 * could have been selling anything. This one says what the system does, in the
 * words the people who use it already use — Pengajuan, Pass QC, Perlu Revisi —
 * and shows a bus from Probolinggo rather than an abstract gradient.
 *
 * The concrete details are load-bearing, not decoration. `SN2026-00001` is the
 * real serial format (K-05). `Drive 1 Kiri Dalam` is a real tire position, named
 * exactly as the engine names it (K-02). Somebody who has done this job should
 * recognise their own work here; that recognition is the whole argument.
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2 group">
          <span className="text-base font-bold tracking-tight text-body group-hover:text-accent-text transition-colors">
            Commercial 2026
          </span>
          <span className="hidden text-xs text-subtle sm:inline">Data Ban Bus &amp; Truk</span>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />

          {user !== null ? (
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Desktop user identity info */}
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-body leading-tight">{user.displayName}</p>
                <p className="text-[11px] text-muted leading-tight">{USER_ROLE_LABELS[user.role]}</p>
              </div>

              {/* Mobile compact user chip */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text sm:hidden truncate max-w-[110px]">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
                <span className="truncate">{user.displayName}</span>
              </span>

              {/* Direct Link to Dashboard */}
              <Link
                to="/welcome"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 sm:px-4 text-xs sm:text-sm font-medium text-on-accent transition-all hover:bg-accent-hover shadow-sm active:scale-[0.98]"
              >
                <span>Dashboard</span>
                <svg
                  width="14"
                  height="14"
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/register"
                className="hidden sm:inline-flex h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3.5 text-xs sm:text-sm font-medium text-body transition-colors hover:bg-surface-sunken"
              >
                Daftar
              </Link>
              <Link
                to="/login"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-xs sm:text-sm font-medium text-on-accent transition-all hover:bg-accent-hover shadow-sm active:scale-[0.98]"
              >
                Masuk
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
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
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
            // The one image above the fold, so it is not lazy and it is decoded
            // eagerly. Everything below is deferred.
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
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
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
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
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
              className="w-full rounded-xl border border-line object-cover"
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

      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
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
              className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-muted"
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
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
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
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
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

        {/*
          Required by the licences, not a nicety. CC BY and CC BY-SA both oblige
          us to name the author, state the licence, and link back to the source.
        */}
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
