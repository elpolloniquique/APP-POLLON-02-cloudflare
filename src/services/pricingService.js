import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  DEFAULT_DELIVERY_ZONES,
  normalizeZones,
  quoteFromZones,
} from '../utils/deliveryZones';

const DEMO_RULE = {
  id: 'demo-tiers-iquique',
  name: 'Tarifas por kilómetro',
  rule_type: 'tiers',
  base_fee: 0,
  per_km_fee: 0,
  min_fee: 0,
  max_fee: null,
  is_active: true,
  priority: 100,
  branch_id: null,
  tiers: DEFAULT_DELIVERY_ZONES,
  updated_at: new Date().toISOString(),
};

export async function listPricingRules(branchId = null) {
  if (!isSupabaseConfigured()) {
    return [DEMO_RULE];
  }
  const sb = getSupabase();
  let q = sb.from('ep_pricing_rules').select('*').order('priority', { ascending: false });
  if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Regla activa de tramos (tiers) para la sucursal, o null */
export async function getActiveTiersRule(branchId = null) {
  const rules = await listPricingRules(branchId);
  const tiersRules = rules.filter((r) => r.is_active !== false && r.rule_type === 'tiers');
  const forBranch = branchId
    ? tiersRules.find((r) => r.branch_id === branchId)
    : null;
  const global = tiersRules.find((r) => !r.branch_id);
  const rule = forBranch || global || tiersRules[0] || null;
  if (!rule) return null;
  return {
    ...rule,
    tiers: normalizeZones(rule.tiers?.length ? rule.tiers : DEFAULT_DELIVERY_ZONES),
  };
}

/** Zonas activas (siempre con fallback demo) */
export async function getBranchDeliveryZones(branchId = null) {
  try {
    const rule = await getActiveTiersRule(branchId);
    if (rule?.tiers?.length) return { rule, zones: rule.tiers, source: 'db' };
  } catch {
    /* demo */
  }
  return { rule: DEMO_RULE, zones: DEFAULT_DELIVERY_ZONES, source: 'demo' };
}

/**
 * Guarda (crea/actualiza) la regla de tramos de la sucursal.
 * Una sola regla `tiers` activa por branch.
 */
export async function saveBranchDeliveryZones({ branchId, zones, ruleId, name = 'Tarifas por kilómetro', isActive = true }) {
  const tiers = normalizeZones(zones);
  if (!tiers.length) throw new Error('Debes configurar al menos una zona');

  const payload = {
    name,
    rule_type: 'tiers',
    base_fee: 0,
    per_km_fee: 0,
    min_fee: 0,
    max_fee: null,
    is_active: isActive !== false,
    priority: 100,
    branch_id: branchId || null,
    tiers,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    return { ...DEMO_RULE, ...payload, id: ruleId || DEMO_RULE.id, tiers };
  }

  const sb = getSupabase();

  if (ruleId && !String(ruleId).startsWith('demo-')) {
    const { data, error } = await sb
      .from('ep_pricing_rules')
      .update(payload)
      .eq('id', ruleId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Reutilizar regla tiers existente de la sucursal
  const existing = await getActiveTiersRule(branchId);
  if (existing?.id && !String(existing.id).startsWith('demo-')) {
    const { data, error } = await sb
      .from('ep_pricing_rules')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await sb.from('ep_pricing_rules').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function savePricingRule(rule) {
  if (!isSupabaseConfigured()) return rule;
  const sb = getSupabase();
  const payload = {
    name: rule.name,
    rule_type: rule.rule_type,
    base_fee: Number(rule.base_fee) || 0,
    per_km_fee: Number(rule.per_km_fee) || 0,
    min_fee: Number(rule.min_fee) || 0,
    max_fee: rule.max_fee != null && rule.max_fee !== '' ? Number(rule.max_fee) : null,
    is_active: rule.is_active !== false,
    priority: Number(rule.priority) || 0,
    branch_id: rule.branch_id || null,
    tiers: rule.tiers || [],
    updated_at: new Date().toISOString(),
  };
  if (rule.id && !String(rule.id).startsWith('demo-')) {
    const { data, error } = await sb.from('ep_pricing_rules').update(payload).eq('id', rule.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb.from('ep_pricing_rules').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deletePricingRule(id) {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const { error } = await sb.from('ep_pricing_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function setTiersRuleActive(ruleId, isActive) {
  if (!isSupabaseConfigured()) return;
  if (!ruleId || String(ruleId).startsWith('demo-')) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('ep_pricing_rules')
    .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
    .eq('id', ruleId);
  if (error) throw error;
}

/**
 * Cotiza delivery por distancia (km).
 * Preferencia: cálculo local con tiers; fallback RPC; fallback demo.
 */
export async function quoteDelivery(branchId, distanceKm) {
  const km = Math.max(0, Number(distanceKm) || 0);

  try {
    const { zones, rule } = await getBranchDeliveryZones(branchId);
    const local = quoteFromZones(zones, km);
    if (!local.outOfRange) {
      return {
        fee: local.fee,
        distance_km: km,
        rule_id: rule?.id || null,
        rule_name: rule?.name || 'Tarifas por kilómetro',
        zone: local.zone,
        out_of_range: false,
        max_km: local.maxKm,
      };
    }
    if (zones.length) {
      return {
        fee: 0,
        distance_km: km,
        rule_id: rule?.id || null,
        rule_name: rule?.name || 'Tarifas por kilómetro',
        zone: null,
        out_of_range: true,
        max_km: local.maxKm,
      };
    }
  } catch {
    /* try RPC */
  }

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc('ep_quote_delivery', {
        p_branch_id: branchId,
        p_distance_km: km,
      });
      if (!error && data) {
        return {
          fee: Number(data.fee) || 0,
          distance_km: Number(data.distance_km) || km,
          rule_id: data.rule_id,
          rule_name: data.rule_name,
          zone: data.zone || null,
          out_of_range: !!data.out_of_range,
          max_km: data.max_km != null ? Number(data.max_km) : null,
        };
      }
    } catch {
      /* demo */
    }
  }

  const demo = quoteFromZones(DEFAULT_DELIVERY_ZONES, km);
  return {
    fee: demo.fee,
    distance_km: km,
    rule_id: DEMO_RULE.id,
    rule_name: DEMO_RULE.name,
    zone: demo.zone,
    out_of_range: demo.outOfRange,
    max_km: demo.maxKm,
  };
}

export function simulateLocalQuote(rule, distanceKm) {
  if (rule?.rule_type === 'tiers' || rule?.tiers?.length) {
    return quoteFromZones(rule.tiers || [], distanceKm).fee;
  }
  const km = Math.max(0, Number(distanceKm) || 0);
  let fee = Number(rule.base_fee) || 0;
  if (rule.rule_type === 'per_km') {
    fee += Math.round(km * (Number(rule.per_km_fee) || 0));
  }
  fee = Math.max(fee, Number(rule.min_fee) || 0);
  if (rule.max_fee != null && rule.max_fee !== '') fee = Math.min(fee, Number(rule.max_fee));
  return fee;
}
