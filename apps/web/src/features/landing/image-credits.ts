/**
 * Attribution for the photographs on the public pages.
 *
 * Every one is licensed for commercial use, and every credit here was read from
 * the Wikimedia Commons API rather than written from memory — `Artist`,
 * `LicenseShortName` and `LicenseUrl` off the file's own metadata. That matters:
 * a credit is somebody's name, and inventing one is worse than omitting it.
 *
 * CC BY and CC BY-SA both *require* the author, the licence, and a link back.
 * The public-domain photograph requires none of it; it is credited anyway,
 * because the courtesy costs nothing.
 *
 * The files live in `public/images/`. They are served from our own origin
 * because the CSP is `img-src 'self' …` (PLAN/13 §7) — the previous version of
 * the landing page hot-linked all four of its photographs to
 * `images.unsplash.com`, which the browser blocked outright. They rendered in
 * `vite dev`, where no CSP header is set, and were broken for every real
 * visitor.
 */

export interface ImageCredit {
  /** Path under `public/`, served from our own origin. */
  src: string;
  /** Indonesian, and descriptive rather than decorative — this is read aloud. */
  alt: string;
  author: string;
  license: string;
  /** The licence deed. Empty for public domain, which has no deed to link. */
  licenseUrl: string;
  /** The file's page on Wikimedia Commons, which the licence requires. */
  sourceUrl: string;
}

export const HERO_IMAGE: ImageCredit = {
  src: "/images/bus-akdp-probolinggo.webp",
  alt: "Bus antarkota antarprovinsi di Probolinggo, Jawa Timur",
  author: "The Stephen J Mason Photography Collection",
  license: "CC BY-SA 2.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
  sourceUrl:
    "https://commons.wikimedia.org/wiki/File:AKDP_BUS_PROBOLINGGO_JAVA_INDONESIA_APRIL_2010.jpg",
};

export const WHEEL_IMAGE: ImageCredit = {
  src: "/images/truck-wheel-kumho.webp",
  alt: "Roda truk dengan ban radial, dilihat dari samping",
  author: "Senior Airman Zachary Jakel",
  license: "Domain publik",
  licenseUrl: "",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Truck_Wheel_with_Kumho_KRS03_Tire.jpg",
};

export const TREAD_IMAGE: ImageCredit = {
  src: "/images/tire-tread-texture.webp",
  alt: "Permukaan alur ban dari dekat",
  author: "Lee Coursey",
  license: "CC BY 2.0",
  licenseUrl: "https://creativecommons.org/licenses/by/2.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Texture_-_tire_tread_(30784753).jpg",
};

export const IMAGE_CREDITS: ImageCredit[] = [HERO_IMAGE, WHEEL_IMAGE, TREAD_IMAGE];
