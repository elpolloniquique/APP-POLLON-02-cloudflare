import { useEffect, useState } from 'react';
import { adminListCategories } from '../../services/productService';
import { isSupabaseConfigured } from '../../services/supabaseClient';

export function AdminCategories() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    if (isSupabaseConfigured()) adminListCategories().then(setCats);
  }, []);

  if (!isSupabaseConfigured()) {
    return <p className="rounded-xl bg-amber-50 p-4">Configura Supabase para ver categorías en BD.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Categorías</h2>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-3">Orden</th><th className="p-3">Nombre</th><th className="p-3">Slug</th><th className="p-3">Activa</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t"><td className="p-3">{c.orden}</td><td className="p-3">{c.nombre}</td><td className="p-3"><code>{c.slug}</code></td><td className="p-3">{c.activo ? '✅' : '❌'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
