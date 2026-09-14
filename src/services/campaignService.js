import { getSupabase } from './supabaseClient';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

export async function listCampaigns(branchId) {
  let q = sb().from('marketing_campaigns').select('*').order('created_at', { ascending: false });
  if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createCampaign(campaign, createdBy) {
  const { data, error } = await sb().from('marketing_campaigns').insert({
    title: campaign.title,
    subject: campaign.subject,
    message: campaign.message,
    campaign_type: campaign.campaignType || 'promotion',
    branch_id: campaign.branchId || null,
    created_by: createdBy,
    status: 'draft',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getCampaignRecipients(campaignId) {
  const { data, error } = await sb().from('campaign_recipients').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return data || [];
}

/** Prepara destinatarios según segmentación */
export async function prepareCampaignRecipients(campaignId, { branchId, minOrders = 0, acceptsEmailOnly = true }) {
  let q = sb().from('profiles').select(`
    id, email, full_name,
    customer_marketing_preferences(accepts_email_promotions)
  `).eq('role', 'cliente').not('email', 'is', null);

  const { data: customers, error } = await q;
  if (error) throw error;

  const recipients = [];
  for (const c of customers || []) {
    const prefs = c.customer_marketing_preferences?.[0];
    if (acceptsEmailOnly && !prefs?.accepts_email_promotions) continue;
    if (!c.email) continue;

    if (branchId && minOrders > 0) {
      const { count } = await sb()
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', c.id)
        .eq('branch_id', branchId);
      if ((count || 0) < minOrders) continue;
    }

    recipients.push({
      campaign_id: campaignId,
      customer_id: c.id,
      email: c.email,
      status: 'pending',
    });
  }

  if (recipients.length) {
    await sb().from('campaign_recipients').insert(recipients);
  }

  await sb().from('marketing_campaigns').update({
    status: 'scheduled',
  }).eq('id', campaignId);

  return recipients.length;
}

/** Marca campaña como enviada (integración email real vía Edge Function en el futuro) */
export async function markCampaignSent(campaignId) {
  const now = new Date().toISOString();
  await sb().from('campaign_recipients').update({ status: 'sent', sent_at: now }).eq('campaign_id', campaignId).eq('status', 'pending');
  const { data, error } = await sb().from('marketing_campaigns').update({ status: 'sent', sent_at: now }).eq('id', campaignId).select().single();
  if (error) throw error;
  return data;
}
