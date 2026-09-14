const estadoColors = {
  pendiente: 'bg-amber-100 text-amber-900',
  aceptado: 'bg-green-100 text-green-800',
  confirmado: 'bg-green-100 text-green-800',
  preparando: 'bg-orange-100 text-orange-900',
  listo: 'bg-emerald-100 text-emerald-800',
  en_delivery: 'bg-blue-100 text-blue-800',
  entregado: 'bg-teal-100 text-teal-800',
  cancelado: 'bg-red-100 text-red-800',
};

export function Badge({ children, estado }) {
  const cls = estadoColors[estado] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}
