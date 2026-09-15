import {
  Alexandria,
  Almarai,
  Amiri,
  Aref_Ruqaa,
  Baloo_Bhaijaan_2,
  Cairo,
  Changa,
  El_Messiri,
  Harmattan,
  IBM_Plex_Sans_Arabic,
  Kufam,
  Lalezar,
  Lateef,
  Mada,
  Manrope,
  Marhey,
  Markazi_Text,
  Noto_Kufi_Arabic,
  Noto_Naskh_Arabic,
  Noto_Sans_Arabic,
  Playfair_Display,
  Rakkas,
  Readex_Pro,
  Reem_Kufi,
  Rubik,
  Scheherazade_New,
  Sora,
  Tajawal,
  Vazirmatn,
  Zain,
} from "next/font/google";

/*
 * Self-hosted template fonts. `next/font` downloads every family at build time and serves the files from
 * our own origin, so a site no longer waits on a render-blocking stylesheet from fonts.googleapis.com plus
 * a second origin for the files, and no visitor data reaches Google. A page only downloads the two
 * families its template uses (the @font-face rules are lazy); `preload: false` keeps the other 28 silent.
 * The loader requires literal option objects, hence the repetition. Variable fonts need no weight list;
 * static fonts list the weights the templates use.
 */
const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const tajawal = Tajawal({ weight: ["400", "500", "700", "800", "900"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const almarai = Almarai({ weight: ["300", "400", "700", "800"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const amiri = Amiri({ weight: ["400", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const notoKufi = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const notoNaskh = Noto_Naskh_Arabic({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const notoSans = Noto_Sans_Arabic({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const changa = Changa({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const elMessiri = El_Messiri({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const markazi = Markazi_Text({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const readex = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const ibmPlex = IBM_Plex_Sans_Arabic({ weight: ["300", "400", "500", "600", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const reemKufi = Reem_Kufi({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const baloo = Baloo_Bhaijaan_2({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const rubik = Rubik({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const arefRuqaa = Aref_Ruqaa({ weight: ["400", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const lalezar = Lalezar({ weight: "400", subsets: ["arabic", "latin"], display: "swap", preload: false });
const mada = Mada({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const alexandria = Alexandria({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const zain = Zain({ weight: ["300", "400", "700", "800", "900"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const harmattan = Harmattan({ weight: ["400", "500", "600", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const lateef = Lateef({ weight: ["400", "500", "600", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const kufam = Kufam({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const marhey = Marhey({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const rakkas = Rakkas({ weight: "400", subsets: ["arabic", "latin"], display: "swap", preload: false });
const scheherazade = Scheherazade_New({ weight: ["400", "500", "600", "700"], subsets: ["arabic", "latin"], display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false });

/** `font-family` value of each self-hosted family (the generated name plus its size-adjusted fallback). */
export const FACES = {
  cairo: cairo.style.fontFamily,
  tajawal: tajawal.style.fontFamily,
  almarai: almarai.style.fontFamily,
  amiri: amiri.style.fontFamily,
  notoKufi: notoKufi.style.fontFamily,
  notoNaskh: notoNaskh.style.fontFamily,
  notoSans: notoSans.style.fontFamily,
  changa: changa.style.fontFamily,
  elMessiri: elMessiri.style.fontFamily,
  markazi: markazi.style.fontFamily,
  readex: readex.style.fontFamily,
  ibmPlex: ibmPlex.style.fontFamily,
  reemKufi: reemKufi.style.fontFamily,
  baloo: baloo.style.fontFamily,
  rubik: rubik.style.fontFamily,
  arefRuqaa: arefRuqaa.style.fontFamily,
  lalezar: lalezar.style.fontFamily,
  mada: mada.style.fontFamily,
  vazirmatn: vazirmatn.style.fontFamily,
  alexandria: alexandria.style.fontFamily,
  zain: zain.style.fontFamily,
  harmattan: harmattan.style.fontFamily,
  lateef: lateef.style.fontFamily,
  kufam: kufam.style.fontFamily,
  marhey: marhey.style.fontFamily,
  rakkas: rakkas.style.fontFamily,
  scheherazade: scheherazade.style.fontFamily,
  playfair: playfair.style.fontFamily,
  manrope: manrope.style.fontFamily,
  sora: sora.style.fontFamily,
} as const;
