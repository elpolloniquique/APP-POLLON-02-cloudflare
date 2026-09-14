import { LegalPageLayout } from '../components/layout/LegalPageLayout';

export function TermsConditions() {
  return (
    <LegalPageLayout
      title="Términos y condiciones"
      subtitle="Condiciones de uso del sitio web y pedidos online de Pollería El Pollón"
    >
      <section className="space-y-6 text-sm leading-relaxed text-gray-700">
        <div>
          <h2 className="text-base font-bold text-pollon-black">1. Aceptación</h2>
          <p className="mt-2">
            Al usar este sitio y realizar pedidos, aceptas estos términos. El servicio está destinado a clientes en Chile
            que deseen ordenar productos de Pollería El Pollón a través de la web.
          </p>
        </div>
        <div>
          <h2 className="text-base font-bold text-pollon-black">2. Pedidos y precios</h2>
          <p className="mt-2">
            Los precios, disponibilidad y menú pueden variar según la sucursal seleccionada. El total final se confirma
            al completar el checkout. Nos reservamos el derecho de corregir errores de precio antes de confirmar el pedido.
          </p>
        </div>
        <div>
          <h2 className="text-base font-bold text-pollon-black">3. Pagos</h2>
          <p className="mt-2">
            El pago se realiza al momento de recibir el pedido (entrega o retiro). Cada sucursal define si acepta
            efectivo, transferencia y/o tarjeta. No procesamos pagos en línea ni pasarelas tipo Webpay en este sitio.
            Si eliges transferencia, el local o el repartidor te entrega los datos al recibir.
          </p>
        </div>
        <div>
          <h2 className="text-base font-bold text-pollon-black">4. Entrega y retiro</h2>
          <p className="mt-2">
            Los tiempos estimados son referenciales y pueden variar según demanda, clima o tráfico. El cliente debe
            proporcionar datos de contacto y dirección correctos. En retiro en local, el pedido debe ser recogido dentro
            del horario acordado con la sucursal.
          </p>
        </div>
        <div>
          <h2 className="text-base font-bold text-pollon-black">5. Cancelaciones y reclamos</h2>
          <p className="mt-2">
            Para consultas, reclamos o solicitudes relacionadas con tu pedido, contáctanos por WhatsApp o utiliza nuestro
            Libro de reclamaciones. Atenderemos tu caso conforme a la normativa vigente en Chile.
          </p>
        </div>
        <div>
          <h2 className="text-base font-bold text-pollon-black">6. Privacidad</h2>
          <p className="mt-2">
            Los datos que nos entregues (nombre, teléfono, dirección, correo) se usan únicamente para procesar pedidos,
            comunicaciones del servicio y, si lo autorizas, promociones de la marca.
          </p>
        </div>
        <p className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          Última actualización: {new Date().getFullYear()}. Pollería El Pollón — Norte de Chile.
        </p>
      </section>
    </LegalPageLayout>
  );
}
