import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { filterByStaffBranch, getProfileBranchId, isBranchScopedStaff, normalizeRole } from '../services/authService';
import { adminListAllBranches } from '../services/branchService';
import { useEffect, useState } from 'react';

/** Sucursal asignada al personal y utilidades de filtrado */
export function useStaffBranch() {
  const { profile, role } = useAuth();
  const branchId = getProfileBranchId(profile);
  const scoped = isBranchScopedStaff(role);
  const [branch, setBranch] = useState(null);

  const reloadBranch = useCallback(async () => {
    if (!branchId) {
      setBranch(null);
      return null;
    }
    try {
      const list = await adminListAllBranches({ force: true });
      const next = list.find((b) => b.id === branchId) || null;
      setBranch(next);
      return next;
    } catch {
      setBranch(null);
      return null;
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setBranch(null);
      return;
    }
    let cancelled = false;
    adminListAllBranches()
      .then((list) => {
        if (!cancelled) setBranch(list.find((b) => b.id === branchId) || null);
      })
      .catch(() => {
        if (!cancelled) setBranch(null);
      });
    return () => { cancelled = true; };
  }, [branchId]);

  const filterOrders = useMemo(
    () => (orders) => filterByStaffBranch(orders, profile),
    [profile]
  );

  return {
    branchId,
    branch,
    reloadBranch,
    branchName: branch?.name || (scoped ? 'Tu sucursal' : 'Todas'),
    isBranchScoped: scoped,
    isSuperAdmin: normalizeRole(role) === 'super_admin',
    filterOrders,
  };
}
