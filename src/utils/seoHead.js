import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SEO,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  buildCanonical,
  buildStructuredData,
  resolveRouteSeo,
} from '../config/seo';

const JSON_LD_ID = 'pollon-json-ld';

const OG_TAGS = [
  ['property', 'og:type'],
  ['property', 'og:locale'],
  ['property', 'og:site_name'],
  ['property', 'og:url'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:image'],
  ['name', 'twitter:card'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
  ['name', 'twitter:image'],
];

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(data) {
  let script = document.getElementById(JSON_LD_ID);
  if (!script) {
    script = document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Aplica title, meta, canonical, Open Graph y JSON-LD según la ruta actual.
 */
export function applyPageSeo({
  pathname,
  search = '',
  branchName = '',
  branchCity = '',
  categoryName = '',
  branches = [],
}) {
  const routeSeo = resolveRouteSeo(pathname, { branchName, branchCity, categoryName });
  const canonical = buildCanonical(pathname, search);
  const title = routeSeo.title || DEFAULT_SEO.title;
  const description = routeSeo.description || DEFAULT_SEO.description;
  const robots = routeSeo.robots || DEFAULT_SEO.robots;
  const keywords = routeSeo.keywords || DEFAULT_SEO.keywords;
  const ogType = routeSeo.ogType || DEFAULT_SEO.ogType;
  const ogImage = routeSeo.ogImage || DEFAULT_OG_IMAGE;

  document.title = title;

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('name', 'keywords', keywords);
  upsertMeta('name', 'author', SITE_NAME);
  upsertMeta('name', 'geo.region', 'CL-AP, CL-TA');
  upsertMeta('name', 'geo.placename', 'Arica, Iquique, Alto Hospicio');
  upsertMeta('name', 'language', 'Spanish');

  upsertLink('canonical', canonical);

  const ogValues = {
    'og:type': ogType,
    'og:locale': SITE_LOCALE,
    'og:site_name': SITE_NAME,
    'og:url': canonical,
    'og:title': title,
    'og:description': description,
    'og:image': ogImage,
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': ogImage,
  };

  OG_TAGS.forEach(([attr, key]) => {
    upsertMeta(attr, key, ogValues[key]);
  });

  upsertJsonLd(buildStructuredData({ pathname, branches }));
}
