import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.ts";
import { ThemeToggle } from "../../components/ui/theme-toggle.tsx";
import { Photo } from "../../components/ui/photo.tsx";
import { PHOTO_CREDITS, type PhotoCredit } from "../../lib/photo-credits.ts";
import type { PhotoName } from "../../lib/photo-manifest.ts";
import "./auth.css";

/**
 * The frame shared by the sign-in and registration screens.
 *
 * An asymmetric 5/7 split, edge to edge: a photograph down the left, the form
 * on the right. Not a centred card, and not an even split screen — both of
 * those are the layout a framework gives you when nobody decided anything, and
 * a reader recognises that even without being able to name it (brief §27).
 *
 * The form sits slightly above true vertical centre. Perfect centring reads as
 * a default; a few percent of optical offset reads as typeset. It is a small
 * thing that costs one class.
 *
 * Typography, spacing, buttons, accent and motion are the landing page's. There
 * is no second set of styles here — that is the point of the shared layout.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  photo,
  note,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  photo: PhotoName;
  /** One short factual line over the photograph. Never a testimonial. */
  note: string;
}): ReactNode {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-12">
      {/* ── Visual panel ───────────────────────────────────────────────────
          On a phone this is a short strip rather than a half-screen: the form
          is what the reader came for, and a full-height photograph above it
          just means scrolling past a picture to reach a password box. */}
      <aside className="relative isolate h-32 overflow-hidden bg-graphite sm:h-40 lg:col-span-5 lg:h-auto">
        {/* `alt=""`: it is atmosphere. The heading beside it is the content,
            and narrating the wallpaper before the sign-in form is an
            obstruction, not a service. */}
        <Photo
          name={photo}
          alt=""
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="absolute inset-0 block h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
        {/*
          A graded scrim rather than a flat one.

          A flat 75% wash guarantees contrast, but on an already-dark photograph
          it leaves a panel that is almost black — the picture stops being a
          picture. This is heavy where the type sits (top-left mark, bottom-left
          sentence) and lighter across the middle, so the photograph survives
          and the text still clears 4.5:1 over the part it actually covers.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-graphite/85 via-graphite/45 to-graphite/90"
        />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-8 lg:p-10">
          <Link
            to="/"
            className="font-display text-sm font-bold tracking-tight text-paper"
          >
            Commercial 2026
          </Link>

          <div className="hidden lg:block">
            <p className="max-w-prose font-display text-lg font-semibold leading-snug text-paper">
              Sistem pendataan ban untuk armada bus dan truk — dipakai di bengkel, bukan di
              belakang meja.
            </p>
            <p className="mt-5 border-t border-paper/20 pt-4 font-data text-xs text-paper/70">
              {note}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Form panel ─────────────────────────────────────────────────────*/}
      <main className="relative flex flex-col lg:col-span-7">
        <div className="flex justify-end p-5 sm:p-6">
          <ThemeToggle />
        </div>

        {/* `pb-[8%]` is the optical offset: it lifts the form about 4% above
            true centre without taking it out of the centring. */}
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8 lg:pb-[8%]">
          <div className="w-full max-w-[420px]">
            <h1 className="font-display text-2xl font-bold tracking-tight text-body">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>

            <div className="mt-7 rounded-panel border border-line bg-surface p-6 sm:p-7">
              {children}
            </div>

            <div className="mt-6 text-sm">{footer}</div>
          </div>
        </div>

        <footer className="px-5 pb-6 text-center text-xs text-subtle sm:px-8">
          <PhotoCreditLine credit={PHOTO_CREDITS[photo]} />
        </footer>
      </main>
    </div>
  );
}

/**
 * The photograph's attribution.
 *
 * CC BY and CC BY-SA both require the author, the licence, and a link back, so
 * this is not decoration — it is the condition on which the image may be used
 * at all. The public-domain case needs none of it and is credited anyway.
 */
function PhotoCreditLine({ credit }: { credit: PhotoCredit }): ReactNode {
  return (
    <span>
      Foto: {credit.author},{" "}
      {credit.licenseUrl === "" ? (
        credit.license
      ) : (
        <a
          href={credit.licenseUrl}
          rel="license noopener noreferrer"
          target="_blank"
          className="underline underline-offset-2 hover:text-muted"
        >
          {credit.license}
        </a>
      )}
      , via{" "}
      <a
        href={credit.sourceUrl}
        rel="noopener noreferrer"
        target="_blank"
        className="underline underline-offset-2 hover:text-muted"
      >
        Wikimedia Commons
      </a>
      .
    </span>
  );
}

/**
 * The auth screens' input treatment.
 *
 * Filled rather than outlined, on the sunken surface, so the field reads as a
 * slot cut into the card. The chalk-mark rule on focus is drawn by
 * `.auth-field` in `auth.css`.
 */
export const AUTH_FIELD = "rounded-base bg-surface-sunken";

export function authFieldClass(extra?: string): string {
  return cn(AUTH_FIELD, extra);
}
