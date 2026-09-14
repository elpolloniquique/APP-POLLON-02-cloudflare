import { AdminScrollPanel } from './AdminScrollPanel';

/**
 * Tabla admin responsive — visual alineado a Pedidos.
 */
export function AdminTable({
  columns,
  children,
  count,
  countLabel,
  emptyMessage = 'Sin registros',
  maxRows = 7,
  minWidth = 640,
  className = '',
}) {
  const total = count ?? 0;
  const label = countLabel ?? `${total} registro${total !== 1 ? 's' : ''}`;

  return (
    <div className={`admin-table ${className}`}>
      <div className="admin-table__meta">
        <p>{label}</p>
        {total > 8 && (
          <p>Desplaza para ver más ↓</p>
        )}
      </div>

      {total > 0 ? (
        <AdminScrollPanel maxRows={maxRows} variant="table" className="rounded-none border-0 shadow-none">
          <div className="admin-table-scroll overflow-x-auto">
            <table className="admin-data-table w-full text-left text-sm" style={{ minWidth }}>
              <thead>
                <tr>
                  {columns.map((col) => {
                    const key = typeof col === 'string' ? col : col.key;
                    const labelCol = typeof col === 'string' ? col : col.label;
                    const thClass = typeof col === 'object' ? col.className : '';
                    return (
                      <th key={key} className={`whitespace-nowrap ${thClass || ''}`}>
                        {labelCol}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>{children}</tbody>
            </table>
          </div>
        </AdminScrollPanel>
      ) : (
        <p className="p-6 text-center text-sm text-stone-500 sm:p-8">{emptyMessage}</p>
      )}
    </div>
  );
}
