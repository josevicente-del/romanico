// app.js
const poiData = window.poiData || [];
const eventsData = window.eventsData || [];
const recipesData = window.recipesData || [];
const conventSweets = window.conventSweets || [];

// Keys
const VISITED_KEY = 'romanico_visited';
const CONTRIBUTIONS_KEY = 'romanico_contributions';
const VIEWS_KEY = 'romanico_site_views';
const USERS_KEY = 'romanico_users';
const CHURCH_VISITS_KEY = 'romanico_church_visits'; // Para el ranking de iglesias

let map;
let markers = [];

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    handleIntro();
    initApp();
    setupEventListeners();
    incrementViews();
    updateDashboard();
});

function initApp() {
    initFilters();
    initLocalidades();
    initMap();
    renderList();
    updateProgress();
    renderAgenda();
    renderRanking();
    renderRestaurants();
    renderExtra();
}

// --- Lógica de Intro ---
function handleIntro() {
    const intro = document.getElementById('intro-hero');
    const stress = document.querySelector('.stress-bg');
    const peace = document.querySelector('.peace-bg');
    const skipBtn = document.getElementById('skip-intro');

    if(!intro) return;

    setTimeout(() => {
        if(stress) stress.style.opacity = '0';
        if(peace) peace.style.opacity = '1';
    }, 3000);

    skipBtn.addEventListener('click', () => {
        intro.classList.add('fade-out');
        document.body.style.overflow = 'auto';
    });
    document.body.style.overflow = 'hidden';
}

// --- Contador de Visitas ---
function incrementViews() {
    let views = parseInt(localStorage.getItem(VIEWS_KEY) || '0');
    views++;
    localStorage.setItem(VIEWS_KEY, views.toString());
    const el = document.getElementById('site-views');
    if(el) el.textContent = views;
}

// --- Filtros e Inicialización de Selects ---
function initFilters() {
    const zones = new Set();
    const orders = new Set();
    poiData.forEach(poi => {
        if(poi.zone) zones.add(poi.zone);
        if(poi.order) orders.add(poi.order);
    });

    const filterZone = document.getElementById('filter-zone');
    const filterOrder = document.getElementById('filter-order');
    const itineraryZone = document.getElementById('itinerary-zone-select');

    zones.forEach(z => {
        const opt = document.createElement('option');
        opt.value = z; opt.textContent = z;
        filterZone.appendChild(opt.cloneNode(true));
        if(itineraryZone) itineraryZone.appendChild(opt.cloneNode(true));
    });
    orders.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        filterOrder.appendChild(opt);
    });
}

// --- Poblar datalist de localidades para autocompletado ---
function initLocalidades() {
    const datalist = document.getElementById('localidades-list');
    if (!datalist) return;
    const localidades = window.localidadesCantabria || [];
    localidades.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.name;
        datalist.appendChild(opt);
    });
}

// --- Mostrar info cuando se busca por localidad ---
function updateLocalityInfo() {
    const infoDiv = document.getElementById('locality-info');
    if (!infoDiv) return;
    const search = document.getElementById('search-input').value.toLowerCase().trim();
    const localidades = window.localidadesCantabria || [];
    const match = localidades.find(l => search.length >= 3 && (
        l.name.toLowerCase().includes(search) || search.includes(l.name.toLowerCase())
    ));
    if (match) {
        const nearby = poiData
            .map(p => ({d: calculateDistance(match.lat, match.lon, p.coordinates.lat, p.coordinates.lon)}))
            .filter(p => p.d <= 20).length;
        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `📍 <strong>${match.name}</strong> (${match.comarca}) — <strong>${nearby}</strong> iglesias en 20 km`;
    } else {
        infoDiv.style.display = 'none';
    }
}

// --- Map Logic Principal ---
function initMap() {
    const mapEl = document.getElementById('map');
    if(!mapEl) return;
    map = L.map('map').setView([43.1828, -3.9878], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    renderMarkers();
}

function renderMarkers() {
    if(!map) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const data = getFilteredData();
    const visited = getVisited();

    data.forEach(poi => {
        const marker = L.circleMarker([poi.coordinates.lat, poi.coordinates.lon], {
            radius: 10,
            fillColor: visited.has(poi.id) ? '#27ae60' : '#1c3a6b',
            color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
        }).addTo(map);
        marker.bindPopup(`<b>${poi.name}</b><br><button onclick="openDetailById('${poi.id}')" class="btn-primary" style="padding:5px 10px; margin-top:5px; font-size:10px;">Ver Detalles</button>`);
        markers.push(marker);
    });
}

// --- Buscador y Filtros Combinados con búsqueda por localidad ---
function getFilteredData() {
    const zone = document.getElementById('filter-zone').value;
    const order = document.getElementById('filter-order').value;
    const searchInput = document.getElementById('search-input');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sort = document.getElementById('sort-by').value;
    const localidades = window.localidadesCantabria || [];

    // Buscar si el texto coincide con una localidad de Cantabria
    const localidadMatch = localidades.find(loc =>
        search.length >= 3 && (
            loc.name.toLowerCase().includes(search) ||
            search.includes(loc.name.toLowerCase())
        )
    );

    // Si hay coincidencia con localidad, ordenar por distancia
    if (localidadMatch && search.length >= 3) {
        return poiData
            .map(poi => ({
                ...poi,
                distancia: calculateDistance(localidadMatch.lat, localidadMatch.lon, poi.coordinates.lat, poi.coordinates.lon)
            }))
            .filter(poi => {
                const matchZone = !zone || poi.zone === zone;
                const matchOrder = !order || poi.order === order;
                return matchZone && matchOrder;
            })
            .sort((a, b) => a.distancia - b.distancia);
    }

    // Búsqueda normal por nombre, ubicación o zona
    return poiData.filter(poi => {
        const matchZone = !zone || poi.zone === zone;
        const matchOrder = !order || poi.order === order;
        const matchSearch = !search || 
            poi.name.toLowerCase().includes(search) || 
            poi.location.toLowerCase().includes(search) || 
            (poi.zone && poi.zone.toLowerCase().includes(search));
        return matchZone && matchOrder && matchSearch;
    }).sort((a, b) => {
        if (sort === 'popularity') return (b.searchPopularity || 0) - (a.searchPopularity || 0);
        return a.name.localeCompare(b.name);
    });
}

function renderList() {
    const container = document.getElementById('cards-container');
    if(!container) return;
    const data = getFilteredData();
    const visited = getVisited();
    container.innerHTML = '';

    data.forEach(poi => {
        const isVisited = visited.has(poi.id);
        const card = document.createElement('div');
        card.className = `card ${isVisited ? 'visited' : ''}`;
        // Mostrar distancia si existe (búsqueda por localidad)
        const distHTML = poi.distancia !== undefined
            ? `<span class="tag" style="background:#27ae60;color:white;">📍 ${poi.distancia.toFixed(1)} km</span>`
            : '';
        card.innerHTML = `
            <div class="card-img-container">
                <img src="${poi.images[0]}" alt="${poi.name}" onerror="this.src='colegiata_santa_juliana_santillana_1777204517020.png'">
            </div>
            <div class="card-content">
                <h3 class="card-title">${poi.name}</h3>
                <p style="font-size:0.8rem; color:var(--text-muted);">📍 ${poi.location}</p>
                <div class="tags" style="margin-top:10px;">
                    <span class="tag">${poi.zone}</span>
                    <span class="tag" style="background:var(--accent); color:white;">${poi.order}</span>
                    ${distHTML}
                </div>
            </div>
        `;
        card.addEventListener('click', () => openDetail(poi));
        container.appendChild(card);
    });
}

// --- Detail View con Mini-Mapa y Geofencing ---
function openDetail(poi) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('modal-body');
    const visited = getVisited();
    const isVisited = visited.has(poi.id);

    body.innerHTML = `
        <div class="modal-gallery">
            ${poi.images.slice(0, 4).map(img => `<img src="${img}" class="gallery-img" onerror="this.src='calles_santillana_del_mar_1777204641643.png'">`).join('')}
        </div>
        <h2 style="font-family:'Playfair Display'; color:var(--primary)">${poi.name}</h2>
        <p>📍 ${poi.location}</p>
        
        <div class="mini-map-container" id="mini-map-${poi.id}" style="height:200px; width:100%; border-radius:8px; margin:15px 0;"></div>
        
        <div style="display:flex; gap:10px; margin-bottom:20px;">
            <button onclick="checkLocationAndVisit('${poi.id}', ${poi.coordinates.lat}, ${poi.coordinates.lon})" class="btn-primary" style="flex:1; background:${isVisited ? '#7f8c8d' : 'var(--primary)'}">
                ${isVisited ? '✓ Ya visitado' : 'Marcar como Visitado (<1km)'}
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lon}" target="_blank" class="btn-auth" style="flex:1; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center;">🗺️ Cómo llegar</a>
        </div>

        <div class="detail-description" style="margin-bottom:20px; font-size:0.95rem;">
            ${poi.description}
        </div>

        <h3 style="font-size:1rem; border-bottom:1px solid #eee; padding-bottom:5px;">🍽️ Dónde comer cerca</h3>
        <div class="restaurants-list" style="margin-top:10px;">
            ${poi.restaurants && poi.restaurants.length > 0 ? poi.restaurants.map(r => `
                <div style="margin-bottom:10px; padding:10px; background:#f4f7f6; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-weight:600;">
                        <span>${r.name}</span>
                        <span style="color:var(--accent)">${r.avgPrice}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">${r.foodType} • 📞 ${r.contact}</div>
                    ${r.tripadvisor ? `<a href="${r.tripadvisor}" target="_blank" style="display:inline-block;margin-top:5px;font-size:0.75rem;color:#00aa6c;font-weight:600;text-decoration:none;">🟢 Ver en TripAdvisor →</a>` : ''}
                </div>
            `).join('') : '<p>No hay datos de restaurantes cercanos.</p>'}
        </div>
    `;
    modal.classList.add('active');

    // Inicializar mini-mapa
    setTimeout(() => {
        const miniMap = L.map(`mini-map-${poi.id}`, {zoomControl: false}).setView([poi.coordinates.lat, poi.coordinates.lon], 15);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps'
        }).addTo(miniMap);
        L.marker([poi.coordinates.lat, poi.coordinates.lon]).addTo(miniMap);
    }, 200);

    // Incrementar popularidad por visita (para el ranking)
    incrementChurchVisit(poi.id);
}

// --- Geofencing Logic ---
window.checkLocationAndVisit = (id, targetLat, targetLon) => {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    alert("⌛ Verificando tu ubicación real...");

    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, targetLat, targetLon);
        if (dist <= 1.0) { // 1 km
            toggleVisited(id);
            alert("✅ ¡Estás aquí! Marcado como visitado.");
        } else {
            alert(`❌ Estás a ${dist.toFixed(2)} km. Debes estar a menos de 1 km para marcarlo.`);
        }
    }, (err) => {
        alert("❌ Error al obtener ubicación. Asegúrate de dar permisos de GPS.");
    }, {enableHighAccuracy: true});
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- Ranking Mágico (Iglesias más visitadas) ---
function incrementChurchVisit(id) {
    const visits = JSON.parse(localStorage.getItem(CHURCH_VISITS_KEY) || '{}');
    visits[id] = (visits[id] || 0) + 1;
    localStorage.setItem(CHURCH_VISITS_KEY, JSON.stringify(visits));
    renderRanking();
}

function renderRanking() {
    const visits = JSON.parse(localStorage.getItem(CHURCH_VISITS_KEY) || '{}');
    const container = document.getElementById('church-ranking');
    if(!container) return;

    const sorted = poiData
        .map(poi => ({ ...poi, visitCount: visits[poi.id] || 0 }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

    container.innerHTML = sorted.map((poi, i) => `
        <div class="ranking-item">
            <span class="rank-number">#${i+1}</span>
            <span class="rank-name">${poi.name}</span>
            <span class="rank-score">${poi.visitCount} visualizaciones</span>
        </div>
    `).join('');
}

// --- Agenda, Recetas y Dulces ---
function renderAgenda() {
    const container = document.getElementById('agenda-container');
    const search = document.getElementById('search-extra').value.toLowerCase();
    if(!container) return;

    const filtered = eventsData.filter(ev => 
        !search || ev.title.toLowerCase().includes(search) || ev.location.toLowerCase().includes(search)
    );

    container.innerHTML = filtered.map(ev => `
        <div class="card" style="cursor:default">
            <div class="card-content">
                <span class="tag" style="background:var(--accent); color:white">${ev.type}</span>
                <h3 class="card-title" style="margin-top:10px">${ev.title}</h3>
                <p style="font-size:0.8rem; font-weight:600">📅 ${ev.date}</p>
                <p style="font-size:0.8rem; color:var(--text-muted)">📍 ${ev.location}</p>
                <p style="font-size:0.85rem; margin-top:10px">${ev.description}</p>
            </div>
        </div>
    `).join('');
}

function renderExtra() {
    const recipesCont = document.getElementById('recipes-container');
    const sweetsCont = document.getElementById('sweets-container');
    const search = document.getElementById('search-extra').value.toLowerCase();
    
    if(recipesCont) {
        recipesCont.innerHTML = recipesData.map(r => `
            <div class="card" style="cursor:default">
                <div class="card-content">
                    <h3 class="card-title">${r.name}</h3>
                    <p style="color:var(--accent); font-weight:600; font-size:0.8rem">Origin: ${r.origin}</p>
                    <p style="font-size:0.8rem; margin-top:5px"><b>Ingredientes:</b> ${r.ingredients.join(', ')}</p>
                    <p style="font-size:0.8rem; margin-top:5px"><b>Preparación:</b> ${r.preparation}</p>
                </div>
            </div>
        `).join('');
    }

    if(sweetsCont) {
        const filteredSweets = conventSweets.filter(s => 
            !search || s.name.toLowerCase().includes(search) || s.location.toLowerCase().includes(search) || s.specialty.toLowerCase().includes(search)
        );
        sweetsCont.innerHTML = filteredSweets.map(s => `
            <div class="card" style="cursor:default">
                <div class="card-img-container" style="height:150px">
                    <img src="${s.image}" alt="${s.name}">
                </div>
                <div class="card-content">
                    <h3 class="card-title" style="font-size:1.1rem">${s.name}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted)">📍 ${s.location}</p>
                    <p style="font-size:0.85rem; margin-top:5px"><b>Especialidad:</b> ${s.specialty}</p>
                    <p style="font-size:0.85rem; color:var(--primary); font-weight:600">🌐 ${s.contact}</p>
                </div>
            </div>
        `).join('');
    }
}

// --- Helpers de Visita ---
function getVisited() {
    return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || '[]'));
}

window.toggleVisited = id => {
    const visited = getVisited();
    if(visited.has(id)) visited.delete(id);
    else visited.add(id);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
    renderList();
    renderMarkers();
    updateProgress();
    document.getElementById('detail-modal').classList.remove('active');
};

function updateProgress() {
    const visited = getVisited().size;
    const el = document.getElementById('visited-counter');
    if(el) el.textContent = `${visited}/${poiData.length}`;
}

function updateDashboard() {
    const contributions = JSON.parse(localStorage.getItem(CONTRIBUTIONS_KEY) || '[]');
    const container = document.getElementById('last-photo-container');
    if (!container) return;
    if (contributions.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted)">Aún no hay aportaciones.</p>`;
        return;
    }
    const last = contributions[contributions.length - 1];
    container.innerHTML = `<img src="${last.url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;"><div style="margin-top:5px; font-size:0.8rem;"><b>${last.user}</b> - ${last.date}</div>`;
}

function renderRestaurants() {
    const container = document.getElementById('global-restaurants-container');
    if (!container) return;
    
    const allRestaurants = [];
    poiData.forEach(poi => {
        if (poi.restaurants) {
            poi.restaurants.forEach(r => {
                allRestaurants.push({ ...r, poiName: poi.name, poiLocation: poi.location });
            });
        }
    });

    container.innerHTML = allRestaurants.map(r => `
        <div class="card restaurant-card">
            <div class="card-content">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h3 class="card-title">${r.name}</h3>
                    <span class="tag" style="background:var(--accent); color:white;">${r.avgPrice}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin:5px 0;">🍴 ${r.foodType}</p>
                <p style="font-size:0.8rem; color:var(--primary); font-weight:600;">📍 Cerca de: ${r.poiName}</p>
                <p style="font-size:0.8rem; color:var(--text-muted);">📞 ${r.contact}</p>
                ${r.tripadvisor ? `<a href="${r.tripadvisor}" target="_blank" class="btn-auth" style="margin-top:10px; text-decoration:none; display:inline-block; font-size:0.8rem; background:#00aa6c; border:none; width:auto; padding:5px 15px;">🟢 TripAdvisor</a>` : ''}
            </div>
        </div>
    `).join('');
}

// --- Un día Románico (Itinerario) ---
let itineraryMap;
function generateItinerary() {
    const zone = document.getElementById('itinerary-zone-select').value;
    console.log("Generando itinerario para zona:", zone);
    if(!zone) { alert("Selecciona una zona primero."); return; }

    const zoneData = poiData.filter(p => p.zone === zone)
        .sort(() => Math.random() - 0.5)
        .slice(0, 6);
    
    // Ordenar por Latitud para que el recorrido tenga sentido geográfico (Norte-Sur o Sur-Norte)
    zoneData.sort((a, b) => a.coordinates.lat - b.coordinates.lat);

    if(zoneData.length < 3) {
        alert("Esta zona no tiene suficientes iglesias para una ruta completa.");
        return;
    }

    document.getElementById('itinerary-results').style.display = 'block';
    renderItineraryTimeline(zoneData);
    renderItineraryMap(zoneData);
}

function renderItineraryTimeline(data) {
    const container = document.getElementById('itinerary-timeline');
    const hours = ["10:00", "11:00", "12:00", "13:00 (Comida)", "14:30", "15:30", "16:30", "17:30", "18:00 (Final)"];
    
    // Buscar 3 opciones de comida en la zona
    const restaurants = data.flatMap(p => p.restaurants || []).slice(0, 3);

    let html = '';
    data.forEach((poi, i) => {
        let hour = hours[i > 2 ? i + 1 : i]; // Saltar el índice de la comida si i > 2
        
        html += `
            <div class="timeline-item">
                <div class="time">${hour}</div>
                <div class="content">
                    <h4>${poi.name}</h4>
                    <p>${poi.location}</p>
                </div>
            </div>
        `;

        if (i === 2) {
            html += `
                <div class="timeline-item lunch">
                    <div class="time">13:00</div>
                    <div class="content" style="background:#fff9ed">
                        <h4>🍽️ Parada para comer (Opciones)</h4>
                        ${restaurants.map(r => `<div>- ${r.name} (${r.foodType})</div>`).join('')}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}

function renderItineraryMap(data) {
    if (itineraryMap) itineraryMap.remove();
    itineraryMap = L.map('itinerary-map').setView([data[0].coordinates.lat, data[0].coordinates.lon], 11);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(itineraryMap);

    const latlngs = data.map(p => [p.coordinates.lat, p.coordinates.lon]);
    
    data.forEach((p, i) => {
        L.marker([p.coordinates.lat, p.coordinates.lon])
            .addTo(itineraryMap)
            .bindPopup(`<b>Punto ${i+1}: ${p.name}</b>`);
    });

    L.polyline(latlngs, {color: 'var(--accent)', weight: 4, dashArray: '10, 10'}).addTo(itineraryMap);
    itineraryMap.fitBounds(L.latLngBounds(latlngs));
}

// --- Listeners de Eventos ---
function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
            const viewEl = document.getElementById(`${view}-view`);
            if(viewEl) viewEl.classList.add('active');
            if(view === 'map') setTimeout(() => map.invalidateSize(), 100);
            if(view === 'itinerary' && itineraryMap) setTimeout(() => itineraryMap.invalidateSize(), 100);
        });
    });

    document.getElementById('btn-gen-itinerary').addEventListener('click', generateItinerary);

    document.getElementById('filter-zone').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('filter-order').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('sort-by').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('search-input').addEventListener('input', () => { renderList(); renderMarkers(); updateLocalityInfo(); });
    document.getElementById('search-extra').addEventListener('input', () => { renderAgenda(); renderExtra(); });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
    });

    document.getElementById('btn-login').addEventListener('click', () => {
        document.getElementById('auth-modal').classList.add('active');
    });

    window.openDetailById = id => {
        const poi = poiData.find(p => p.id === id);
        if(poi) openDetail(poi);
    };
}
