/**
 * Generates menu.json from TuMenuWeb_Catalogo_Productos.pdf (ChivitosPro).
 * Run: node scripts/generate-tumenu-catalog.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const IMG = '/logo.png'

function slug(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 56)
}

function opt(name, price) {
  return { id: slug(name), name, price }
}

function group(id, name, options, extra = {}) {
  return {
    id,
    name,
    required: !!extra.required,
    min: extra.min ?? (extra.required ? 1 : 0),
    max: extra.max ?? 1,
    allowQuantity: !!extra.allowQuantity,
    options: options.map(([n, p]) => opt(n, p)),
  }
}

function cloneGroups(...groups) {
  return groups.map((g) => structuredClone(g))
}

function item(id, name, price, description = '', modifiers = [], extra = {}) {
  return {
    id,
    name,
    description,
    price,
    image: IMG,
    available: true,
    featured: !!extra.featured,
    ...(extra.priceMax != null ? { priceMax: extra.priceMax } : {}),
    ...(modifiers.length ? { modifiers: cloneGroups(...modifiers) } : {}),
  }
}

// —— Modifier library (Parte 2) ——
const GUSTO = group(
  'gusto',
  'Gusto',
  [
    ['panceta', 40],
    ['panceta caramelizada', 50],
    ['Jamón', 30],
    ['queso cheddar x2', 50],
    ['muzzarella', 30],
    ['queso philadelphia', 40],
    ['Huevo', 30],
    ['Rúcula', 40],
    ['Cebolla cruda', 15],
    ['Cebolla salteada', 15],
    ['cebolla caramelizada', 25],
    ['lechuga', 10],
    ['tomate', 10],
    ['pepinillos', 20],
    ['Aceitunas', 20],
    ['Morrón', 30],
    ['2 aros de cebolla', 30],
    ['mayonesa', 10],
    ['ketchup', 10],
    ['salsa BBQ', 20],
    ['salsa Ranchera', 20],
    ['Salsa Sensación', 20],
    ['Criolla', 20],
    ['Salsa Crunch', 30],
  ],
  { required: false, min: 0, max: 23, allowQuantity: true },
)

const ENVASE = group('envase', 'Envase', [['no tengo', 30]], { required: false, min: 0, max: 1 })

const TIPOS = group('tipos', 'Tipos', [['Carne', 0], ['Pollo', 0]], {
  required: true,
  min: 1,
  max: 1,
})

const GUARNICIONES = group(
  'guarniciones',
  'Guarniciones',
  [
    ['Papas fritas', 0],
    ['Lechuga y tomate', 0],
    ['Ensalada rusa', 10],
    ['noisette', 30],
  ],
  { required: true, min: 1, max: 1 },
)

const BEBIDA_KIDS = group(
  'bebida-kids',
  'Bebida Kids',
  [
    ['Coca 250ml', 0],
    ['Fanta 250ml', 0],
    ['Agua 600ml', 0],
  ],
  { required: true, min: 1, max: 1 },
)

const GUARNICION = group(
  'guarnicion',
  'Guarnicion',
  [
    ['SIN GUARNICION', 0],
    ['AROS DE CEBOLLA', 80],
    ['PAPAS ONDULADAS', 80],
    ['ONDULADAS CHEDDAR', 130],
    ['ONDULADAS CHEDDAR PANCETA', 180],
  ],
  { required: true, min: 1, max: 1 },
)

const SALSA_POLLO = group(
  'salsa-pollo-frito',
  'Salsa Pollo Frito',
  [
    ['Salsa Limón', 0],
    ['Salsa BBQ', 0],
    ['Kétchup', 0],
    ['Mayonesa', 0],
    ['Salsa Sensación', 0],
    ['Salsa Ranchera', 0],
    ['Salsa Crunch', 0],
  ],
  { required: true, min: 1, max: 1 },
)

const CARNES_EXTRAS = group(
  'carnes-extras',
  'Carnes Extras',
  [
    ['sin carne extra', 0],
    ['Pollo CRISPY', 0],
    ['1 carne extra 120g', 100],
    ['2 carnes extras 120g', 150],
    ['3 carnes extras 120g', 210],
    ['4 carnes extras 120g', 270],
  ],
  { required: true, min: 1, max: 1 },
)

const EXTRAS = group(
  'extras',
  'extras',
  [
    ['SALSA', 80],
    ['MUZZARELLA', 100],
    ['CEBOLLA', 80],
    ['1 HUEVO', 50],
  ],
  { required: false, min: 0, max: 4, allowQuantity: true },
)

/** NO VERIFICADO en PDF — dips típicos de la carta, editables en admin */
const DIPS = group(
  'dips-salsas-extra',
  'DIPS SALSAS EXTRA',
  [
    ['Salsa Limón', 30],
    ['Salsa BBQ', 30],
    ['Mayonesa', 20],
    ['Kétchup', 20],
    ['Salsa Sensación', 30],
    ['Salsa Ranchera', 30],
    ['Salsa Crunch', 30],
  ],
  { required: false, min: 0, max: 10, allowQuantity: true },
)

const TIPO = group('tipo', 'Tipo', [['Carne', 0], ['Pollo CRISPY', 0]], {
  required: false,
  min: 0,
  max: 1,
})

const REFRESCOS_MED = group(
  'refrescos-medianos',
  'Refrescos Medianos',
  [
    ['LATA Coca Clasica 310ml', 100],
    ['LATA Coca Cero 310ml', 100],
    ['LATA Sprite 310ml', 100],
    ['LATA Pomelo 310ml', 100],
    ['LATA Coca Light 310ml', 100],
    ['Fanta 500ml', 130],
  ],
  { required: false, min: 0, max: 6, allowQuantity: true },
)

const REFRESCOS_GRANDES = group(
  'refrescos-grandes',
  'Refrescos Grandes',
  [
    ['Coca Clasica 1.5', 180],
    ['Coca Cero 1.5', 180],
    ['Fanta 1.5', 180],
    ['Sprite 1.5', 180],
    ['Pomelo Cero 1.5', 180],
  ],
  { required: false, min: 0, max: 5, allowQuantity: true },
)

/** NO VERIFICADO — espejo de Guarniciones para porciones dobles */
const GUARNICION_PARA_2 = group(
  'guarnicion-para-2',
  'Guarnicion para 2',
  [
    ['Papas fritas', 0],
    ['Lechuga y tomate', 0],
    ['Ensalada rusa', 20],
    ['noisette', 50],
  ],
  { required: true, min: 1, max: 1 },
)

const JUGUETE = group('juguete', 'Juguete', [['gomitas fini', 0]], {
  required: true,
  min: 1,
  max: 1,
})

/** PDF: pepperoni y jamón confirmados; resto no verificado */
const SABORES_PIZZA = group(
  'sabores-pizza',
  'sabores pizza',
  [
    ['pepperoni', 60],
    ['jamón', 60],
  ],
  { required: false, min: 0, max: 2, allowQuantity: true },
)

const SABOR_EMPANADA = group(
  'sabor-empanada',
  'sabor empanada',
  [
    ['mitad y mitad', 0],
    ['todas de carne', 0],
    ['todas de pollo', 0],
  ],
  { required: true, min: 1, max: 1 },
)

const BURGER_MODS = [GUARNICION, DIPS, REFRESCOS_MED]
const MILA_MED = [REFRESCOS_MED, REFRESCOS_GRANDES]
const VEG_MODS = [GUARNICION, REFRESCOS_MED]

const restaurant = {
  name: 'ChivitosPro',
  address: 'Salto, Uruguay 1802',
  city: 'Salto',
  country: 'Uruguay',
  open: true,
  distanceKm: 1.8,
  delivery: true,
  takeaway: true,
  currency: 'UYU',
  whatsapp: '59899000000',
  logo: '/logo.png',
  hero: '/hero.png',
  mapEmbed:
    'https://www.openstreetmap.org/export/embed.html?bbox=-57.99%2C-31.42%2C-57.93%2C-31.36&layer=mapnik&marker=-31.388%2C-57.960',
  lat: -31.388,
  lng: -57.96,
  hoursLabel: 'Mar–Jue 19:00–00:00 · Vie–Sáb 19:00–00:30 · Dom 19:00–23:50',
  etaMin: 35,
  etaMax: 55,
  deliveryFee: 80,
  minOrder: 250,
  phone: '',
}

const categories = [
  {
    id: 'pizza-muzzarella',
    name: 'PIZZA MUZZARELLA SABORES A ELECCIÓN',
    subtitle: 'Pizza de masa rectangular. Equivale a media pizza tradicional. Rinde para 1 persona.',
    banner: IMG,
    items: [
      item(
        'pizza-con-muzzarella',
        'Pizza con muzzarella',
        250,
        'Pizza rectangular de masa casera, con muzzarella premium. (Equivale a media pizza tradicional. Rinde para 1 persona).',
        [SABORES_PIZZA],
        { featured: true },
      ),
    ],
  },
  {
    id: 'empanadas',
    name: 'Empanadas',
    subtitle: '',
    banner: IMG,
    items: [
      item('6-empanadas-pollo-o-carne', '6 empanadas pollo o carne', 480, '', [SABOR_EMPANADA]),
      item('12-empanadas-pollo-o-carne', '12 empanadas pollo o carne', 840, '', [SABOR_EMPANADA]),
    ],
  },
  {
    id: 'crea-tu-hamburguesa',
    name: 'CREA TU HAMBURGUESA',
    subtitle:
      'Arma la propia hamburguesa a tu gusto. La base es de $170 (120 gramos de carne y un pan único); los demás gustos se suman por separado.',
    banner: IMG,
    items: [
      item(
        'la-propia',
        'LA PROPIA',
        170,
        'Preparala a tu gusto',
        [CARNES_EXTRAS, GUSTO, GUARNICION, REFRESCOS_MED],
        { featured: true },
      ),
    ],
  },
  {
    id: 'hamburguesas',
    name: 'Hamburguesas',
    subtitle: '100% carne premium.',
    banner: IMG,
    items: [
      item(
        'hamburguesa-crispy',
        'Hamburguesa Crispy',
        310,
        'Salsa de limón, lechuga, tomate, muzzarella, panceta y un espectacular pollo crispy.',
        BURGER_MODS,
      ),
      item(
        'bacon-crunch',
        'BACON CRUNCH',
        310,
        'Lechuga, tomate, queso cheddar, panceta y salsa BACON CRUNCH',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-criolla',
        'Hamburguesa CRIOLLA',
        280,
        'Carne premium, lechuga, tomate, queso muzzarella, salsa criolla, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-italiana',
        'Hamburguesa ITALIANA',
        330,
        'Carne premium, lechuga, rúcula, tomate confitado, queso philadelphia, jamón, mayonesa y kétchup',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-clasica',
        'Hamburguesa Clásica',
        250,
        'Carne premium, lechuga, tomate, mayonesa y kétchup Hellmans',
        BURGER_MODS,
        { featured: true },
      ),
      item(
        'hamburguesa-queso',
        'Hamburguesa Queso',
        250,
        'Carne premium, doble queso cheddar, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-queso-y-huevo',
        'Hamburguesa Queso y huevo',
        290,
        'Carne premium, doble queso cheddar, huevo, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-deliciosa',
        'Hamburguesa Deliciosa',
        290,
        'Carne premium, lechuga, tomate, queso cheddar, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-bacon-chesse',
        'Hamburguesa Bacon Chesse',
        300,
        'Carne premium, panceta, queso cheddar, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-completa',
        'Hamburguesa Completa',
        310,
        'Carne premium, lechuga, tomate, jamón, muzzarella, huevo, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-bacon',
        'Hamburguesa Bacon',
        310,
        'Carne premium, lechuga, tomate, panceta, cebolla salteada, queso cheddar, mayonesa y kétchup Hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-pepinillo',
        'Hamburguesa Pepinillo',
        280,
        'Carne premium, lechuga, cebolla cruda, queso cheddar, pepinillo, salsa de pepinillo de la casa',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-light',
        'Hamburguesa Light',
        310,
        'Pollo grill, lechuga, tomate, cebolla salteada, muzzarella, mayo y kétchup hellmans',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-ranchera',
        'Hamburguesa Ranchera',
        340,
        'Carne premium, doble cheddar, muzzarella, panceta, cebolla salteada, huevo y salsa ranch de la casa',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-ruta-66',
        'Hamburguesa Ruta 66',
        340,
        'Una carne premium, triple queso cheddar, triple panceta, cebolla cocida y salsa ranchera',
        BURGER_MODS,
      ),
      item(
        'big-pro-1-carne',
        'BIG PRO 1 CARNE',
        330,
        'Una carne premium, queso cheddar, panceta, lechuga, tomate, cebolla salteada, huevo y salsa ranchera',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-doble',
        'Hamburguesa Doble',
        370,
        'Doble carne premium, doble queso cheddar, panceta, mayonesa y kétchup hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-big-pro',
        'Hamburguesa BIG PRO',
        390,
        'Doble carne premium, doble queso cheddar, panceta, lechuga, tomate, cebolla salteada, huevo, mayonesa y kétchup hellmans.',
        BURGER_MODS,
        { featured: true },
      ),
      item(
        'hamburguesa-bacon-sweet',
        'Hamburguesa BACON SWEET',
        380,
        'Doble carne premium, doble cheddar, panceta y cebolla caramelizada, mayonesa y kétchup hellmans.',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-bbq',
        'Hamburguesa BBQ',
        370,
        'Doble carne premium, doble queso cheddar, panceta y salsa BBQ de la casa',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-ahumada-pro',
        'Hamburguesa AHUMADA PRO',
        380,
        'Doble carne premium, cheddar fundido, panceta, aros de cebolla, salsa ahumada y salsa dulce de mostaza de la casa',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-triple',
        'Hamburguesa TRIPLE',
        450,
        'Tres carnes premium, doble cheddar, panceta, mayonesa y kétchup hellmans',
        BURGER_MODS,
      ),
      item(
        'hamburguesa-super',
        'Hamburguesa SUPER',
        520,
        'Cuatro carnes premium, doble queso cheddar, panceta, mayonesa y kétchup hellmans',
        BURGER_MODS,
      ),
    ],
  },
  {
    id: 'chivitos-al-pan-y-al-plato',
    name: 'Chivitos al pan y al plato',
    subtitle: 'es simple, son ricos',
    banner: IMG,
    items: [],
  },
  {
    id: 'combo-kids',
    name: 'COMBO KIDS',
    subtitle: '',
    banner: IMG,
    items: [
      item(
        'combo-kids-hamburguesa',
        'COMBO KIDS HAMBURGUESA',
        370,
        'Una hamburguesa 100% carne, queso cheddar, papas fritas, bebida y sorpresa',
        [JUGUETE, BEBIDA_KIDS],
      ),
      item(
        'combo-kids-nuggets',
        'COMBO KIDS NUGGETS',
        370,
        '6 deliciosas nuggets de pollo, papas fritas, bebida y sorpresa',
        [JUGUETE, BEBIDA_KIDS],
      ),
    ],
  },
  {
    id: 'guarniciones',
    name: 'Guarniciones',
    subtitle: '',
    banner: IMG,
    items: [
      item('papas-onduladas', 'Papas ONDULADAS', 250, 'Deliciosas papas onduladas súper crujientes · Medianas'),
      item(
        'papas-onduladas-cheddar',
        'Papas ONDULADAS CHEDDAR',
        330,
        'Deliciosas papas onduladas súper crujientes · Medianas',
      ),
      item(
        'papas-onduladas-cheddar-y-panceta',
        'Papas ONDULADAS CHEDDAR Y PANCETA',
        390,
        'Con queso cheddar y panceta · Medianas',
      ),
      item(
        'papas-onduladas-con-huevo',
        'Papas ONDULADAS CON HUEVO',
        290,
        'Deliciosas papas onduladas súper crujientes · Medianas',
      ),
      item('aros-de-cebolla-10', 'Aros de Cebolla 10 unidades', 250, ''),
      item('noisettes', 'Noisettes', 250, 'Papas noisettes'),
      item('noisettes-con-cheddar-fundido', 'Noisettes con cheddar fundido', 300, ''),
      item('noisettes-con-cheddar-y-panceta', 'Noisettes con cheddar y panceta', 350, ''),
      item('rabas-10', 'Rabas', 290, 'Rabas por 10 unidades con limón'),
      item('nugetts-10', 'Nugetts de pollo · 10 nuggets', 250, ''),
      item('nugetts-20', 'Nugetts de pollo · 20 nuggets', 450, ''),
      item('nugetts-10-cheddar', 'Nugetts de pollo · 10 nuggets con cheddar', 300, ''),
      item(
        'papas-con-sabores-pro',
        'Papas con sabores Pro',
        500,
        'Papas fritas con muzzarella, panceta, jamón, cebolla y huevo a la plancha · 1 persona',
      ),
    ],
  },
  {
    id: 'milanesas',
    name: 'Milanesas',
    subtitle: 'Milanesas caseras.',
    banner: IMG,
    items: [
      item('milanesa-con-guarnicion', 'Milanesa con guarnición', 450, '', [
        GUARNICIONES,
        TIPOS,
        EXTRAS,
        DIPS,
        ...MILA_MED,
      ]),
      item(
        'milanesa-a-caballo-para-1',
        'Milanesa a caballo para 1',
        550,
        'Una deliciosa milanesa casera con dos huevos y deliciosas papas fritas',
        [TIPOS, GUARNICIONES, DIPS, ...MILA_MED],
      ),
      item(
        'milanesa-a-caballo-para-2',
        'Milanesa a caballo para 2',
        990,
        'Dos deliciosas milanesas caseras con dos huevos cada una y deliciosas papas fritas',
        [TIPOS, DIPS, GUARNICION_PARA_2, ...MILA_MED],
      ),
      item(
        'milanesa-napolitana-para-1',
        'Milanesa Napolitana para 1',
        590,
        'Milanesa con salsa, jamón, queso muzzarella y guarnición a elección',
        [TIPOS, GUARNICIONES, ...MILA_MED],
      ),
      item(
        'milanesa-napolitana-para-2',
        'Milanesa Napolitana para 2',
        1050,
        'Dos milanesas con salsa, jamón, queso muzzarella y guarnición a elección',
        [TIPOS, GUARNICION_PARA_2, ...MILA_MED],
      ),
      item(
        'milanesa-campesina-para-1',
        'Milanesa Campesina para 1',
        650,
        'Creación propia: milanesa con salsa BBQ, muzzarella, panceta caramelizada, cebolla caramelizada, dos huevos y papas',
        [TIPOS, GUARNICIONES, ...MILA_MED],
      ),
      item(
        'milanesa-campesina-para-2',
        'Milanesa Campesina para 2',
        1150,
        'Creación propia: dos milanesas con salsa BBQ, muzzarella, panceta caramelizada, cebolla caramelizada, dos huevos y papas',
        [TIPOS, GUARNICION_PARA_2, ...MILA_MED],
      ),
    ],
  },
  {
    id: 'chuleton',
    name: 'Chuletón con papas y huevo',
    subtitle: '',
    banner: IMG,
    items: [
      item(
        'chuleton-con-papas-y-huevo',
        'Chuletón con papas y huevo',
        530,
        'Un espectacular chuletón de ternera acompañado de papas corte casero, lechuga, tomate y un huevo a la plancha',
        MILA_MED,
      ),
    ],
  },
  {
    id: 'pollo-frito-american-style',
    name: 'Pollo Frito AMERICAN STYLE',
    subtitle: 'Pollo frito acompañado de papas fritas y salsa de limón o BBQ.',
    banner: IMG,
    items: [
      item(
        'pollo-frito',
        'Pollo Frito',
        480,
        'Pollo frito acompañado de papas fritas y salsa de limón o BBQ',
        [SALSA_POLLO, DIPS, REFRESCOS_MED],
      ),
    ],
  },
  {
    id: 'picada-para-2',
    name: 'PICADA PARA 2 PERSONAS',
    subtitle: '',
    banner: IMG,
    items: [
      item(
        'picada-para-2-personas',
        'PICADA PARA 2 PERSONAS',
        890,
        'Rabas, aros de cebolla, papas fritas con cheddar, nuggets, noisettes, milanesa picada, salsa bbq, salsa de limón y ketchup.',
        MILA_MED,
        { featured: true },
      ),
      item(
        'picada-para-2-personas-clasica',
        'PICADA PARA 2 PERSONAS CLASICA',
        650,
        'Rabas, aros de cebolla, papas fritas con cheddar, nuggets, noisettes, mayonesa y ketchup.',
        MILA_MED,
      ),
    ],
  },
  {
    id: 'vegetarianos',
    name: 'VEGETARIANOS',
    subtitle: 'Hamburguesas y chivitos, elaboración a base de legumbres y verduras.',
    banner: IMG,
    items: [
      item(
        'hamburguesa-vegetariana-queso',
        'Hamburguesa vegetariana queso',
        210,
        'Queso cheddar, mayonesa y kétchup',
        VEG_MODS,
      ),
      item(
        'hamburguesa-vegetariana-queso-y-huevo',
        'Hamburguesa vegetariana queso y huevo',
        250,
        'Queso cheddar, huevo a la plancha, mayonesa y kétchup',
        VEG_MODS,
      ),
      item(
        'hamburguesa-vegetariana-completa',
        'Hamburguesa vegetariana Completa',
        270,
        'Lechuga, cebolla salteada, tomate, muzzarella, huevo a la plancha, mayonesa y kétchup',
        VEG_MODS,
      ),
      item(
        'hamburguesa-vegetariana-ranch',
        'Hamburguesa vegetariana Ranch',
        280,
        'Doble cheddar, muzzarella, huevo a la plancha, cebolla salteada, salsa ranch de la casa',
        VEG_MODS,
      ),
      item(
        'chivitopro-vegetariano',
        'ChivitoPro VEGETARIANO',
        370,
        'Preparado Pro, muzzarella, cebolla salteada, aceitunas, morrón, huevo a la plancha, lechuga, tomate, mayonesa',
        VEG_MODS,
      ),
    ],
  },
  {
    id: 'sandwiches',
    name: 'Sandwiches',
    subtitle: '',
    banner: IMG,
    items: [
      item('sandwich-caliente', 'Sandwich caliente', 250, '', MILA_MED),
      item('sandwich-con-muzzarella', 'Sandwich con muzzarella', 330, '', MILA_MED),
    ],
  },
  {
    id: 'ensaladas',
    name: 'Ensaladas',
    subtitle: '',
    banner: IMG,
    items: [
      item(
        'ensaladapro-pollo',
        'EnsaladaPro Pollo',
        450,
        'Pollo Grill con muzzarella, cebolla salteada, lechuga, tomate, zanahoria rallada y aceitunas.',
        [REFRESCOS_MED],
      ),
    ],
  },
  {
    id: 'helados-dely',
    name: 'HELADOS DELY',
    subtitle: 'Paletas artesanales.',
    banner: IMG,
    items: [
      item('dely-dulce-de-leche-chocolate', 'Dulce de leche rellena de chocolate', 98, 'Paletas artesanales'),
      item('dely-flan-ddl', 'Flan relleno de dulce de leche', 98, 'Paletas artesanales'),
      item('dely-chocolate-ddl', 'Chocolate rellena de dulce de leche', 98, 'Paletas artesanales'),
      item('dely-chesscake-frutilla', 'Chesscake rellena de frutilla', 98, 'Paletas artesanales'),
      item('dely-menta-chocolate', 'Menta rellena de chocolate', 98, 'Paletas artesanales'),
      item('dely-ferrero', 'Ferrero', 98, 'Paletas artesanales'),
      item('dely-mantecol', 'Mantecol', 98, 'Paletas artesanales'),
      item('dely-naranja-chocolate', 'Naranja bañada de chocolate', 98, 'Paletas artesanales'),
    ],
  },
  {
    id: 'refrescos',
    name: 'Refrescos',
    subtitle:
      'Los refrescos individuales se ofrecen como opcionales (Refrescos Medianos / Grandes) en los productos de comida.',
    banner: IMG,
    items: [],
  },
  {
    id: 'cervezas',
    name: 'Cervezas',
    subtitle: '',
    banner: IMG,
    items: [
      item('stella-artois', 'Stella Artois', 290, '', [ENVASE]),
      item('patricia-1l', 'Patricia 1L', 260, '', [ENVASE]),
      item('heineken-1l', 'Heineken 1L', 290, ''),
      item('schneider-1l', 'Schneider 1L', 250, ''),
      item('corona-330', 'Corona 330', 130, ''),
      item('lata-patrici-473', 'Lata Patrici 473', 150, ''),
      item('lata-pilsen', 'Lata Pilsen', 150, ''),
      item('heineken-lata', 'Heineken Lata', 170, ''),
      item('schneider-lata', 'Schneider Lata', 150, ''),
    ],
  },
  {
    id: 'dr-lemon',
    name: 'Dr. Lemon',
    subtitle: '',
    banner: IMG,
    items: [
      item('dr-lemon-mojito-473', 'Dr. Lemon Mojito 473cc', 175, ''),
      item('dr-lemon-limon', 'Dr. Lemon Limon', 175, ''),
      item('dr-lemon-vodka-pomelo', 'Dr. Lemon Vodka Pomelo', 175, ''),
      item('dr-lemon-coctel-de-limon', 'Dr. Lemon Coctel de Limon', 175, ''),
    ],
  },
]

const menu = { restaurant, categories }

const productCount = categories.reduce((n, c) => n + c.items.length, 0)
const outBackend = join(root, 'backend/data/menu.json')
const outSrc = join(root, 'src/data/menu.json')
if (!existsSync(dirname(outBackend))) mkdirSync(dirname(outBackend), { recursive: true })

const json = JSON.stringify(menu, null, 2)
writeFileSync(outBackend, json, 'utf8')
writeFileSync(outSrc, json, 'utf8')

console.log(`Wrote ${categories.length} categories, ${productCount} products`)
console.log(`→ ${outBackend}`)
console.log(`→ ${outSrc}`)
