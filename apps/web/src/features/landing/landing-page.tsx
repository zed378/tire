import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { USER_ROLE_LABELS } from "@c26/contracts";
import { useSession } from "../../lib/session.tsx";
import { HERO_IMAGE, IMAGE_CREDITS, TREAD_IMAGE, WHEEL_IMAGE } from "./image-credits.ts";

/**
 * The public page.
 *
 * Committed to a dark treatment rather than following the viewer's theme: it is
 * one marketing surface, and the reference the owner chose is dark throughout.
 * The application behind the login stays theme-aware, so the raw palette
 * classes in this file are the documented exception to the token rule — they
 * describe one fixed design, not a theme. There is no theme switch here for the
 * same reason: it would offer a choice the page does not honour.
 *
 * TWO THINGS FROM THE REFERENCE ARE DELIBERATELY ABSENT. It opens with a
 * "SOC 2 TYPE II CERTIFIED" chip and closes its hero with a row of client logos
 * — Vercel, Cursor, Coinbase. Both are claims. This system holds no such
 * certification and has no such customers, and either one would be a lie told
 * in a confident typeface. The chips carry properties the system actually has,
 * and the row beneath carries figures that are true.
 */
export function LandingPage(): ReactNode {
  return (
    <div className="min-h-dvh bg-canvas text-body">
      <SiteHeader />
      <main>
        <Hero />
        <Numbers />
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
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5 sm:px-8">
        <Link to="/" className="text-sm font-semibold tracking-tight text-body">
          Commercial 2026
        </Link>

        <nav aria-label="Navigasi halaman" className="hidden flex-1 justify-center gap-7 md:flex">
          <a href="#masalah" className="text-sm text-muted transition-colors hover:text-body">
            Latar belakang
          </a>
          <a href="#alur" className="text-sm text-muted transition-colors hover:text-body">
            Alur kerja
          </a>
          <a href="#batasan" className="text-sm text-muted transition-colors hover:text-body">
            Batasan
          </a>
        </nav>

        {/*
          Somebody already signed in does not need to be asked to sign in. This
          sends them straight on instead, which is the one thing they came for.
        */}
        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          {user !== null ? (
            <>
              <span className="hidden text-right text-xs leading-tight text-muted sm:block">
                <span className="block font-medium text-body">{user.displayName}</span>
                {USER_ROLE_LABELS[user.role]}
              </span>
              <Link
                to="/welcome"
                className="inline-flex min-h-9 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Buka Beranda
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-muted transition-colors hover:text-body"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-9 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero(): ReactNode {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-blue-800">
      {/* The tread photograph at very low opacity, giving the gradient a grain
          rather than reading as a picture. */}
      <img
        src={TREAD_IMAGE.src}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.07] mix-blend-luminosity"
        loading="lazy"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-white/20 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-300">
              Audit append-only
            </span>
            <span className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              34 konfigurasi poros
            </span>
          </div>

          {/* Two-tone headline, as in the reference: the setup recedes, the
              claim lands. */}
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block text-slate-400">Ketahuan sebelum</span>
            <span className="block text-white">jadi masalah.</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">
            Data ban bus dan truk yang bisa dipertanggungjawabkan sampai ke posisi bannya. Nomor
            seri per pemeriksaan, foto per posisi ban, dan riwayat keputusan QC yang tidak bisa
            dihapus siapa pun.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* Split button, following the reference. The arrow half is marked
                decorative and taken out of the tab order — it goes exactly where
                the label beside it already goes, and a keyboard user should not
                have to pass the same destination twice. */}
            <div className="flex overflow-hidden rounded-md">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Masuk ke sistem
              </Link>
              <span
                aria-hidden="true"
                className="inline-flex min-h-11 w-11 items-center justify-center border-l border-white/20 bg-blue-600 text-white"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>

            <Link
              to="/register"
              className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              Daftar akun
            </Link>
          </div>
        </div>

        <figure className="relative">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <img
              src={WHEEL_IMAGE.src}
              alt={WHEEL_IMAGE.alt}
              width={1000}
              height={666}
              loading="eager"
              fetchPriority="high"
              className="w-full object-cover"
            />
          </div>

          {/* One real record, floating over the image. */}
          <div className="absolute -bottom-4 left-4 rounded-xl border border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur">
            <p className="font-mono text-xs text-slate-400">SN2026-00001</p>
            <p className="mt-0.5 text-sm font-medium text-white">Drive 1 Kiri Dalam · Pass QC</p>
          </div>
        </figure>
      </div>
    </section>
  );
}

/**
 * The reference puts a row of client logos here. There are no clients to name,
 * so this row carries limits the system actually enforces instead.
 */
const NUMBERS: { value: string; label: string }[] = [
  { value: "34", label: "Konfigurasi poros yang sah" },
  { value: "22", label: "Ban maksimum per kendaraan" },
  { value: "30", label: "Foto maksimum per pemeriksaan" },
  { value: "24", label: "Bulan masa simpan data" },
];

function Numbers(): ReactNode {
  return (
    <section className="border-b border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">
          Aturan yang ditegakkan sistem
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {NUMBERS.map((item) => (
            <div key={item.label}>
              <dt className="sr-only">{item.label}</dt>
              <dd>
                <span className="block text-3xl font-semibold tabular-nums text-body">
                  {item.value}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {item.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const PROBLEMS: { before: string; after: string }[] = [
  {
    before: "Rincian poros bisa berjumlah 3 sementara Jumlah Poros dipilih 6, dan tetap tersimpan.",
    after:
      "Ditolak dengan menyebut angkanya: “Rincian poros berjumlah 3, sedangkan Jumlah Poros yang dipilih adalah 6.”",
  },
  {
    before: "Supplier mengirim data lalu tidak tahu apa-apa. Hasil QC dikejar lewat WhatsApp.",
    after: "Daftar pengajuan dengan status dan alasan revisi menempel di barisnya, plus notifikasi.",
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
    <section id="masalah" className="border-b border-line bg-canvas">
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
              <p className="text-sm leading-relaxed text-subtle line-through decoration-danger/60">
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
    <section id="alur" className="border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-body sm:text-3xl">
            Empat langkah, dari plat nomor sampai keputusan
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Alurnya sama untuk truk dan bus, TB maupun LT. Yang berbeda hanya jumlah ban — dan itu
            dihitung, bukan diketik.
          </p>

          <figure className="mt-8 overflow-hidden rounded-xl border border-line">
            <img
              src={HERO_IMAGE.src}
              alt={HERO_IMAGE.alt}
              width={1280}
              height={960}
              loading="lazy"
              className="w-full object-cover"
            />
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
    <section id="batasan" className="border-b border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
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
    <section className="bg-gradient-to-b from-canvas to-blue-900">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {user !== null ? `Masuk sebagai ${user.displayName}` : "Sudah punya akun?"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              {user !== null
                ? "Lanjutkan ke beranda peran Anda."
                : "Masuk dengan User ID dan kata sandi Anda. Admin dan operator akan diminta mendaftarkan 2FA pada login pertama."}
            </p>
          </div>
          <Link
            to={user !== null ? "/welcome" : "/login"}
            className="inline-flex min-h-11 flex-none items-center rounded-md bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
          >
            {user !== null ? "Buka Beranda" : "Masuk ke sistem"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter(): ReactNode {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-body">Commercial 2026</p>
            <p className="mt-1 text-xs text-muted">Sistem Data Ban Bus &amp; Truk</p>
          </div>
          <nav aria-label="Tautan kaki halaman" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/login" className="text-muted transition-colors hover:text-body">
              Masuk
            </Link>
            <Link to="/register" className="text-muted transition-colors hover:text-body">
              Daftar
            </Link>
          </nav>
        </div>

        {/*
          Required by the licences, not a nicety. CC BY and CC BY-SA both oblige
          us to name the author, state the licence, and link back to the source.
        */}
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
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
