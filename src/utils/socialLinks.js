/** Normaliza URL de red social (acepta usuario o URL completa). */
export function normalizeSocialUrl(raw, platform) {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) return value;

  const handle = value.replace(/^@/, '').replace(/\s+/g, '');

  switch (platform) {
    case 'facebook':
      if (handle.includes('facebook.com')) return `https://${handle.replace(/^\/\//, '')}`;
      return `https://facebook.com/${handle}`;
    case 'instagram':
      if (handle.includes('instagram.com')) return `https://${handle.replace(/^\/\//, '')}`;
      return `https://instagram.com/${handle}`;
    case 'tiktok':
      if (handle.includes('tiktok.com')) return `https://${handle.replace(/^\/\//, '')}`;
      return `https://tiktok.com/@${handle.replace(/^@/, '')}`;
    default:
      return value.startsWith('http') ? value : `https://${value}`;
  }
}

export function getBranchSocialLinks(branch) {
  if (!branch) return [];
  return [
    { id: 'facebook', label: 'Facebook', url: normalizeSocialUrl(branch.facebookUrl, 'facebook') },
    { id: 'instagram', label: 'Instagram', url: normalizeSocialUrl(branch.instagramUrl, 'instagram') },
    { id: 'tiktok', label: 'TikTok', url: normalizeSocialUrl(branch.tiktokUrl, 'tiktok') },
  ].filter((item) => item.url);
}
