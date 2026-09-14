import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BRANCH_KEY } from '../utils/constants';
import { loadBranches, isBranchOpenNow } from '../services/branchService';

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [branch, setBranchState] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    const list = await loadBranches(true);
    const active = list.filter((b) => !b.comingSoon && b.isActive !== false);
    setBranches(active);
    setBranchState((current) => {
      if (current?.id) {
        const still = active.find((b) => b.id === current.id);
        if (still) return still;
      }
      const saved = localStorage.getItem(BRANCH_KEY);
      const found = saved ? active.find((b) => b.id === saved) : null;
      return found || active[0] || null;
    });
    return list;
  }, []);

  useEffect(() => {
    refreshBranches().then(() => {
      setLoading(false);
    });
  }, [refreshBranches]);

  const setBranch = useCallback((b, options = {}) => {
    if (!b || b.comingSoon) return false;
    if (!options.force && b.isActive === false) return false;
    setBranchState((current) => {
      if (!options.force && b.id === current?.id) return current;
      localStorage.setItem(BRANCH_KEY, b.id);
      return b;
    });
    return true;
  }, []);

  const whatsapp = branch?.whatsapp || import.meta.env.VITE_WHATSAPP_DEFAULT || '56986925310';
  const branchOpen = branch ? isBranchOpenNow(branch) : false;

  return (
    <BranchContext.Provider
      value={{
        branches,
        branch,
        setBranch,
        loading,
        whatsapp,
        branchOpen,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch debe usarse dentro de BranchProvider');
  return ctx;
}
