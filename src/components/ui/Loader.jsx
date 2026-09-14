export function Loader({ text = 'Cargando…' }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-pollon-black text-white">
      <img src="/img/logo pollon.png" alt="" className="mb-4 h-20 w-20 animate-pulse-soft object-contain" />
      <p className="font-display text-3xl tracking-widest text-pollon-orange">EL POLLÓN</p>
      <p className="mt-2 text-sm text-white/70">{text}</p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-pollon-red" />
      </div>
    </div>
  );
}
