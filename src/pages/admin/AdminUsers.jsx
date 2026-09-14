import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
  Banknote,
  Send,
  Bike,
  ChefHat,
  Pencil,
  UserX,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import {
  MANAGEABLE_STAFF_ROLES,
  staffRoleMeta,
  listStaffUsers,
  createStaffUser,
  updateStaffUser,
  uploadStaffAvatar,
  staffKpis,
} from '../../services/staffUserService';
import { normalizeRole } from '../../services/authService';
import '../../styles/admin-users.css';

const ROLE_ICONS = {
  admin_sucursal: Shield,
  cajera: Banknote,
  despachador: Send,
  delivery: Bike,
  cocina: ChefHat,
};

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  password2: '',
  role: 'cajera',
  branchId: '',
  isActive: true,
  avatarUrl: null,
  avatarFile: null,
};

function initials(name, email) {
  const n = (name || email || '?').trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export function AdminUsers() {
  const { profile } = useAuth();
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    showBranchFilter,
    isSuperAdmin,
    branchId: staffBranchId,
  } = useAdminBranchFilter();

  const myRole = normalizeRole(profile?.role || profile?.rol);
  const canManage = myRole === 'super_admin' || myRole === 'admin_sucursal';

  const assignableRoles = useMemo(() => {
    if (isSuperAdmin) return MANAGEABLE_STAFF_ROLES;
    return MANAGEABLE_STAFF_ROLES.filter((r) => r.id !== 'admin_sucursal');
  }, [isSuperAdmin]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [panelOpen, setPanelOpen] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const filterBranch = isSuperAdmin ? (selectedBranchId || null) : staffBranchId;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listStaffUsers({ branchId: filterBranch || undefined });
      setUsers(list);
    } catch (err) {
      setError(err.message || 'Error al cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filterBranch]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || (u.username || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const kpis = useMemo(() => staffKpis(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      branchId: filterBranch || staffBranchId || branches[0]?.id || '',
      role: assignableRoles[0]?.id || 'cajera',
    });
    setPanelOpen(true);
    setOkMsg('');
    setError('');
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || '',
      username: u.username || '',
      password: '',
      password2: '',
      role: u.role,
      branchId: u.branchId || '',
      isActive: u.isActive,
      avatarUrl: u.avatarUrl,
      avatarFile: null,
    });
    setPanelOpen(true);
    setMenuId(null);
    setOkMsg('');
    setError('');
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Máximo 2MB');
      const preview = URL.createObjectURL(file);
      setForm((f) => ({ ...f, avatarFile: file, avatarUrl: preview }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      if (!form.fullName.trim()) throw new Error('Nombre completo requerido');
      if (!editing && !form.email.trim()) throw new Error('Correo requerido');
      if (!editing) {
        if (!form.password || form.password.length < 6) throw new Error('Contraseña mínimo 6 caracteres');
        if (form.password !== form.password2) throw new Error('Las contraseñas no coinciden');
      } else if (form.password) {
        if (form.password.length < 6) throw new Error('Contraseña mínimo 6 caracteres');
        if (form.password !== form.password2) throw new Error('Las contraseñas no coinciden');
      }
      if (!form.role) throw new Error('Selecciona un rol');
      if (form.role !== 'super_admin' && !form.branchId) throw new Error('Selecciona una sucursal');

      let avatarUrl = form.avatarUrl;
      if (form.avatarFile) {
        avatarUrl = await uploadStaffAvatar(form.avatarFile, editing?.authUserId || 'new');
      }

      if (editing) {
        await updateStaffUser({
          profileId: editing.id,
          authUserId: editing.authUserId,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          username: form.username.trim(),
          role: form.role,
          branchId: form.branchId || null,
          isActive: form.isActive,
          avatarUrl: avatarUrl?.startsWith('blob:') ? editing.avatarUrl : avatarUrl,
          password: form.password || undefined,
        });
        setOkMsg('Usuario actualizado');
      } else {
        await createStaffUser({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          username: form.username.trim() || form.email.split('@')[0],
          role: form.role,
          branchId: form.branchId || null,
          isActive: form.isActive,
          avatarUrl: avatarUrl?.startsWith('blob:') ? null : avatarUrl,
        });
        setOkMsg('Usuario creado correctamente');
        setForm({
          ...EMPTY_FORM,
          branchId: filterBranch || staffBranchId || branches[0]?.id || '',
          role: assignableRoles[0]?.id || 'cajera',
        });
        setEditing(null);
      }
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    setMenuId(null);
    try {
      await updateStaffUser({
        profileId: u.id,
        authUserId: u.authUserId,
        isActive: !u.isActive,
        fullName: u.fullName,
        phone: u.phone,
        username: u.username,
        role: u.role,
        branchId: u.branchId,
        avatarUrl: u.avatarUrl,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-users admin-users--denied">
        <p>No tienes permiso para gestionar usuarios.</p>
      </div>
    );
  }

  const selectedRole = staffRoleMeta(form.role);
  const RoleIcon = ROLE_ICONS[form.role] || Shield;

  return (
    <div className={`admin-users ${panelOpen ? 'is-panel-open' : ''}`}>
      <header className="aus-header">
        <div>
          <p className="aus-breadcrumb">Inicio › Usuarios</p>
          <h1 className="aus-title">Usuarios</h1>
        </div>
        <div className="aus-header__actions">
          {showBranchFilter && (
            <AdminBranchFilter
              branches={branches}
              value={selectedBranchId}
              onChange={(v) => { setSelectedBranchId(v); setPage(1); }}
            />
          )}
          <div className="aus-admin-chip">
            <span className="aus-admin-chip__avatar">{initials(profile?.fullName || profile?.nombre, profile?.email)}</span>
            <div>
              <strong>{profile?.fullName || profile?.nombre || 'Admin'}</strong>
              <small>{isSuperAdmin ? 'Super Admin' : 'Admin Sucursal'}</small>
            </div>
          </div>
          <button type="button" className="aus-btn aus-btn--primary" onClick={openCreate}>
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo
          </button>
        </div>
      </header>

      {(error || okMsg) && (
        <div className={`aus-banner ${error ? 'is-error' : 'is-ok'}`}>
          {error || okMsg}
          <button type="button" onClick={() => { setError(''); setOkMsg(''); }} aria-label="Cerrar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="aus-layout">
        <section className="aus-list">
          <div className="aus-list__head">
            <div>
              <h2>Gestión de Usuarios</h2>
              <p>Administra personal por sucursal y rol</p>
            </div>
            <button type="button" className="aus-btn aus-btn--primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          <div className="aus-kpis">
            {[
              { label: 'Total Usuarios', value: kpis.total, tone: 'red', icon: Users },
              { label: 'Activos', value: kpis.active, tone: 'green', icon: UserCheck },
              { label: 'Inactivos', value: kpis.inactive, tone: 'dark', icon: UserX },
              { label: 'Roles', value: kpis.roles, tone: 'black', icon: Shield },
            ].map((k) => (
              <div key={k.label} className={`aus-kpi aus-kpi--${k.tone}`}>
                <span className="aus-kpi__icon"><k.icon className="h-4 w-4" strokeWidth={2.25} /></span>
                <div className="aus-kpi__text">
                  <span className="aus-kpi__label">{k.label}</span>
                  <strong className="aus-kpi__value">{k.value}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="aus-filters">
            <label className="aus-search">
              <Search className="h-4 w-4 aus-search__icon" strokeWidth={2} />
              <input
                type="search"
                placeholder="Buscar usuario..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </label>
            <div className="aus-filters__row">
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                aria-label="Filtrar rol"
              >
                <option value="">Todos los roles</option>
                {MANAGEABLE_STAFF_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label="Filtrar estado"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <button type="button" className="aus-icon-btn" title="Filtros" aria-label="Filtros">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="aus-table-wrap">
            {loading ? (
              <p className="aus-empty">Cargando usuarios…</p>
            ) : (
              <table className="aus-table">
                <thead>
                  <tr>
                    <th className="aus-col-user">Usuario</th>
                    <th className="aus-col-role">Rol</th>
                    <th className="aus-col-branch">Sucursal</th>
                    <th className="aus-col-status">Estado</th>
                    <th className="aus-col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((u) => {
                    const meta = staffRoleMeta(u.role);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="aus-user-cell">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="aus-avatar" />
                            ) : (
                              <span className="aus-avatar aus-avatar--fallback">{initials(u.fullName, u.email)}</span>
                            )}
                            <div className="min-w-0">
                              <p className="aus-user-cell__name">{u.fullName || 'Sin nombre'}</p>
                              <p className="aus-user-cell__email">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`aus-role-badge aus-role-badge--${meta.tone}`}>{meta.label}</span>
                        </td>
                        <td className="aus-branch">{u.branchName}</td>
                        <td>
                          <span className={`aus-status ${u.isActive ? 'is-on' : 'is-off'}`}>
                            <i />
                            {u.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="aus-actions">
                          <div className="aus-menu-wrap">
                            <button
                              type="button"
                              className="aus-icon-btn"
                              onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                              aria-label="Acciones"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuId === u.id && (
                              <div className="aus-menu">
                                <button type="button" onClick={() => openEdit(u)}>
                                  <Pencil className="h-3.5 w-3.5" /> Editar
                                </button>
                                <button type="button" onClick={() => toggleActive(u)}>
                                  {u.isActive
                                    ? <><UserX className="h-3.5 w-3.5" /> Desactivar</>
                                    : <><UserCheck className="h-3.5 w-3.5" /> Activar</>}
                                </button>
                                <button type="button" onClick={() => { openEdit(u); updateField('password', ''); }}>
                                  <KeyRound className="h-3.5 w-3.5" /> Cambiar clave
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!pageRows.length && (
                    <tr>
                      <td colSpan={5} className="aus-empty">No hay usuarios con estos filtros</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="aus-pager">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let n = i + 1;
              if (totalPages > 5 && safePage > 3) n = Math.min(totalPages - 4, safePage - 2) + i;
              if (n < 1 || n > totalPages) return null;
              return (
                <button
                  key={n}
                  type="button"
                  className={n === safePage ? 'is-active' : ''}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              );
            })}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <aside className={`aus-panel ${panelOpen ? 'is-open' : ''}`}>
          <div className="aus-panel__head">
            <h2>{editing ? 'Editar Usuario' : 'Agregar Usuario'}</h2>
            <button type="button" className="aus-icon-btn" onClick={() => setPanelOpen(false)} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form className="aus-form" onSubmit={handleSave}>
            <label className="aus-avatar-upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickAvatar} hidden />
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="" />
              ) : (
                <span className="aus-avatar-upload__ph">
                  <Camera className="h-5 w-5" />
                </span>
              )}
              <span>Subir foto / JPG, PNG máximo 2MB</span>
            </label>

            <label className="aus-field">
              <span>Nombre completo</span>
              <input value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} required placeholder="Ej: María López" />
            </label>

            <label className="aus-field">
              <span>Correo electrónico</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required={!editing}
                disabled={!!editing}
                placeholder="usuario@el-pollon.cl"
              />
            </label>

            <label className="aus-field">
              <span>Teléfono (opcional)</span>
              <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+56 9 …" />
            </label>

            <label className="aus-field">
              <span>Usuario</span>
              <input
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                placeholder="nombre.usuario"
              />
            </label>

            <label className="aus-field">
              <span>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
              <div className="aus-pass">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required={!editing}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Ver contraseña">
                  {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </label>

            <label className="aus-field">
              <span>Confirmar contraseña</span>
              <div className="aus-pass">
                <input
                  type={showPass2 ? 'text' : 'password'}
                  value={form.password2}
                  onChange={(e) => updateField('password2', e.target.value)}
                  required={!editing || !!form.password}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass2((v) => !v)} aria-label="Ver contraseña">
                  {showPass2 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </label>

            <div className="aus-field">
              <span>Rol</span>
              <button
                type="button"
                className="aus-role-trigger"
                onClick={() => setRoleMenuOpen((v) => !v)}
              >
                <RoleIcon className="h-4 w-4 text-pollon-red" />
                <div className="min-w-0 text-left">
                  <strong>{selectedRole.label}</strong>
                  <small>{selectedRole.description}</small>
                </div>
              </button>
              {roleMenuOpen && (
                <ul className="aus-role-menu">
                  {assignableRoles.map((r) => {
                    const Icon = ROLE_ICONS[r.id] || Shield;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          className={form.role === r.id ? 'is-active' : ''}
                          onClick={() => { updateField('role', r.id); setRoleMenuOpen(false); }}
                        >
                          <Icon className="h-4 w-4" />
                          <div>
                            <strong>{r.label}</strong>
                            <small>{r.description}</small>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <label className="aus-field">
              <span>Sucursal</span>
              <select
                value={form.branchId}
                onChange={(e) => updateField('branchId', e.target.value)}
                required={form.role !== 'super_admin'}
                disabled={!isSuperAdmin && !!staffBranchId}
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <label className="aus-switch">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
              />
              <span className="aus-switch__track" />
              <span>Usuario activo</span>
            </label>

            <div className="aus-form__actions">
              <button type="button" className="aus-btn aus-btn--ghost" onClick={() => setPanelOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="aus-btn aus-btn--primary" disabled={saving}>
                {saving ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Guardar Usuario')}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
