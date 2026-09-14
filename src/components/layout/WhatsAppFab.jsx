import { useBranch } from '../../context/BranchContext';
import { WhatsAppIcon } from '../ui/WhatsAppIcon';

export function WhatsAppFab() {
  const { whatsapp } = useBranch();
  const message = encodeURIComponent('Hola, quiero hacer un pedido en El Pollón 🍗');

  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-fab"
      aria-label="Contactar por WhatsApp"
      title="Escríbenos por WhatsApp"
    >
      <span className="whatsapp-fab__pulse" aria-hidden />
      <span className="whatsapp-fab__inner">
        <WhatsAppIcon className="whatsapp-fab__icon" title="" />
      </span>
    </a>
  );
}
