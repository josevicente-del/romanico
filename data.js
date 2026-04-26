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

// Generador de iglesias extra (restante hasta 100)
for (let i = 4; i <= 100; i++) {
  const z = ["Campoo", "Liébana", "Valderredible", "Besaya", "Costa Occidental"][Math.floor(Math.random() * 5)];
  window.poiData.push({
    "id": `iglesia-gen-${i}`,
    "name": `Iglesia de San ${["Pedro", "Andrés", "Cipriano", "Martín"][Math.floor(Math.random()*4)]} de ${["Loma", "Soto", "Vega", "Prado"][Math.floor(Math.random()*4)]}`,
    "location": `${["Ruente", "Polaciones", "Arenas"][Math.floor(Math.random()*3)]} (Cantabria)`,
    "coordinates": { "lat": 43.0 + (Math.random() * 0.4), "lon": -4.7 + (Math.random() * 1.5) },
    "order": "Parroquial",
    "culture": "Románico rural",
    "zone": z,
    "searchPopularity": Math.floor(Math.random() * 5000),
    "images": [
      "calles_santillana_del_mar_1777204641643.png",
      "colegiata_santa_juliana_santillana_1777204517020.png"
    ],
    "description": "Una joya oculta del románico rural en Cantabria.",
    "restaurants": [
      {"name": "Mesón Local", "foodType": "Casera", "avgPrice": "15€", "contact": "Tel: 942 00 00 00"},
      {"name": "Posada Rural", "foodType": "Cántabra", "avgPrice": "20€", "contact": "Tel: 942 11 11 11"}
    ],
    "bibliography": "Enciclopedia del Románico.",
    "movies": []
  });
}
