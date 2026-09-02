import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TREAD_IMAGE } from "./image-credits.ts";

/**
 * The hero — the one place on this page allowed to be bold.
 *
 * Everything after it is deliberately quiet. A page where every section
 * competes has no hierarchy at all, so the boldness is spent here and nowhere
 * else (brief §14).
 *
 * The right column is a composed visual, not a photograph in a rounded box. The
 * tread runs full-bleed off the right edge of the viewport and the grooves are
 * cropped so they leave the frame diagonally; three technical callouts are
 * anchored to points on it with thin leader lines and monospace labels. The
 * reference is an engineering drawing, which is what these users actually read,
 * rather than the tooltip vocabulary of a marketing site.
 */

interface Callout {
  /** Vertical anchor, as a Tailwind class — a computed `top` would need an
   *  inline style, which the CSP forbids. */
  anchor: string;
  value: string;
  label: string;
}

const CALLOUTS: readonly Callout[] = [
  { anchor: "top-[26%]", value: "8,4 mm", label: "Kedalaman tapak" },
  { anchor: "top-[47%]", value: "120 psi", label: "Tekanan angin" },
  { anchor: "top-[68%]", value: "14 bln", label: "Umur pakai" },
];

const PLAYED_KEY = "c26_hero_played";

export function LandingHero(): ReactNode {
  /*
   * The sequence runs once per session. Coming back from a login attempt, or
   * from the browser's back button, should not replay a 1.2-second
   * performance — by the third time it is an obstacle between the reader and
   * the page.
   *
   * It starts as `false` so that the very first paint is the finished state.
   * The animation is then switched on in an effect, which also means a reader
   * whose JavaScript never runs sees a complete hero rather than an empty one.
   */
  const [play, setPlay] = useState(false);

  useEffect(() => {
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem(PLAYED_KEY) === "1";
    } catch {
      // Private mode, or storage disabled. Treat it as already played: a
      // missing animation is a smaller problem than a thrown exception.
      alreadyPlayed = true;
    }

    if (alreadyPlayed) return;

    setPlay(true);
    try {
      window.sessionStorage.setItem(PLAYED_KEY, "1");
    } catch {
      // Nothing to do. It will simply play again next time.
    }
  }, []);

  return (
    <section className={`relative bg-canvas ${play ? "hero--play" : ""}`}>
      {/*
        The text sits in the normal container so its left edge lines up with
        every section below it. The image is taken out of flow on desktop and
        pinned to the right edge of the viewport — a photograph that stops
        politely at a margin has been turned back into an illustration, and the
        crop running off the edge is the whole point of the composition.

        A negative margin cannot do this: percentage margins resolve against the
        containing block, not the viewport, so it silently produced a normal
        box.
      */}
      <div className="mx-auto max-w-site px-5 pb-10 pt-14 sm:px-8 lg:pb-24 lg:pt-24">
        <div className="hero-settle max-w-prose lg:w-[52%] lg:max-w-none lg:pr-8">
          <p className="text-sm text-subtle">Manajemen ban armada</p>

          <h1 className="mt-4 font-display text-2xl font-bold leading-[1.08] tracking-tight text-body sm:text-3xl">
            Setiap ban punya riwayat.
            <br />
            Pastikan Anda bisa melacaknya.
          </h1>

          <p className="mt-5 max-w-prose text-base text-muted">
            Pendataan ban bus dan truk dengan satu nomor seri per pemeriksaan, foto untuk
            setiap posisi ban, dan riwayat keputusan yang tidak bisa dihapus siapa pun.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base bg-accent px-6 text-sm font-semibold text-on-accent transition-colors duration-180 ease-precision hover:bg-accent-hover active:translate-y-px"
            >
              Mulai Menggunakan
            </Link>
            <a
              href="#alur"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-base border border-line-strong px-6 text-sm font-semibold text-body transition-colors duration-180 ease-precision hover:border-accent hover:text-accent-text active:translate-y-px"
            >
              Pelajari Selengkapnya
            </a>
          </div>
        </div>

      </div>

      {/* On mobile it follows the text at a fixed ratio; on desktop it is
          pinned to the right half of the viewport, full height. */}
      <div className="relative mx-5 aspect-[4/3] overflow-hidden rounded-panel bg-graphite sm:mx-8 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:aspect-auto lg:w-[45%] lg:rounded-l-panel lg:rounded-r-none">
          <img
            src={TREAD_IMAGE.src}
            alt={TREAD_IMAGE.alt}
            width={1600}
            height={1200}
            fetchPriority="high"
            className="hero-photo absolute inset-0 h-full w-full scale-[1.35] rotate-[8deg] object-cover"
          />

          {/* A measurement rule sweeping across the image, once. */}
          <div
            aria-hidden="true"
            className="hero-sweep pointer-events-none absolute inset-y-0 left-0 w-px bg-amber/70"
          />

          {CALLOUTS.map((callout, index) => (
            <div
              key={callout.label}
              tabIndex={0}
              className={`hero-callout hero-callout-${String(index + 1)} absolute left-0 flex items-center gap-0 outline-none ${callout.anchor}`}
            >
              <span
                aria-hidden="true"
                className="hero-leader h-px w-10 bg-paper/50 sm:w-16"
              />
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-none rounded-full border border-paper/70"
              />
              <span className="hero-callout-label ml-2.5 whitespace-nowrap font-data text-xs leading-tight text-paper">
                <span className="block font-medium">{callout.value}</span>
                <span className="block text-[0.6875rem] text-paper/70">{callout.label}</span>
              </span>
            </div>
          ))}

          {/*
            One fragment of the real interface, overlapping the image edge. It
            ties the photograph to the product — without it the hero is a stock
            tire and a paragraph, which describes any tire company at all.
          */}
          <div className="absolute bottom-4 right-4 rounded-base border border-paper/15 bg-graphite/85 px-3.5 py-2.5 backdrop-blur-sm sm:bottom-6 sm:right-6">
            <p className="font-data text-[0.6875rem] uppercase tracking-wide text-paper/60">
              SN2026-00148
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs font-medium text-paper">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal-ok" />
              Pass QC
            </p>
          </div>
      </div>

      {/* Restores the section's height on desktop, where the image is out of
          flow and would otherwise contribute nothing. */}
      <div aria-hidden="true" className="hidden lg:block lg:h-[34rem]" />
    </section>
  );
}
