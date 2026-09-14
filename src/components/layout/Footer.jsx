import { Link } from 'react-router-dom';
import { useBranch } from '../../context/BranchContext';

export function Footer() {
  const { branch, whatsapp, branches } = useBranch();

  return (
    <footer className="mt-auto bg-pollon-black text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <img src="/img/logo pollon.png" alt="" className="mb-4 h-16 w-16 rounded-full bg-white object-contain p-1" />
          <h3 className="font-display text-2xl text-pollon-orange">EL POLLÓN</h3>
          <p className="mt-2 text-sm text-white/70">Pollería peruana — pollo a la brasa, delivery y reservas en el norte de Chile.</p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Sucursales</h4>
          <ul className="space-y-2 text-sm text-white/70">
            {branches.filter((b) => !b.comingSoon).map((b) => (
              <li key={b.id}>{b.name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold">Contacto</h4>
          <p className="text-sm text-white/70">{branch?.address}</p>
          <p className="text-sm text-white/70">{branch?.schedule}</p>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-pollon-orange hover:underline"
          >
            WhatsApp
          </a>
          <div className="mt-4 flex gap-4 text-sm">
            <Link to="/tienda" className="hover:text-pollon-orange">Tienda</Link>
            <Link to="/sucursal" className="hover:text-pollon-orange">Sucursales</Link>
            <Link to="/admin/login" className="hover:text-pollon-orange">Admin</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Pollería El Pollón — Chile · elpollon.cl
      </div>
    </footer>
  );
}
