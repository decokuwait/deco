/* Vitest stand-in for next/font/google: the real loader only works inside a Next.js build. Each export
 * mimics the loader's return shape with the family name as font-family. Add a line when a font is added
 * to src/templates/font-faces.ts (a missing export fails loudly at import time). */
const face = (family: string) => () => ({ className: "", style: { fontFamily: `'${family}'` } });
export const Alexandria = face("Alexandria");
export const Almarai = face("Almarai");
export const Amiri = face("Amiri");
export const Aref_Ruqaa = face("Aref Ruqaa");
export const Baloo_Bhaijaan_2 = face("Baloo Bhaijaan 2");
export const Cairo = face("Cairo");
export const Changa = face("Changa");
export const El_Messiri = face("El Messiri");
export const Harmattan = face("Harmattan");
export const IBM_Plex_Sans_Arabic = face("IBM Plex Sans Arabic");
export const Kufam = face("Kufam");
export const Lalezar = face("Lalezar");
export const Lateef = face("Lateef");
export const Mada = face("Mada");
export const Manrope = face("Manrope");
export const Markazi_Text = face("Markazi Text");
export const Marhey = face("Marhey");
export const Noto_Kufi_Arabic = face("Noto Kufi Arabic");
export const Noto_Naskh_Arabic = face("Noto Naskh Arabic");
export const Noto_Sans_Arabic = face("Noto Sans Arabic");
export const Playfair_Display = face("Playfair Display");
export const Rakkas = face("Rakkas");
export const Readex_Pro = face("Readex Pro");
export const Reem_Kufi = face("Reem Kufi");
export const Rubik = face("Rubik");
export const Scheherazade_New = face("Scheherazade New");
export const Sora = face("Sora");
export const Tajawal = face("Tajawal");
export const Vazirmatn = face("Vazirmatn");
export const Zain = face("Zain");
