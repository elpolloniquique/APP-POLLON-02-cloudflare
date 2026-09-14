/** Menú local de respaldo si Supabase no está configurado */
export const FALLBACK_PRODUCTS = {
  "ofertas-familiares": [
    { name: "Oferton mas chaufa", description: "Pollo entero, papas fritas, arroz chaufa, ensalada y bebidas 1.5lt.", price: 25500, image: "img/ofertas familiares.png" },
    { name: "Oferton c/ fideos al pesto + ensalada", description: "Pollo entero, papas fritas, fideos al pesto, ensalada y bebidas 1.5lt.", price: 25500, image: "img/todo el menu.png" },
    { name: "Oferton con fideos al pesto pura papa", description: "Pollo entero, papas fritas, fideos al pesto, extra papa frita y bebida 1.5lt.", price: 25500, image: "" },
    { name: "Oferton mas chaufa pura papa", description: "Pollo entero, papas fritas, extra papa frita, arroz chaufa y bebidas 1.5lt.", price: 25500, image: "img/oferton mas chaufa pura papa.png" },
    { name: "Oferton c/ fideos al pesto", description: "Pollo entero, papas fritas, fideos al pesto y bebidas 1.5lt", price: 24500, image:"img/oferton con fideo.png" },
    { name: "Oferton sin ensalada", description: "Pollo entero, papas fritas, arroz chaufa y bebidas 1.5lt", price: 24500, image: "img/oferton sin ensalada.png" },
    { name: "Oferton pura papa", description: "Pollo entero, papas fritas, 1/2 porcion de papa frita y bebidas 1.5lt", price: 24500, image: "img/oferton pura papa.png" },
    { name: "oferton familiar", description: "Pollo entero, papas fritas, ensalada y bebidas 1.5lt", price: 23500, image: "img/oferton familiar.png" },
    { name: "Oferton solo ensalada", description: "Pollo entero, 2  ensaladas familiar y bebida 1.5lt.", price: 23500, image: "" }
    
  ],
  "ofertas-dos": [
    { name: "1/2 combo con fideo al pesto", description: "Medio pollo, papas fritas, fideos al pesto", price: 16800, image: "" },
    { name: "1/2 combo chaufa", description: "Medio pollo, papas fritas, arroz chaufa", price: 16100, image: "img/medio combo chaufa.png" },
    { name: "1/2 combo", description: "Medio pollo, papas fritas, ensalada personal", price: 15600, image: "img/medio combo.png" },
    { name: "1/2 combo pura papa", description: "Medio pollo, papas fritas mas cantidad,", price: 15600, image: "img/medio combo pura papa.png" },
    { name: "1/2 pollo solo ensalada", description: "Medio pollo, ensalada familiar", price: 15600, image: "" }
  ],
  "ofertas-personales": [
    { name: "Chaufa brasa c/ papa + ensalada", description: "1/4 pollo, arroz chaufa, papas fritas personales y ensalada personal", price: 10500, image: "" },
    { name: "1/4 combo", description: "1/4 pollo, papas fritas personales, ensalada personal", price: 8400, image: "img/personal combo.png" },
    { name: "1/4 combo pura papa", description: "1/4 pollo, papas fritas personales mas cantidad.", price: 8400, image: "img/personal pura papa.png" },
    { name: "Chaufa brasa", description: "1/4 pollo, arroz chaufa", price: 8500, image: "img/chaufa brasa.png" },
    { name: "1/4 de pollo c/ fideos al pesto", description: "1/4 pollo, fideos al pesto", price: 8400, image: "img/personal pesto con pollo.png" },
    { name: "Chaufa brasa c/ ensalada", description: "1/4 pollo, arroz chaufa y ensalada personal", price: 9500, image: "" },
    { name: "Chaufa brasa c/ papa", description: "1/4 pollo, papas fritas personal, arroz chaufa", price: 9500, image: "img/chaufa brasa con papas fritas.png" },
    { name: "1/4 de pollo c/ fideos + papa", description: "1/4 pollo, papas fritas, fideos al pesto", price: 9600, image: "img/personal con papa y fideo 01.png" },
    { name: "1/4 de pollo solo ensalada", description: "1/4 pollo + 1 ensalada familiar", price: 8400, image: "" }
  ],
  "platos-extras": [
    { name: "Lomo saltado de carne c/ chaufa", description: "", price: 12500, image: "img/lomo saltado con arroz chaufa.png" },
    { name: "Saltado de pollo c/ arroz chaufa", description: "", price: 12500, image: "" },
    { name: "Lomo saltado de carne con arroz blanco ", description: "", price: 12000, image: "img/lomo saltado de carne con arroz blanco.png" },
    { name: "Lomo saltado de pollo con arroz blanco", description: "", price: 12000, image: "img/lomo saltado de pollo con arroz blanco.png" },
    { name: "Tallarin saltado de carne", description: "", price: 12000, image: "img/tallarin saltado de carne 01.png" },
    { name: "Tallarin saltado de pollo", description: "", price: 12000, image: "" },
    { name: "Bistec a lo pobre", description: "", price: 11000, image: "img/bistec a lo pobre.png" },
    { name: "Bistec a lo pobre c/ chaufa", description: "", price: 11300, image: "" },
    { name: "Bistec con fideos al pesto", description: "", price: 11000, image: "" },
    { name: "Chuleta de cerdo", description: "", price: 11000, image: "img/chuleta de cerdo.png" },
    { name: "Chuleta de cerdo c/ chaufa", description: "", price: 11300, image: "" },
    { name: "Pechuga a la plancha", description: "", price: 10500, image: "img/pechuga a la plancha.png" },
    { name: "Combo nuggets", description: "", price: 7000, image: "img/nugget.png" },
    { name: "Salchipapas", description: "", price: 7000, image: "img/salchipapa.png" }
  ],
  "agregados": [
    { name: "1 Pollo entero solo", description: "1 pollo entero", price: 16000, image: "img/pollo solo.png" },
    { name: "1/2 Pollo solo", description: " 1/2 pollo  -  parte truto y pechuga", price: 10400, image: "img/medio pollo solo.png" },
    { name: "1/4 pollo solo", description: "1/4 de polo -- truto o pechuga ---segun el stock", price: 6100, image: "" },
    { name: "Porcion de papas fritas familiar", description: "Porción grande de papas crujientes", price: 9500, image: "img/porcion de papa.png" },
    { name: "1/2 porcion de papas fritas", description: "Media Porción  de papas crujientes", price: 6400, image: "img/media porcion papa.png" },
    { name: "Porcion de arroz chaufa", description: "1 Porción de arroz chaufa", price: 5500, image: "img/porcion arroz chaufa.png" },
    { name: "Porcion de fideos al pesto", description: "1 Porción de fideos al pesto", price: 5500, image: "img/porcion de fideo.png" },
    { name: "Porcion de ensalada familiar", description: "Ensalada surtida - familiar ", price: 5700, image: "img/ensalada familiar.png" },
    { name: "Porcion de ensalada personal", description: "Ensalada surtida - personal", price: 3800, image: "img/ensalada personal.png" }
  ],

  "bebidas": [
    { name: "Coca Cola", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/coca cola.png" },
    { name: "Coca Cola Cero", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/coca cola cero.png" },
    { name: "Inca Kola", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/inca kola.png" },
    { name: "Fanta", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/fanta.png" },
    { name: "Sprite", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/sprite.png" },
    { name: "Sprite Cero", description: "Bebida 1.5L (según stock).", price: 4000, image: "img/sprite cero.png" },
    { name: "Agua Sin Gas", description: "Benedictino de 500 ml. (según stock).", price: 1200, image: "img/agua sin gas.png" },
    { name: "Agua Con Gas", description: "Benedictino de 500 ml. (según stock).", price: 1200, image: "img/agua con gas.png" }
  ],

  "descartables": [
    { name: "Aluza CT5", description: "Envase descartable Aluza CT5.", price: 300, image: "img/aluza ct5.png" },
    { name: "Aluza CT3", description: "Envase descartable Aluza CT3.", price: 400, image: "img/aluza ct3.png" },
    { name: "Tenedor descartable", description: "Tenedor y cuchillo plástico descartable.", price: 200, image: "img/servicio descartable.png" },
    { name: "Bolsa ecológica", description: "Bolsa ecológica (unidad).", price: 200, image: "img/bolsa ecologica.png" },
    { name: "Vaso descartable", description: "vaso de 10 oz (unidad).", price: 50, image: "img/vaso.png" }
  ]

};
