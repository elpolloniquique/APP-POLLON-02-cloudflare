import { useEffect, useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listAddresses, saveAddress, deleteAddress } from '../../services/customerService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { useToast } from '../../hooks/useToast';

const empty = { label: 'Casa', address: '', reference: '', city: '', isDefault: false };

export function AccountAddresses() {
  const { profile } = useAuth();
  const { show, Toast } = useToast();
  const [addresses, setAddresses] = useState([]);
  const [modal, setModal] = useState(null);

  const load = async () => {
    if (!isSupabaseConfigured() || !profile?.id || String(profile.id).startsWith('local-')) return;
    const list = await listAddresses(profile.id);
    setAddresses(list);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await saveAddress(profile.id, modal);
      show('Dirección guardada');
      setModal(null);
      load();
    } catch (err) {
      show(err.message);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="font-display text-3xl">Mis direcciones</h1>
        <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-xl p-4">Conecta Supabase para guardar direcciones en tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {Toast}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-pollon-black">Mis direcciones</h1>
        <button type="button" onClick={() => setModal({ ...empty })} className="flex items-center gap-1 rounded-xl bg-pollon-red px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>

      <ul className="mt-6 space-y-3">
        {addresses.map((a) => (
          <li key={a.id} className="flex items-start justify-between rounded-xl border p-4">
            <div>
              <p className="font-bold flex items-center gap-2">
                {a.label}
                {a.isDefault && <Star className="h-4 w-4 fill-pollon-gold text-pollon-gold" />}
              </p>
              <p className="text-sm text-gray-600">{a.address}</p>
              {a.reference && <p className="text-xs text-gray-400">Ref: {a.reference}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal(a)} className="text-sm text-pollon-red font-semibold">Editar</button>
              <button type="button" onClick={() => deleteAddress(a.id).then(load)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {!addresses.length && <p className="text-gray-500 text-sm">No tienes direcciones guardadas</p>}
      </ul>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 space-y-3">
            <h3 className="font-bold text-lg">{modal.id ? 'Editar' : 'Nueva'} dirección</h3>
            <input value={modal.label} onChange={(e) => setModal({ ...modal, label: e.target.value })} placeholder="Etiqueta (Casa, Trabajo…)" className="w-full rounded-lg border px-3 py-2" required />
            <input value={modal.address} onChange={(e) => setModal({ ...modal, address: e.target.value })} placeholder="Dirección" className="w-full rounded-lg border px-3 py-2" required />
            <input value={modal.reference} onChange={(e) => setModal({ ...modal, reference: e.target.value })} placeholder="Referencia" className="w-full rounded-lg border px-3 py-2" />
            <input value={modal.city} onChange={(e) => setModal({ ...modal, city: e.target.value })} placeholder="Ciudad" className="w-full rounded-lg border px-3 py-2" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={modal.isDefault} onChange={(e) => setModal({ ...modal, isDefault: e.target.checked })} /> Predeterminada</label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 rounded-lg bg-pollon-red py-2 font-bold text-white">Guardar</button>
              <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-lg border py-2">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
