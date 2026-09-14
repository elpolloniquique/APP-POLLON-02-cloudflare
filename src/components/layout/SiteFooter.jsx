import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import { TRANSFER_BANK_INFO } from '../../utils/constants';
import { getBranchSocialLinks } from '../../utils/socialLinks';
import { SocialLinks } from './SocialLinks';

export function SiteFooter() {
  const { branch, whatsapp } = useBranch();
  const socialLinks = getBranchSocialLinks(branch);

  return (
    <footer className="bg-pollon-black text-white">
      {/* Barra beneficios */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
          {[
            { icon: '🍗', title: 'Pollo fresco del día', desc: 'Marinado y cocinado al carbón' },
            { icon: '🛵', title: 'Delivery rápido', desc: 'Llegamos caliente a tu puerta' },
            { icon: '💵', title: 'Pago al recibir', desc: 'Efectivo, transferencia o tarjeta según sucursal' },
            { icon: '🎧', title: 'Atención multi-sucursal', desc: 'Arica, Iquique y más' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">{item.title}</p>
                <p className="text-[11px] text-white/60">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <img src="/img/logo pollon.png" alt="Pollería El Pollón — pollo a la brasa" className="mb-4 h-14 w-14 rounded-full bg-white object-contain p-1" />
            <h3 className="font-display text-2xl text-pollon-gold">EL POLLÓN</h3>
            <p className="mt-2 text-sm text-white/60">
              El auténtico sabor del pollo a la brasa peruano en el norte de Chile.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-pollon-gold">Enlaces rápidos</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/" className="hover:text-white">Inicio</Link></li>
              <li><Link to="/tienda" className="hover:text-white">Menú completo</Link></li>
              <li><Link to="/sucursal" className="hover:text-white">Sucursales</Link></li>
              <li><Link to="/tienda?cat=ofertas-familiares" className="hover:text-white">Promociones</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-pollon-gold">Ayuda</h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li>
                <Link to="/#guia-pedido" className="transition hover:text-white">
                  Cómo comprar
                </Link>
              </li>
              <li>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
                  Contacto WhatsApp
                </a>
              </li>
              <li>
                <Link to="/terminos" className="transition hover:text-white">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/libro-reclamaciones" className="transition hover:text-white">
                  Libro de reclamaciones
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-pollon-gold">Contacto</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-pollon-red" /><a href={`tel:+${whatsapp}`}>{branch?.phone}</a></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-pollon-red" />{TRANSFER_BANK_INFO.email}</li>
              <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-pollon-red" />{branch?.schedule}</li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pollon-red" />{branch?.address}</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-pollon-gold">Redes sociales</h4>
            <p className="mb-4 text-xs leading-relaxed text-white/50">
              Síguenos en {branch?.name || 'El Pollón'}
            </p>
            {socialLinks.length > 0 ? (
              <SocialLinks links={socialLinks} />
            ) : (
              <p className="text-xs text-white/40">Próximamente en esta sucursal</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Pollería El Pollón — Todos los derechos reservados</p>
          <p>Desarrollado con ❤️ para nuestros clientes</p>
        </div>
      </div>
    </footer>
  );
}
