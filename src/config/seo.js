/** Configuración SEO central — https://el-pollon.cl */
export const SITE_URL = 'https://el-pollon.cl';
export const SITE_NAME = 'Pollería El Pollón';
export const SITE_LOCALE = 'es_CL';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/img/logo.png`;

export const DEFAULT_KEYWORDS = [
  'pollo a la brasa',
  'pollería',
  'El Pollón',
  'delivery pollo',
  'pedidos online',
  'pollo a la brasa Arica',
  'pollo a la brasa Iquique',
  'pollería Alto Hospicio',
  'comida peruana',
  'delivery comida',
  'menú pollería',
].join(', ');

export const DEFAULT_SEO = {
  title: 'Pollería El Pollón | Pollo a la brasa, delivery y pedidos online',
  description:
    'Pollo a la brasa peruano en Arica, Iquique y Alto Hospicio. Pide online, delivery rápido, combos familiares y menú completo. El Pollón — el sabor del norte.',
  keywords: DEFAULT_KEYWORDS,
  robots: 'index, follow, max-image-preview:large',
  ogType: 'website',
};

/** Rutas que no deben indexarse */
export const NOINDEX_PATH_PREFIXES = ['/admin', '/cuenta', '/checkout', '/pedido'];

export const ROUTE_SEO = {
  '/': {
    title: 'Pollería El Pollón | Pollo a la brasa, delivery y pedidos online',
    description:
      'Pollo a la brasa peruano en Arica, Iquique y Alto Hospicio. Pide online, delivery rápido, combos familiares y menú completo. El Pollón — el sabor del norte.',
    keywords:
      'pollo a la brasa, pollería El Pollón, delivery Arica, delivery Iquique, pedidos online pollo, pollería peruana',
  },
  '/tienda': {
    title: 'Menú online | Pollería El Pollón — Pollo a la brasa y combos',
    description:
      'Explora el menú de El Pollón: pollo entero, combos familiares, chaufa, papas fritas y bebidas. Pide delivery o retiro en sucursal.',
    keywords:
      'menú pollería, combos pollo a la brasa, carta El Pollón, pedir pollo online, ofertas pollería',
  },
  '/sucursal': {
    title: 'Sucursales El Pollón | Arica, Iquique y Alto Hospicio',
    description:
      'Encuentra tu sucursal El Pollón más cercana. Horarios, dirección, delivery y retiro en Arica, Iquique y Alto Hospicio.',
    keywords:
      'sucursales El Pollón, pollería Arica, pollería Iquique, pollería Alto Hospicio, horarios El Pollón',
  },
  '/terminos': {
    title: 'Términos y condiciones | Pollería El Pollón',
    description:
      'Condiciones de uso del sitio web y pedidos online de Pollería El Pollón. Pagos, entregas, cancelaciones y políticas.',
    keywords: 'términos El Pollón, condiciones pedidos online',
    changefreq: 'yearly',
  },
  '/libro-reclamaciones': {
    title: 'Libro de reclamaciones | Pollería El Pollón',
    description:
      'Libro de reclamaciones virtual de Pollería El Pollón. Presenta quejas, reclamos o sugerencias conforme a la Ley 19.496.',
    keywords: 'libro reclamaciones El Pollón, reclamos consumidor Chile',
    changefreq: 'yearly',
  },
};

export function isNoIndexPath(pathname) {
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function buildCanonical(pathname, search = '') {
  const base = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '') || '/'}`;
  if (!search) return base === `${SITE_URL}/` ? `${SITE_URL}/` : base;

  const params = new URLSearchParams(search);
  const allowed = ['branch', 'cat'];
  const filtered = new URLSearchParams();
  allowed.forEach((key) => {
    const val = params.get(key);
    if (val) filtered.set(key, val);
  });
  const qs = filtered.toString();
  if (!qs) return base;
  return `${base}?${qs}`;
}

export function resolveRouteSeo(pathname, { branchName, branchCity, categoryName } = {}) {
  if (isNoIndexPath(pathname)) {
    return {
      ...DEFAULT_SEO,
      title: `${SITE_NAME} — Área privada`,
      description: DEFAULT_SEO.description,
      robots: 'noindex, nofollow',
      ogType: 'website',
    };
  }

  const base = ROUTE_SEO[pathname] || DEFAULT_SEO;

  if (pathname === '/tienda') {
    const place = branchCity || branchName || 'Arica e Iquique';
    const catPart = categoryName ? ` — ${categoryName}` : '';
    return {
      ...base,
      title: `Menú online${catPart} | El Pollón ${place}`,
      description: branchName
        ? `Menú y precios de ${branchName}. Pollo a la brasa, combos y delivery en ${place}. Pide online en El Pollón.`
        : base.description,
    };
  }

  if (pathname === '/sucursal' && branchCity) {
    return {
      ...base,
      description: `Sucursales El Pollón en ${branchCity} y más ciudades del norte. Elige tu local, horarios y delivery.`,
    };
  }

  return base;
}

/** Horario estándar para schema.org */
export const SCHEMA_OPENING_HOURS = 'Mo-Su 11:30-23:00';

export function branchToLocalBusinessSchema(branch) {
  if (!branch || branch.comingSoon) return null;

  const branchId = `${SITE_URL}/sucursal#${branch.slug || branch.id}`;

  return {
    '@type': 'Restaurant',
    '@id': branchId,
    name: branch.name,
    url: `${SITE_URL}/tienda?branch=${encodeURIComponent(branch.id)}`,
    telephone: branch.phone?.replace(/\s/g, '') || undefined,
    image: DEFAULT_OG_IMAGE,
    servesCuisine: ['Pollo a la brasa', 'Comida peruana'],
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.address || branch.city,
      addressLocality: branch.city,
      addressRegion: branch.city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá',
      addressCountry: 'CL',
    },
    openingHours: SCHEMA_OPENING_HOURS,
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    ...(branch.lat && branch.lng
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: branch.lat,
            longitude: branch.lng,
          },
        }
      : {}),
  };
}

export function buildStructuredData({ pathname, branches = [] }) {
  const activeBranches = branches.filter((b) => !b.comingSoon && b.isActive !== false);

  const organization = {
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: 'El Pollón',
    url: SITE_URL,
    logo: `${SITE_URL}/img/logo.png`,
    image: DEFAULT_OG_IMAGE,
    description: DEFAULT_SEO.description,
    servesCuisine: ['Pollo a la brasa', 'Comida peruana', 'Pollería'],
    priceRange: '$$',
    areaServed: [
      { '@type': 'City', name: 'Arica' },
      { '@type': 'City', name: 'Iquique' },
      { '@type': 'City', name: 'Alto Hospicio' },
    ],
    hasMenu: `${SITE_URL}/tienda`,
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/tienda`,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
    },
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: DEFAULT_SEO.description,
    inLanguage: 'es-CL',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/tienda?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const localBusinesses = activeBranches
    .map(branchToLocalBusinessSchema)
    .filter(Boolean);

  const breadcrumbs = buildBreadcrumbs(pathname);
  const graph = [website, organization, ...localBusinesses];
  if (breadcrumbs) graph.push(breadcrumbs);

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function buildBreadcrumbs(pathname) {
  const crumbs = [{ name: 'Inicio', path: '/' }];
  const map = {
    '/tienda': 'Menú online',
    '/sucursal': 'Sucursales',
    '/terminos': 'Términos y condiciones',
    '/libro-reclamaciones': 'Libro de reclamaciones',
  };

  if (!map[pathname]) return null;
  crumbs.push({ name: map[pathname], path: pathname });

  return {
    '@type': 'BreadcrumbList',
    '@id': `${SITE_URL}${pathname}#breadcrumb`,
    itemListElement: crumbs.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${item.path}`,
    })),
  };
}
