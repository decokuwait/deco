export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b1220] px-6 text-center text-white" dir="rtl">
      <span className="text-7xl font-black text-amber-400">404</span>
      <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="text-white/60">Page not found · This site or template is not available on this address.</p>
      <a href="/" className="mt-2 rounded-full bg-white/10 px-5 py-2 font-bold hover:bg-white/20">
        الرئيسية
      </a>
    </div>
  );
}
