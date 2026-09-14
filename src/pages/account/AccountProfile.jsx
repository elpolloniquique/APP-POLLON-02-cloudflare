import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, getMarketingPreferences, updateMarketingPreferences } from '../../services/customerService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { useToast } from '../../hooks/useToast';

export function AccountProfile() {
  const { profile } = useAuth();
  const { show, Toast } = useToast();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const [marketing, setMarketing] = useState({ acceptsEmailPromotions: false, acceptsWhatsappPromotions: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName || profile.nombre || '',
      phone: profile.phone || '',
      email: profile.email || '',
    });
    if (isSupabaseConfigured() && profile.id && !String(profile.id).startsWith('local-')) {
      getMarketingPreferences(profile.id).then(setMarketing);
    }
  }, [profile]);

  const save = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured() || String(profile.id).startsWith('local-')) {
      show('Guardado localmente (conecta Supabase para sincronizar)');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profile.id, form);
      await updateMarketingPreferences(profile.id, marketing);
      show('Perfil actualizado');
    } catch (err) {
      show(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {Toast}
      <h1 className="font-display text-3xl text-pollon-black">Mi perfil</h1>
      <p className="mt-1 text-sm text-gray-500">Actualiza tus datos y preferencias de comunicación</p>

      <form onSubmit={save} className="mt-6 space-y-4 max-w-lg">
        <div>
          <label className="text-sm font-medium">Nombre completo</label>
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Teléfono</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Correo</label>
          <input type="email" value={form.email} disabled className="mt-1 w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-500" />
        </div>

        <div className="rounded-xl border border-pollon-red/20 bg-pollon-cream/50 p-4 space-y-3">
          <p className="font-semibold text-sm">Promociones y novedades</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={marketing.acceptsEmailPromotions} onChange={(e) => setMarketing({ ...marketing, acceptsEmailPromotions: e.target.checked })} />
            Recibir ofertas por correo electrónico
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={marketing.acceptsWhatsappPromotions} onChange={(e) => setMarketing({ ...marketing, acceptsWhatsappPromotions: e.target.checked })} />
            Recibir novedades por WhatsApp
          </label>
        </div>

        <button type="submit" disabled={saving} className="rounded-xl bg-pollon-red px-8 py-3 text-sm font-bold text-white hover:bg-pollon-red-dark disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
