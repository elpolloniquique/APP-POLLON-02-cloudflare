import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useBranch } from '../../context/BranchContext';
import { useBranchMenu } from '../../context/BranchMenuContext';
import { applyPageSeo } from '../../utils/seoHead';

/**
 * Actualiza metadatos y datos estructurados en cada cambio de ruta (SPA).
 */
export function SeoManager() {
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const { branch, branches } = useBranch();
  const { categories } = useBranchMenu();

  const categoryName = useMemo(() => {
    const catId = searchParams.get('cat');
    if (!catId || !categories.length) return '';
    const cat = categories.find((c) => c.id === catId || c.slug === catId);
    return cat?.name || '';
  }, [searchParams, categories]);

  useEffect(() => {
    applyPageSeo({
      pathname,
      search,
      branchName: branch?.name || '',
      branchCity: branch?.city || '',
      categoryName,
      branches: branches?.length ? branches : [],
    });
  }, [pathname, search, branch?.name, branch?.city, categoryName, branches]);

  return null;
}
