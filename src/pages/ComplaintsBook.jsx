import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/layout/LegalPageLayout';
import { useBranch } from '../context/BranchContext';
import { TRANSFER_BANK_INFO } from '../utils/constants';

export function ComplaintsBook() {
  const { branch, whatsapp } = useBranch();

  return (
    <LegalPageLayout
      title="Libro de reclamaciones"
      subtitle="Canal oficial para presentar reclamos, quejas o sugerencias"
    >
      <section className="space-y-6 text-sm leading-relaxed text-gray-700">
        <p>
          De acuerdo con la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores, ponemos a disposición
          de nuestros clientes este libro de reclamaciones virtual.
        </p>

        <div className="rounded-xl bg-gray-50 p-5 ring-1 ring-gray-100">
          <h2 className="text-base font-bold text-pollon-black">Datos del proveedor</h2>
          <ul className="mt-3 space-y-2">
            <li><strong>Razón social:</strong> Pollería El Pollón</li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pollon-red" aria-hidden />
              <span><strong>Sucursal:</strong> {branch?.name || 'El Pollón'} — {branch?.address || 'Consultar sucursal'}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-pollon-red" aria-hidden />
              <a href={`tel:+${whatsapp}`} className="font-medium text-pollon-red hover:underline">{branch?.phone || 'Teléfono de sucursal'}</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-pollon-red" aria-hidden />
              <a href={`mailto:${TRANSFER_BANK_INFO.email}`} className="font-medium text-pollon-red hover:underline">{TRANSFER_BANK_INFO.email}</a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-pollon-black">¿Cómo presentar un reclamo?</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Describe tu caso con fecha, número de pedido (si aplica) y sucursal.</li>
            <li>Indica el producto o servicio involucrado y la solución que esperas.</li>
            <li>Envía tu reclamo por WhatsApp o correo electrónico. Responderemos a la brevedad.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Libro de reclamaciones — El Pollón\n\nNombre:\nPedido (si aplica):\nDetalle del reclamo:')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1fb855]"
          >
            Enviar por WhatsApp
          </a>
          <a
            href={`mailto:${TRANSFER_BANK_INFO.email}?subject=${encodeURIComponent('Libro de reclamaciones — El Pollón')}`}
            className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-pollon-red px-5 py-3 text-sm font-bold text-pollon-red transition hover:bg-pollon-red hover:text-white"
          >
            Enviar por correo
          </a>
        </div>

        <p className="text-xs text-gray-500">
          También puedes acercarte personalmente a la sucursal correspondiente. Si no quedas conforme con nuestra
          respuesta, puedes recurrir al SERNAC.
        </p>

        <p className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          ¿Primera vez comprando? Consulta nuestra{' '}
          <Link to="/#guia-pedido" className="font-semibold text-pollon-red hover:underline">guía de compra</Link>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
