import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { getSupabase, isSupabaseConfigured } from '../services/supabaseClient';
import {
  getSession,
  getProfileByAuthIdSafe,
  profileFromAuthUser,
  getLegacySession,
  signIn as authSignIn,
  signUpCustomer,
  signOut as authSignOut,
  resetPassword,
  hasPermission,
  isStaffRole,
  isCustomerRole,
  isDriverRole,
  normalizeRole,
  canAccessBranch,
} from '../services/authService';
import { CUSTOMER_SESSION_KEY } from '../utils/constants';

const AuthContext = createContext(null);
const STAFF_PROFILE_CACHE_KEY = 'ep_staff_profile_v1';

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function getCustomerLocal() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStaffProfileCache() {
  try {
    // localStorage sobrevive a cerrar la APK / apagar el teléfono; sessionStorage no.
    const raw = localStorage.getItem(STAFF_PROFILE_CACHE_KEY)
      || sessionStorage.getItem(STAFF_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const role = normalizeRole(p?.rol || p?.role);
    if (!isStaffRole(role) && !isDriverRole(role)) return null;
    return p;
  } catch {
    return null;
  }
}

function writeStaffProfileCache(profile) {
  try {
    if (!profile) {
      localStorage.removeItem(STAFF_PROFILE_CACHE_KEY);
      sessionStorage.removeItem(STAFF_PROFILE_CACHE_KEY);
      return;
    }
    const role = normalizeRole(profile?.rol || profile?.role);
    if (isStaffRole(role) || isDriverRole(role)) {
      const raw = JSON.stringify(profile);
      localStorage.setItem(STAFF_PROFILE_CACHE_KEY, raw);
      sessionStorage.removeItem(STAFF_PROFILE_CACHE_KEY);
    } else {
      localStorage.removeItem(STAFF_PROFILE_CACHE_KEY);
      sessionStorage.removeItem(STAFF_PROFILE_CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

function roleOf(profile) {
  return normalizeRole(profile?.rol || profile?.role);
}

/** Si ya teníamos staff/delivery, no degradar a cliente por timeout/red lenta. */
function shouldKeepCachedStaff(existing, incoming) {
  const prev = roleOf(existing);
  if (!isStaffRole(prev) && !isDriverRole(prev)) return false;
  if (!incoming) return true;
  const next = roleOf(incoming);
  if (next === 'cliente' || (!isStaffRole(next) && !isDriverRole(next))) return true;
  return false;
}

export function AuthProvider({ children }) {
  const cachedBoot = readStaffProfileCache();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(() => cachedBoot);
  const [loading, setLoading] = useState(true);
  const profileUserIdRef = useRef(cachedBoot?.authUserId || null);
  const profileCacheRef = useRef(cachedBoot);
  const bootDoneRef = useRef(false);

  const refreshProfile = useCallback(async (user, { force = false } = {}) => {
    if (!user) {
      setProfile(null);
      profileUserIdRef.current = null;
      profileCacheRef.current = null;
      writeStaffProfileCache(null);
      return null;
    }
    if (
      !force
      && profileUserIdRef.current === user.id
      && profileCacheRef.current
      && (isStaffRole(roleOf(profileCacheRef.current)) || isDriverRole(roleOf(profileCacheRef.current)))
    ) {
      setProfile(profileCacheRef.current);
      return profileCacheRef.current;
    }

    const existing = profileCacheRef.current || readStaffProfileCache();
    let p = null;
    try {
      p = await getProfileByAuthIdSafe(user.id, user, isNativeApp() ? 20000 : 12000);
    } catch (err) {
      console.warn('[Pollón] boot profile:', err);
    }

    let resolved = (p?.role && p.role !== 'cliente')
      ? p
      : (p || profileFromAuthUser(user));

    if (!force && shouldKeepCachedStaff(existing, resolved)) {
      resolved = existing;
    }

    profileUserIdRef.current = user.id;
    profileCacheRef.current = resolved;
    setProfile(resolved);
    writeStaffProfileCache(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const finishBoot = async (s) => {
      if (cancelled) return;
      if (bootDoneRef.current) {
        if (s?.user) {
          setSession(s);
          try {
            await refreshProfile(s.user);
          } catch (err) {
            console.warn('[Pollón] late boot profile:', err);
          }
        }
        return;
      }
      bootDoneRef.current = true;
      setSession(s || null);
      if (s?.user) {
        try {
          await refreshProfile(s.user);
        } catch (err) {
          console.warn('[Pollón] boot profile:', err);
        }
      }
      if (!cancelled) setLoading(false);
    };

    const customerLocal = getCustomerLocal();
    if (customerLocal?.session) {
      setSession(customerLocal.session);
      setProfile(customerLocal.profile);
      setLoading(false);
      bootDoneRef.current = true;
      return undefined;
    }

    const legacy = getLegacySession();
    if (legacy?.session) {
      setSession(legacy.session);
      setProfile(legacy.profile);
      writeStaffProfileCache(legacy.profile);
      setLoading(false);
      bootDoneRef.current = true;
      return undefined;
    }

    // NO poner loading=false solo por caché: sin session el gate nativo
    // mostraba login/blank mientras Supabase aún restauraba la sesión.

    getSession()
      .then((s) => finishBoot(s))
      .catch((err) => {
        console.warn('[Pollón] getSession:', err?.message || err);
        finishBoot(null);
      });

    const sb = getSupabase();
    if (!sb) return undefined;

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;

      if (!s?.user) {
        if (event === 'SIGNED_OUT' && !getLegacySession() && !getCustomerLocal()) {
          setSession(null);
          setProfile(null);
          profileUserIdRef.current = null;
          profileCacheRef.current = null;
          writeStaffProfileCache(null);
        }
        if (event === 'INITIAL_SESSION' && !bootDoneRef.current) {
          finishBoot(null);
        }
        return;
      }

      if (event === 'INITIAL_SESSION') {
        finishBoot(s);
        return;
      }

      setSession(s);
      setTimeout(() => {
        refreshProfile(s.user).catch((err) => console.warn('[Pollón] auth state profile:', err));
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = async (email, password) => {
    const result = await authSignIn(email, password);
    if (result?.legacy) {
      setSession(result.session);
      setProfile(result.profile);
      writeStaffProfileCache(result.profile);
      profileCacheRef.current = result.profile;
      return { session: result.session, profile: result.profile };
    }
    const s = result?.session;
    const user = result?.user ?? s?.user;
    if (!s || !user) throw new Error('No se pudo iniciar sesión. Revisa email y contraseña.');
    setSession(s);
    profileUserIdRef.current = null;
    profileCacheRef.current = null;
    const p = await getProfileByAuthIdSafe(user.id, user);
    const existing = readStaffProfileCache();
    const resolved = (shouldKeepCachedStaff(existing, p) && isDriverRole(roleOf(existing)))
      ? existing
      : p;
    setProfile(resolved);
    writeStaffProfileCache(resolved);
    profileUserIdRef.current = user.id;
    profileCacheRef.current = resolved;
    return { session: s, profile: resolved };
  };

  const signUp = async (data) => {
    const result = await signUpCustomer(data);
    if (result?.legacy) {
      setSession(result.session);
      setProfile(result.profile);
      return result;
    }
    if (result?.session) {
      setSession(result.session);
      if (result.session.user) await refreshProfile(result.session.user);
    }
    return result;
  };

  const signOut = async () => {
    await authSignOut();
    setSession(null);
    setProfile(null);
    profileUserIdRef.current = null;
    profileCacheRef.current = null;
    writeStaffProfileCache(null);
  };

  const requestPasswordReset = (email) => resetPassword(email);

  const role = normalizeRole(profile?.rol || profile?.role);
  const user = session?.user || null;
  const isStaff = session && (session.legacy && !session.customer) ? isStaffRole(role) : (profile ? isStaffRole(role) : false);
  const isCustomer = profile ? isCustomerRole(role) : (session?.customer === true);
  const isAuthenticated = !!session;

  const can = useCallback((perm) => {
    if (!session || !isStaff) return false;
    return hasPermission(role, perm);
  }, [session, isStaff, role]);

  const canAccessBranchCb = useCallback(
    (branchId) => canAccessBranch(profile, branchId),
    [profile],
  );

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    can,
    canAccessBranch: canAccessBranchCb,
    isConfigured: isSupabaseConfigured(),
    role,
    isStaff,
    isCustomer,
    isAuthenticated,
  }), [
    session,
    user,
    profile,
    loading,
    can,
    canAccessBranchCb,
    role,
    isStaff,
    isCustomer,
    isAuthenticated,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
