import { useMemo } from 'react';
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

  useEffect(() => {
    if (!branchId) {
      setBranch(null);
      return;
    }
    adminListAllBranches()
      .then((list) => setBranch(list.find((b) => b.id === branchId) || null))
      .catch(() => setBranch(null));
  }, [branchId]);

  const filterOrders = useMemo(
    () => (orders) => filterByStaffBranch(orders, profile),
    [profile]
  );

  return {
    branchId,
    branch,
    branchName: branch?.name || (scoped ? 'Tu sucursal' : 'Todas'),
    isBranchScoped: scoped,
    isSuperAdmin: normalizeRole(role) === 'super_admin',
    filterOrders,
  };
}
