import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b1220] px-6 text-center text-white" dir="rtl">
      <span className="text-7xl font-black text-amber-400">404</span>
      <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="text-white/60">Page not found · This site or template is not available on this address.</p>
      <Link href="/" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-white/10 px-5 font-bold hover:bg-white/20">
        الرئيسية
      </Link>
    </div>
  );
}
