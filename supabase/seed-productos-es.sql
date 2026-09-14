-- Seed productos — ejecutar después de schema-es.sql



INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton mas chaufa', 'Pollo entero, papas fritas, arroz chaufa, ensalada y bebidas 1.5lt.', 25500,
  c.id, 'img/ofertas familiares.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton c/ fideos al pesto + ensalada', 'Pollo entero, papas fritas, fideos al pesto, ensalada y bebidas 1.5lt.', 25500,
  c.id, 'img/todo el menu.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton con fideos al pesto pura papa', 'Pollo entero, papas fritas, fideos al pesto, extra papa frita y bebida 1.5lt.', 25500,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton mas chaufa pura papa', 'Pollo entero, papas fritas, extra papa frita, arroz chaufa y bebidas 1.5lt.', 25500,
  c.id, 'img/oferton mas chaufa pura papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton c/ fideos al pesto', 'Pollo entero, papas fritas, fideos al pesto y bebidas 1.5lt', 24500,
  c.id, 'img/oferton con fideo.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton sin ensalada', 'Pollo entero, papas fritas, arroz chaufa y bebidas 1.5lt', 24500,
  c.id, 'img/oferton sin ensalada.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton pura papa', 'Pollo entero, papas fritas, 1/2 porcion de papa frita y bebidas 1.5lt', 24500,
  c.id, 'img/oferton pura papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'oferton familiar', 'Pollo entero, papas fritas, ensalada y bebidas 1.5lt', 23500,
  c.id, 'img/oferton familiar.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Oferton solo ensalada', 'Pollo entero, 2  ensaladas familiar y bebida 1.5lt.', 23500,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-familiares'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 combo con fideo al pesto', 'Medio pollo, papas fritas, fideos al pesto', 16800,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-dos'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 combo chaufa', 'Medio pollo, papas fritas, arroz chaufa', 16100,
  c.id, 'img/medio combo chaufa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-dos'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 combo', 'Medio pollo, papas fritas, ensalada personal', 15600,
  c.id, 'img/medio combo.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-dos'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 combo pura papa', 'Medio pollo, papas fritas mas cantidad,', 15600,
  c.id, 'img/medio combo pura papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-dos'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 pollo solo ensalada', 'Medio pollo, ensalada familiar', 15600,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-dos'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chaufa brasa c/ papa + ensalada', '1/4 pollo, arroz chaufa, papas fritas personales y ensalada personal', 10500,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 combo', '1/4 pollo, papas fritas personales, ensalada personal', 8400,
  c.id, 'img/personal combo.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 combo pura papa', '1/4 pollo, papas fritas personales mas cantidad.', 8400,
  c.id, 'img/personal pura papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chaufa brasa', '1/4 pollo, arroz chaufa', 8500,
  c.id, 'img/chaufa brasa.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 de pollo c/ fideos al pesto', '1/4 pollo, fideos al pesto', 8400,
  c.id, 'img/personal pesto con pollo.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chaufa brasa c/ ensalada', '1/4 pollo, arroz chaufa y ensalada personal', 9500,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chaufa brasa c/ papa', '1/4 pollo, papas fritas personal, arroz chaufa', 9500,
  c.id, 'img/chaufa brasa con papas fritas.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 de pollo c/ fideos + papa', '1/4 pollo, papas fritas, fideos al pesto', 9600,
  c.id, 'img/personal con papa y fideo 01.png', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 de pollo solo ensalada', '1/4 pollo + 1 ensalada familiar', 8400,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'ofertas-personales'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Lomo saltado de carne c/ chaufa', '', 12500,
  c.id, 'img/lomo saltado con arroz chaufa.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Saltado de pollo c/ arroz chaufa', '', 12500,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Lomo saltado de carne con arroz blanco ', '', 12000,
  c.id, 'img/lomo saltado de carne con arroz blanco.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Lomo saltado de pollo con arroz blanco', '', 12000,
  c.id, 'img/lomo saltado de pollo con arroz blanco.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Tallarin saltado de carne', '', 12000,
  c.id, 'img/tallarin saltado de carne 01.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Tallarin saltado de pollo', '', 12000,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Bistec a lo pobre', '', 11000,
  c.id, 'img/bistec a lo pobre.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Bistec a lo pobre c/ chaufa', '', 11300,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Bistec con fideos al pesto', '', 11000,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chuleta de cerdo', '', 11000,
  c.id, 'img/chuleta de cerdo.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Chuleta de cerdo c/ chaufa', '', 11300,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Pechuga a la plancha', '', 10500,
  c.id, 'img/pechuga a la plancha.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Combo nuggets', '', 7000,
  c.id, 'img/nugget.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Salchipapas', '', 7000,
  c.id, 'img/salchipapa.png', 99, true, false
FROM categorias c WHERE c.slug = 'platos-extras'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1 Pollo entero solo', '1 pollo entero', 16000,
  c.id, 'img/pollo solo.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 Pollo solo', ' 1/2 pollo  -  parte truto y pechuga', 10400,
  c.id, 'img/medio pollo solo.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/4 pollo solo', '1/4 de polo -- truto o pechuga ---segun el stock', 6100,
  c.id, '', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Porcion de papas fritas familiar', 'Porción grande de papas crujientes', 9500,
  c.id, 'img/porcion de papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT '1/2 porcion de papas fritas', 'Media Porción  de papas crujientes', 6400,
  c.id, 'img/media porcion papa.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Porcion de arroz chaufa', '1 Porción de arroz chaufa', 5500,
  c.id, 'img/porcion arroz chaufa.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Porcion de fideos al pesto', '1 Porción de fideos al pesto', 5500,
  c.id, 'img/porcion de fideo.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Porcion de ensalada familiar', 'Ensalada surtida - familiar ', 5700,
  c.id, 'img/ensalada familiar.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Porcion de ensalada personal', 'Ensalada surtida - personal', 3800,
  c.id, 'img/ensalada personal.png', 99, true, false
FROM categorias c WHERE c.slug = 'agregados'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Coca Cola', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/coca cola.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Coca Cola Cero', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/coca cola cero.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Inca Kola', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/inca kola.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Fanta', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/fanta.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Sprite', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/sprite.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Sprite Cero', 'Bebida 1.5L (según stock).', 4000,
  c.id, 'img/sprite cero.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Agua Sin Gas', 'Benedictino de 500 ml. (según stock).', 1200,
  c.id, 'img/agua sin gas.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Agua Con Gas', 'Benedictino de 500 ml. (según stock).', 1200,
  c.id, 'img/agua con gas.png', 99, true, false
FROM categorias c WHERE c.slug = 'bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Aluza CT5', 'Envase descartable Aluza CT5.', 300,
  c.id, 'img/aluza ct5.png', 99, true, false
FROM categorias c WHERE c.slug = 'descartables'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Aluza CT3', 'Envase descartable Aluza CT3.', 400,
  c.id, 'img/aluza ct3.png', 99, true, false
FROM categorias c WHERE c.slug = 'descartables'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Tenedor descartable', 'Tenedor y cuchillo plástico descartable.', 200,
  c.id, 'img/servicio descartable.png', 99, true, false
FROM categorias c WHERE c.slug = 'descartables'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Bolsa ecológica', 'Bolsa ecológica (unidad).', 200,
  c.id, 'img/bolsa ecologica.png', 99, true, false
FROM categorias c WHERE c.slug = 'descartables'
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible, destacado)
SELECT 'Vaso descartable', 'vaso de 10 oz (unidad).', 50,
  c.id, 'img/vaso.png', 99, true, false
FROM categorias c WHERE c.slug = 'descartables'
ON CONFLICT DO NOTHING;