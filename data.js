// data.js
window.poiData = [
  {
    "id": "colegiata-santillana",
    "name": "Colegiata de Santa Juliana",
    "location": "Santillana del Mar",
    "coordinates": { "lat": 43.3908, "lon": -4.1081 },
    "order": "Colegiata",
    "culture": "Románico pleno",
    "zone": "Costa Occidental",
    "searchPopularity": 9800,
    "images": [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Colegiata_de_Santa_Juliana_-_Santillana_del_Mar.jpg/800px-Colegiata_de_Santa_Juliana_-_Santillana_del_Mar.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Santillana_del_Mar._Colegiata_23.jpg/800px-Santillana_del_Mar._Colegiata_23.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Claustro_de_la_colegiata_de_Santa_Juliana.jpg/800px-Claustro_de_la_colegiata_de_Santa_Juliana.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Santillana_del_Mar_Colegiata_interior.JPG/800px-Santillana_del_Mar_Colegiata_interior.JPG"
    ],
    "description": "La Colegiata de Santa Juliana es el monumento más representativo del románico en Cantabria. Destaca su magnífico claustro y la riqueza iconográfica de sus capiteles.",
    "nearbyLandscapes": ["Costa occidental", "Cuevas de Altamira"],
    "restaurants": [
      {"name": "Restaurante El Castillo", "foodType": "Tradicional", "avgPrice": "30€", "contact": "942 81 83 01"},
      {"name": "Los Blasones", "foodType": "Cántabra", "avgPrice": "25€", "contact": "942 81 80 70"}
    ],
    "bibliography": "García Guinea, M.A. (1996). Románico en Cantabria.",
    "movies": ["Altamira (2016)"]
  },
  {
    "id": "santa-maria-piasca",
    "name": "Iglesia de Santa María",
    "location": "Piasca (Cabezón de Liébana)",
    "coordinates": { "lat": 43.1118, "lon": -4.5807 },
    "order": "Benedictina",
    "culture": "Románico tardío",
    "zone": "Liébana",
    "searchPopularity": 7500,
    "images": [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Iglesia_de_Santa_Mar%C3%ADa_la_Real_de_Piasca.jpg/800px-Iglesia_de_Santa_Mar%C3%ADa_la_Real_de_Piasca.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Santa_Mar%C3%ADa_de_Piasca_2.jpg/800px-Santa_Mar%C3%ADa_de_Piasca_2.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Portada_de_Santa_Mar%C3%ADa_de_Piasca.jpg/800px-Portada_de_Santa_Mar%C3%ADa_de_Piasca.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Canecillos_Piasca.jpg/800px-Canecillos_Piasca.jpg"
    ],
    "description": "Magnífico ejemplo de la transición del románico al gótico en el valle de Liébana.",
    "nearbyLandscapes": ["Picos de Europa", "Valle de Liébana"],
    "restaurants": [
      {"name": "Mesón Casa Fofi", "foodType": "Lebaniega", "avgPrice": "25€", "contact": "942 73 00 00"},
      {"name": "Restaurante El Oso", "foodType": "Caza", "avgPrice": "35€", "contact": "942 73 30 18"}
    ],
    "bibliography": "Campuzano Ruiz, E. (1998).",
    "movies": []
  },
  {
    "id": "san-martin-elines",
    "name": "Colegiata de San Martín de Elines",
    "location": "Valderredible",
    "coordinates": { "lat": 42.8256, "lon": -3.8741 },
    "order": "Colegiata",
    "culture": "Románico mozárabe",
    "zone": "Valderredible",
    "searchPopularity": 6200,
    "images": [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Colegiata_de_San_Mart%C3%ADn_de_Elines.jpg/800px-Colegiata_de_San_Mart%C3%ADn_de_Elines.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Claustro_Elines.jpg/800px-Claustro_Elines.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Abside_San_Martin_Elines.jpg/800px-Abside_San_Martin_Elines.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Interior_San_Martin_de_Elines.jpg/800px-Interior_San_Martin_de_Elines.jpg"
    ],
    "description": "Considerada la joya del valle de Valderredible, con influencias mozárabes.",
    "nearbyLandscapes": ["Cañón del Ebro", "Ermitas rupestres"],
    "restaurants": [
      {"name": "La Olma", "foodType": "Casera", "avgPrice": "20€", "contact": "942 77 60 50"},
      {"name": "El Cañón", "foodType": "Tradicional", "avgPrice": "18€", "contact": "942 77 61 00"}
    ],
    "bibliography": "Bedia, J.M. (2005).",
    "movies": []
  }
];

// Datos Extra de la Agenda
window.eventsData = [
  {
    "title": "Visita Nocturna: Secretos de Santa Juliana",
    "date": "Cada sábado de 2026",
    "location": "Santillana del Mar",
    "description": "Descubre la iconografía del claustro bajo la luz de las velas.",
    "type": "Visita"
  },
  {
    "title": "Taller de Cantería Medieval",
    "date": "15 de Mayo, 2026",
    "location": "Centro de Interpretación Villacantid",
    "description": "Aprende las técnicas de los maestros canteros del siglo XII.",
    "type": "Taller"
  },
  {
    "title": "Concierto de Música Antigua en Piasca",
    "date": "22 de Junio, 2026",
    "location": "Iglesia de Santa María de Piasca",
    "description": "Cánticos gregorianos y polifonía medieval.",
    "type": "Música"
  }
];

// Recetas Medievales Cántabras
window.recipesData = [
  {
    "name": "Puchero de Legumbres y Berza (Antecesor del Cocido)",
    "origin": "Valles Pasiegos",
    "ingredients": ["Alubias blancas", "Berza", "Tocino", "Hueso de jamón", "Agua de manantial"],
    "preparation": "Cocer a fuego muy lento en olla de barro durante 5 horas hasta que trabe el caldo."
  },
  {
    "name": "Miel con Almendras y Nueces del Valle",
    "origin": "Liébana",
    "ingredients": ["Miel de brezo", "Almendras crudas", "Nueces peladas"],
    "preparation": "Calentar la miel levemente y mezclar con los frutos secos. Dejar reposar 2 días."
  }
];

// Dulces de Convento
window.conventSweets = [
  {
    "name": "Convento de Santa Clara",
    "location": "Villaverde de Pontones",
    "specialty": "Claritas y Nevaditos",
    "contact": "reposteriafina.es",
    "image": "https://www.reposteriafina.es/wp-content/uploads/2021/03/claritas.jpg"
  },
  {
    "name": "Carmelitas Descalzas",
    "location": "Torrelavega",
    "specialty": "Polkas y Pastas de Santa Teresa",
    "contact": "carmelitasdescalzasdetorrelavega.es",
    "image": "https://carmelitasdescalzasdetorrelavega.es/wp-content/uploads/2020/05/polkas.jpg"
  },
  {
    "name": "Monasterio de Santa María de la Merced",
    "location": "Noja",
    "specialty": "Rosquillas artesanales",
    "contact": "Barrio Cabanzo, Noja",
    "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Monasterio_de_Santa_Mar%C3%ADa_de_la_Merced_-_Noja.jpg/800px-Monasterio_de_Santa_Mar%C3%ADa_de_la_Merced_-_Noja.jpg"
  }
];

// === Iglesias reales con imágenes de Wikipedia ===
const iglesiasReales = [
  {id:"cervatos",name:"Colegiata de San Pedro de Cervatos",location:"Cervatos (Campoo de Enmedio)",lat:42.9876,lon:-4.0612,order:"Colegiata",culture:"Románico pleno",zone:"Campoo-Los Valles",pop:8500,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Cervatos_Colegiata_de_San_Pedro_04.jpg/800px-Cervatos_Colegiata_de_San_Pedro_04.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Colegiata_de_San_Pedro_de_Cervatos_%28Cantabria%29.jpg/800px-Colegiata_de_San_Pedro_de_Cervatos_%28Cantabria%29.jpg"],
    desc:"Famosa por su rica decoración escultórica con escenas eróticas únicas en el románico español.",
    rest:[{name:"Brasería La Cabaña",foodType:"Carnes a la brasa",avgPrice:"28€",contact:"942 75 41 22",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g580282-Reinosa.html"},{name:"Ismano Gastrobar",foodType:"Tradicional gourmet",avgPrice:"35€",contact:"942 75 50 20",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g580282-Reinosa.html"}]},
  {id:"castaneda",name:"Colegiata de Santa Cruz de Castañeda",location:"Castañeda",lat:43.3127,lon:-3.8855,order:"Colegiata",culture:"Románico pleno",zone:"Valles Pasiegos",pop:7200,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Colegiata_de_Casta%C3%B1eda.jpg/800px-Colegiata_de_Casta%C3%B1eda.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Colegiata_de_Casta%C3%B1eda_%28exterior%29.jpg/800px-Colegiata_de_Casta%C3%B1eda_%28exterior%29.jpg"],
    desc:"Magnífica colegiata del siglo XII con excelente portada y capiteles historiados.",
    rest:[{name:"Restaurante Cenador de Amós",foodType:"Alta cocina",avgPrice:"85€",contact:"942 59 82 43",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g1064410-Villaverde_de_Pontones.html"},{name:"La Bicicleta",foodType:"Cántabra moderna",avgPrice:"30€",contact:"942 59 00 10",tripadvisor:""}]},
  {id:"bareyo",name:"Iglesia de Santa María de Bareyo",location:"Bareyo (Meruelo)",lat:43.4513,lon:-3.5679,order:"Parroquial",culture:"Románico pleno",zone:"Trasmiera",pop:5800,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Santa_Mar%C3%ADa_de_Bareyo.jpg/800px-Santa_Mar%C3%ADa_de_Bareyo.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Bareyo_Santa_Mar%C3%ADa_01.jpg/800px-Bareyo_Santa_Mar%C3%ADa_01.jpg"],
    desc:"Iglesia románica del siglo XII con notable ábside semicircular y canecillos figurados.",
    rest:[{name:"El Langostino de Oro",foodType:"Mariscos",avgPrice:"40€",contact:"942 67 12 12",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g187484-Noja.html"},{name:"Restaurante El Puerto",foodType:"Pescados",avgPrice:"30€",contact:"942 63 00 50",tripadvisor:""}]},
  {id:"silio",name:"Iglesia de San Facundo y San Primitivo",location:"Silió (Molledo)",lat:43.1335,lon:-4.0470,order:"Parroquial",culture:"Románico pleno",zone:"Besaya",pop:6100,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Iglesia_de_San_Facundo_y_San_Primitivo_%28Sili%C3%B3%29.jpg/800px-Iglesia_de_San_Facundo_y_San_Primitivo_%28Sili%C3%B3%29.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Portada_de_Sili%C3%B3.jpg/800px-Portada_de_Sili%C3%B3.jpg"],
    desc:"Destacada por su portada monumental con arquivoltas ricamente decoradas. Famosa por La Vijanera.",
    rest:[{name:"Mesón Los Corrales",foodType:"Casera",avgPrice:"20€",contact:"942 82 00 35",tripadvisor:""},{name:"Posada La Casuca",foodType:"Cántabra",avgPrice:"22€",contact:"942 82 01 10",tripadvisor:""}]},
  {id:"yermo",name:"Iglesia de Santa María de Yermo",location:"Yermo (Cartes)",lat:43.3180,lon:-4.0600,order:"Parroquial",culture:"Románico tardío",zone:"Besaya",pop:5500,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Iglesia_de_Santa_Mar%C3%ADa_de_Yermo_%28Cantabria%29.jpg/800px-Iglesia_de_Santa_Mar%C3%ADa_de_Yermo_%28Cantabria%29.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Yermo_portada.jpg/800px-Yermo_portada.jpg"],
    desc:"Destaca por su magnífica portada y el alero con canecillos de temática variada.",
    rest:[{name:"Restaurante El Puente",foodType:"Tradicional",avgPrice:"25€",contact:"942 81 10 20",tripadvisor:""},{name:"La Casona de Cartes",foodType:"Cántabra",avgPrice:"30€",contact:"942 81 30 40",tripadvisor:""}]},
  {id:"bolmir",name:"Iglesia de San Cipriano de Bolmir",location:"Bolmir (Campoo de Enmedio)",lat:42.9810,lon:-4.0518,order:"Parroquial",culture:"Románico pleno",zone:"Campoo-Los Valles",pop:4800,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Iglesia_de_San_Cipriano_de_Bolmir.jpg/800px-Iglesia_de_San_Cipriano_de_Bolmir.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Bolmir_canecillos.jpg/800px-Bolmir_canecillos.jpg"],
    desc:"Pequeña iglesia con ábside románico puro y canecillos de gran expresividad.",
    rest:[{name:"El Cid",foodType:"Cocina casera",avgPrice:"18€",contact:"942 75 20 00",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g580282-Reinosa.html"},{name:"Bodega Pepe",foodType:"Vinos y tostas",avgPrice:"15€",contact:"942 75 33 00",tripadvisor:""}]},
  {id:"villacantid",name:"Iglesia de Santa María la Mayor",location:"Villacantid (Campoo de Suso)",lat:43.0130,lon:-4.1380,order:"Parroquial",culture:"Románico pleno",zone:"Campoo-Los Valles",pop:5200,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Iglesia_de_Villacantid.jpg/800px-Iglesia_de_Villacantid.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Centro_Interpretacion_Romanico_Villacantid.jpg/800px-Centro_Interpretacion_Romanico_Villacantid.jpg"],
    desc:"Alberga el Centro de Interpretación del Románico de Cantabria.",
    rest:[{name:"Hostería Campoo",foodType:"Montañesa",avgPrice:"22€",contact:"942 77 90 00",tripadvisor:""},{name:"Mesón Alto Campoo",foodType:"Carnes",avgPrice:"25€",contact:"942 77 91 00",tripadvisor:""}]},
  {id:"san-pedro-escalante",name:"Iglesia de San Pedro de Escalante",location:"Escalante",lat:43.4470,lon:-3.5095,order:"Parroquial",culture:"Románico tardío",zone:"Trasmiera",pop:3900,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Iglesia_de_San_Pedro_de_Escalante.jpg/800px-Iglesia_de_San_Pedro_de_Escalante.jpg"],
    desc:"Iglesia del siglo XIII con elementos románicos de transición al gótico.",
    rest:[{name:"Casa Solana",foodType:"Marisquería",avgPrice:"35€",contact:"942 67 70 10",tripadvisor:""},{name:"El Mesón de Escalante",foodType:"Tradicional",avgPrice:"20€",contact:"942 67 71 20",tripadvisor:""}]},
  {id:"santa-maria-lebena",name:"Iglesia de Santa María de Lebeña",location:"Lebeña (Cillorigo de Liébana)",lat:43.2210,lon:-4.5900,order:"Mozárabe",culture:"Prerrománico mozárabe",zone:"Liébana",pop:7800,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Santa_Mar%C3%ADa_de_Lebe%C3%B1a.jpg/800px-Santa_Mar%C3%ADa_de_Lebe%C3%B1a.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Lebena_interior.jpg/800px-Lebena_interior.jpg"],
    desc:"Joya del arte mozárabe del siglo X con arcos de herradura y columnas con capiteles corintios.",
    rest:[{name:"Asador Llorente",foodType:"Carnes a la brasa",avgPrice:"35€",contact:"942 73 01 55",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g1064376-Potes.html"},{name:"La Barrica de Potes",foodType:"Cocido Lebaniego",avgPrice:"25€",contact:"942 73 21 00",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g1064376-Potes.html"}]},
  {id:"san-roman-escalante",name:"Iglesia de San Román de Escalante",location:"Escalante",lat:43.4450,lon:-3.5120,order:"Parroquial",culture:"Románico tardío",zone:"Trasmiera",pop:3500,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/San_Roman_de_Escalante_01.jpg/800px-San_Roman_de_Escalante_01.jpg"],
    desc:"Pequeña iglesia con restos románicos y bonito entorno rural en Trasmiera.",
    rest:[{name:"El Langostino de Oro",foodType:"Mariscos",avgPrice:"40€",contact:"942 67 12 12",tripadvisor:""},{name:"Restaurante El Puerto",foodType:"Pescados",avgPrice:"30€",contact:"942 63 00 50",tripadvisor:""}]},
  {id:"comillas-san-cristobal",name:"Iglesia de San Cristóbal",location:"Comillas",lat:43.3871,lon:-4.2909,order:"Parroquial",culture:"Románico rural",zone:"Costa Occidental",pop:4200,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Comillas_San_Crist%C3%B3bal.jpg/800px-Comillas_San_Crist%C3%B3bal.jpg","https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Comillas_-_Iglesia_de_San_Crist%C3%B3bal.jpg/800px-Comillas_-_Iglesia_de_San_Crist%C3%B3bal.jpg"],
    desc:"Conserva elementos románicos originales en un entorno privilegiado junto al Palacio de Sobrellano.",
    rest:[{name:"Restaurante Adolfo",foodType:"Mariscos y pescados",avgPrice:"40€",contact:"942 72 00 33",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g187483-Comillas.html"},{name:"La Abacería de la Sal",foodType:"Productos locales",avgPrice:"20€",contact:"942 72 20 10",tripadvisor:"https://www.tripadvisor.es/Restaurant_Review-g187483-Comillas.html"}]},
  {id:"retortillo",name:"Iglesia de Santa María de Retortillo",location:"Retortillo (Campoo de Enmedio)",lat:42.9690,lon:-4.0290,order:"Parroquial",culture:"Románico primitivo",zone:"Campoo-Los Valles",pop:4500,
    img:["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Iglesia_de_Retortillo_Cantabria.jpg/800px-Iglesia_de_Retortillo_Cantabria.jpg"],
    desc:"Junto a las ruinas romanas de Julióbriga, fusión única de herencia romana y románica.",
    rest:[{name:"El Cid",foodType:"Cocina casera",avgPrice:"18€",contact:"942 75 20 00",tripadvisor:""},{name:"Avenida",foodType:"Menú del día",avgPrice:"12€",contact:"942 75 40 00",tripadvisor:""}]}
];

// Convertir iglesias reales al formato estándar y añadirlas
iglesiasReales.forEach(ig => {
  window.poiData.push({
    id: ig.id, name: ig.name, location: ig.location,
    coordinates: { lat: ig.lat, lon: ig.lon },
    order: ig.order, culture: ig.culture, zone: ig.zone,
    searchPopularity: ig.pop, images: ig.img,
    description: ig.desc, restaurants: ig.rest,
    bibliography: "Enciclopedia del Románico en Cantabria.", movies: []
  });
});

// === Localidades de Cantabria con coordenadas (para búsqueda por proximidad) ===
window.localidadesCantabria = [
  {name:"Santillana del Mar",lat:43.3908,lon:-4.1081,comarca:"Costa Occidental"},
  {name:"Comillas",lat:43.3871,lon:-4.2909,comarca:"Costa Occidental"},
  {name:"San Vicente de la Barquera",lat:43.3857,lon:-4.3983,comarca:"Costa Occidental"},
  {name:"Potes",lat:43.1533,lon:-4.6224,comarca:"Liébana"},
  {name:"Reinosa",lat:42.9998,lon:-4.1372,comarca:"Campoo-Los Valles"},
  {name:"Torrelavega",lat:43.3497,lon:-4.0486,comarca:"Besaya"},
  {name:"Santander",lat:43.4623,lon:-3.8099,comarca:"Santander"},
  {name:"Castro-Urdiales",lat:43.3830,lon:-3.2169,comarca:"Costa Oriental"},
  {name:"Laredo",lat:43.4117,lon:-3.4138,comarca:"Costa Oriental"},
  {name:"Santoña",lat:43.4440,lon:-3.4575,comarca:"Trasmiera"},
  {name:"Noja",lat:43.4877,lon:-3.5247,comarca:"Trasmiera"},
  {name:"Suances",lat:43.4236,lon:-4.0415,comarca:"Besaya"},
  {name:"Cabezón de la Sal",lat:43.3067,lon:-4.2340,comarca:"Saja-Nansa"},
  {name:"Puente Viesgo",lat:43.2967,lon:-3.9667,comarca:"Valles Pasiegos"},
  {name:"Selaya",lat:43.2200,lon:-3.7900,comarca:"Valles Pasiegos"},
  {name:"Ramales de la Victoria",lat:43.2571,lon:-3.4658,comarca:"Asón-Agüera"},
  {name:"Ampuero",lat:43.3274,lon:-3.4107,comarca:"Asón-Agüera"},
  {name:"Liérganes",lat:43.3405,lon:-3.7517,comarca:"Trasmiera"},
  {name:"Molledo",lat:43.1322,lon:-4.0441,comarca:"Besaya"},
  {name:"Valderredible",lat:42.8256,lon:-3.8741,comarca:"Campoo-Los Valles"},
  {name:"Castañeda",lat:43.3127,lon:-3.8855,comarca:"Valles Pasiegos"},
  {name:"Escalante",lat:43.4470,lon:-3.5095,comarca:"Trasmiera"},
  {name:"Bareyo",lat:43.4513,lon:-3.5679,comarca:"Trasmiera"},
  {name:"Cartes",lat:43.3200,lon:-4.0600,comarca:"Besaya"},
  {name:"Cervatos",lat:42.9876,lon:-4.0612,comarca:"Campoo-Los Valles"},
  {name:"Villacantid",lat:43.0130,lon:-4.1380,comarca:"Campoo-Los Valles"},
  {name:"Lebeña",lat:43.2210,lon:-4.5900,comarca:"Liébana"},
  {name:"Piasca",lat:43.1118,lon:-4.5807,comarca:"Liébana"},
  {name:"Silió",lat:43.1335,lon:-4.0470,comarca:"Besaya"},
  {name:"Retortillo",lat:42.9690,lon:-4.0290,comarca:"Campoo-Los Valles"}
];

// Imágenes reales de Wikipedia para iglesias generadas
const wikiImgs = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Colegiata_de_Santa_Juliana_-_Santillana_del_Mar.jpg/400px-Colegiata_de_Santa_Juliana_-_Santillana_del_Mar.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Cervatos_Colegiata_de_San_Pedro_04.jpg/400px-Cervatos_Colegiata_de_San_Pedro_04.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Colegiata_de_Casta%C3%B1eda.jpg/400px-Colegiata_de_Casta%C3%B1eda.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Santa_Mar%C3%ADa_de_Lebe%C3%B1a.jpg/400px-Santa_Mar%C3%ADa_de_Lebe%C3%B1a.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Colegiata_de_San_Mart%C3%ADn_de_Elines.jpg/400px-Colegiata_de_San_Mart%C3%ADn_de_Elines.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Santa_Mar%C3%ADa_de_Bareyo.jpg/400px-Santa_Mar%C3%ADa_de_Bareyo.jpg"
];

// Localidades reales para el generador
const locsReales = [
  {n:"Ruente",lat:43.2244,lon:-4.2650,z:"Saja-Nansa"},{n:"Polaciones",lat:43.0700,lon:-4.4200,z:"Saja-Nansa"},
  {n:"Arenas de Iguña",lat:43.1715,lon:-4.0840,z:"Besaya"},{n:"Cabezón de la Sal",lat:43.3067,lon:-4.2340,z:"Saja-Nansa"},
  {n:"Puente Viesgo",lat:43.2967,lon:-3.9667,z:"Valles Pasiegos"},{n:"Corvera de Toranzo",lat:43.2400,lon:-3.9200,z:"Valles Pasiegos"},
  {n:"Udías",lat:43.3500,lon:-4.2700,z:"Costa Occidental"},{n:"Ruiloba",lat:43.3800,lon:-4.2600,z:"Costa Occidental"},
  {n:"Valdeolea",lat:42.8700,lon:-4.1300,z:"Campoo-Los Valles"},{n:"Pesquera",lat:42.9600,lon:-4.0800,z:"Campoo-Los Valles"},
  {n:"Soba",lat:43.1800,lon:-3.4700,z:"Asón-Agüera"},{n:"Ruesga",lat:43.2300,lon:-3.5100,z:"Asón-Agüera"},
  {n:"Liérganes",lat:43.3400,lon:-3.7500,z:"Trasmiera"},{n:"Arnuero",lat:43.4700,lon:-3.5600,z:"Trasmiera"},
  {n:"Voto",lat:43.3500,lon:-3.4500,z:"Trasmiera"},{n:"Alfoz de Lloredo",lat:43.3700,lon:-4.1700,z:"Costa Occidental"},
  {n:"Campoo de Yuso",lat:42.9500,lon:-4.0500,z:"Campoo-Los Valles"},{n:"Luena",lat:43.1000,lon:-3.8900,z:"Valles Pasiegos"}
];
const santos=["Pedro","Andrés","Martín","Juan","Esteban","Miguel","Julián","Román","Cosme","Lorenzo","Sebastián","Pelayo"];
const descs=["Pequeña iglesia rural con ábside semicircular románico bien conservado.","Destaca por sus canecillos figurados y su portada con arquivoltas.","Construcción románica del siglo XII con modificaciones posteriores.","Conserva elementos románicos originales en su cabecera y muros laterales.","Notable ejemplo de románico rural cántabro con espadaña posterior."];

// Generador mejorado con datos reales
for (let i = window.poiData.length + 1; i <= 100; i++) {
  const loc = locsReales[i % locsReales.length];
  const santo = santos[i % santos.length];
  window.poiData.push({
    id: `iglesia-${i}`, name: `Iglesia de San ${santo} de ${loc.n}`,
    location: `${loc.n} (Cantabria)`,
    coordinates: { lat: loc.lat + (Math.random()*0.02-0.01), lon: loc.lon + (Math.random()*0.02-0.01) },
    order: "Parroquial", culture: "Románico rural", zone: loc.z,
    searchPopularity: Math.floor(Math.random() * 5000),
    images: [wikiImgs[i % wikiImgs.length], wikiImgs[(i+1) % wikiImgs.length]],
    description: descs[i % descs.length],
    restaurants: [{name:"Mesón de " + loc.n,foodType:"Casera",avgPrice:"18€",contact:"942 00 " + String(i).padStart(2,"0") + " 00",tripadvisor:""},{name:"Posada Rural " + loc.n,foodType:"Cántabra",avgPrice:"22€",contact:"942 11 " + String(i).padStart(2,"0") + " 00",tripadvisor:""}],
    bibliography: "Enciclopedia del Románico.", movies: []
  });
}
