import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import {
  alertFromBranch,
  emptySiteAlert,
  fetchSiteAlert,
} from '../../services/siteAlertService';

function shouldHideOnPath(pathname) {
  return pathname.startsWith('/admin') || pathname.startsWith('/repartidor');
}

export function SiteAlertOverlay() {
  const { pathname } = useLocation();
  const { branch } = useBranch();
  const [alert, setAlert] = useState(emptySiteAlert);
  const [dismissed, setDismissed] = useState(false);

  const applyAlert = useCallback((next) => {
    setAlert(next);
  }, []);

  useEffect(() => {
    setDismissed(false);
    const branchId = branch?.id;
    if (!branchId) {
      applyAlert(emptySiteAlert());
      return undefined;
    }

    applyAlert(alertFromBranch(branch));

    let cancelled = false;
    const load = async () => {
      const next = await fetchSiteAlert(branchId);
      if (!cancelled && next.branchId === branchId) applyAlert(next);
    };
    load();
    const timer = window.setInterval(load, 40000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [branch?.id, branch?.alertEnabled, branch?.alertTitle, branch?.alertMessage, applyAlert]);

  const hide = shouldHideOnPath(pathname);
  const open = Boolean(
    !hide &&
    !dismissed &&
    alert.enabled &&
    alert.message &&
    alert.branchId &&
    alert.branchId === branch?.id,
  );

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="site-alert" role="alertdialog" aria-modal="true" aria-labelledby="site-alert-title">
      <div className="site-alert__panel">
        <button type="button" className="site-alert__close" onClick={() => setDismissed(true)} aria-label="Cerrar aviso">
          <X size={20} strokeWidth={2.4} />
        </button>
        <div className="site-alert__icon" aria-hidden>
          <AlertTriangle size={34} strokeWidth={2.15} />
        </div>
        <p className="site-alert__kicker">Aviso · {branch?.name || 'Sucursal'}</p>
        <h2 id="site-alert-title" className="site-alert__title">{alert.title}</h2>
        <p className="site-alert__message">{alert.message}</p>
        <button type="button" className="site-alert__ok" onClick={() => setDismissed(true)}>
          Entendido
        </button>
      </div>
    </div>
  );
}
