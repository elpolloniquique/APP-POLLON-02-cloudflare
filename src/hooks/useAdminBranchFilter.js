import { useEffect, useMemo, useState } from 'react';
import { useStaffBranch } from './useStaffBranch';
import { adminListAllBranches } from '../services/branchService';

/** Filtrado de pedidos: sucursal del personal o selector manual (super admin). */
export function useAdminBranchFilter() {
  const staff = useStaffBranch();
  const { filterOrders, isSuperAdmin, branchId, branch, branchName, isBranchScoped } = staff;
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    adminListAllBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [isSuperAdmin]);

  const applyBranchFilter = useMemo(
    () => (orders) => {
      let scoped = filterOrders(orders);
      if (isSuperAdmin && selectedBranchId) {
        scoped = scoped.filter(
          (o) => (o.branchId || o.branch_id) === selectedBranchId,
        );
      }
      return scoped;
    },
    [filterOrders, isSuperAdmin, selectedBranchId],
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  const headerBranchLabel = isBranchScoped
    ? branchName
    : selectedBranchId
      ? selectedBranch?.name || 'Sucursal'
      : undefined;

  return {
    ...staff,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    applyBranchFilter,
    headerBranchLabel,
    showBranchFilter: isSuperAdmin,
  };
}
