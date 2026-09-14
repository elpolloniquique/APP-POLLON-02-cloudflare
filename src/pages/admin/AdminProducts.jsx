import { useEffect, useState } from 'react';
import { adminListProducts, adminUpsertProduct, adminDeleteProduct, adminListCategories } from '../../services/productService';
import { money } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { isSupabaseConfigured } from '../../services/supabaseClient';

export function AdminProducts() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modal, setModal] = useState(null);

  const load = async () => {
    if (!isSupabaseConfigured()) return;
    const [p, c] = await Promise.all([adminListProducts(), adminListCategories()]);
    setProductos(p);
    setCategorias(c);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminUpsertProduct({
      id: modal?.id,
      nombre: fd.get('nombre'),
      descripcion: fd.get('descripcion'),
      precio: Number(fd.get('precio')),
      categoria_id: fd.get('categoria_id'),
      stock: Number(fd.get('stock')),
      disponible: fd.get('disponible') === 'on',
      imagen_url: fd.get('imagen_url'),
    });
    setModal(null);
    load();
  };

  if (!isSupabaseConfigured()) {
    return <p className="rounded-xl bg-amber-50 p-4 text-amber-800">Conecta Supabase para gestionar productos. El menú local sigue funcionando en la tienda.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Productos</h2>
        <Button onClick={() => setModal({})}>+ Nuevo</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-3">Img</th><th className="p-3">Nombre</th><th className="p-3">Cat.</th><th className="p-3">Precio</th><th className="p-3">Stock</th><th className="p-3"></th></tr></thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.imagen_url && <img src={p.imagen_url} alt="" className="h-10 w-10 rounded object-cover" />}</td>
                <td className="p-3">{p.nombre}</td>
                <td className="p-3">{p.categorias?.nombre}</td>
                <td className="p-3">{money(p.precio)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3">
                  <button type="button" className="text-pollon-red" onClick={() => setModal(p)}>Editar</button>
                  {' · '}
                  <button type="button" className="text-gray-500" onClick={() => adminDeleteProduct(p.id).then(load)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">{modal.id ? 'Editar' : 'Nuevo'} producto</h3>
            <div className="mt-4 space-y-3">
              <input name="nombre" defaultValue={modal.nombre} required placeholder="Nombre" className="w-full rounded-lg border px-3 py-2" />
              <textarea name="descripcion" defaultValue={modal.descripcion} placeholder="Descripción" className="w-full rounded-lg border px-3 py-2" />
              <input name="precio" type="number" defaultValue={modal.precio} required placeholder="Precio" className="w-full rounded-lg border px-3 py-2" />
              <select name="categoria_id" defaultValue={modal.categoria_id} className="w-full rounded-lg border px-3 py-2">
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <input name="stock" type="number" defaultValue={modal.stock ?? 99} className="w-full rounded-lg border px-3 py-2" />
              <input name="imagen_url" defaultValue={modal.imagen_url} placeholder="URL imagen" className="w-full rounded-lg border px-3 py-2" />
              <label className="flex items-center gap-2"><input name="disponible" type="checkbox" defaultChecked={modal.disponible !== false} /> Disponible</label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">Guardar</Button>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
