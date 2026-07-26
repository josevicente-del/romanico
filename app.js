// app.js
// Filtrar duplicados por ID de forma segura al inicio
const rawPoiData = window.poiData || [];
const seenPoiIds = new Set();
const poiData = [];
rawPoiData.forEach(poi => {
    if (poi && poi.id && !seenPoiIds.has(poi.id)) {
        seenPoiIds.add(poi.id);
        poiData.push(poi);
    }
});

let eventsData = window.eventsData || [];
let newsData = []; // Guardará las noticias de prensa del románico obtenidas vía API RSS
const recipesData = window.recipesData || [];
const conventSweets = window.conventSweets || [];

// Función auxiliar para procesar respuestas JSON de forma robusta frente a respuestas vacías o corruptas
async function safeJson(response, defaultValue = {}) {
    try {
        const text = await response.text();
        return text ? JSON.parse(text) : defaultValue;
    } catch (e) {
        console.warn("Advertencia al parsear JSON de respuesta:", e);
        return defaultValue;
    }
}

function getOptimizedImageUrl(url, width = 640) {
    if (!url) return '';
    // Usar el proxy global de imágenes de Cloudflare (images.weserv.nl) para redimensionar,
    // optimizar y convertir a WebP cualquier imagen remota, haciéndola extremadamente ligera.
    if (url.startsWith('http://') || url.startsWith('https://')) {
        if (url.includes('images.weserv.nl')) return url;
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=80`;
    }
    return url;
}

// Keys
const VISITED_KEY = 'romanico_visited';
const CONTRIBUTIONS_KEY = 'romanico_contributions';
const VIEWS_KEY = 'romanico_site_views';
const USERS_KEY = 'romanico_users';
const CURRENT_USER_KEY = 'romanico_current_user';
const CHURCH_VISITS_KEY = 'romanico_church_visits'; // Para el ranking de iglesias

let currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');

// Recuperación de seguridad (Self-healing): Si es el administrador José Vicente, asegurar rol 'admin'
if (currentUser && (currentUser.email === 'jose.vicente@gmail.com' || currentUser.email === 'josevicente@gmail.com')) {
    if (currentUser.role !== 'admin') {
        console.log("⚙️ [Self-healing] Asignando rol 'admin' al usuario administrador José Vicente.");
        currentUser.role = 'admin';
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    }
}

// --- Inicialización de Supabase ---
let supabaseClient = null;
if (window.checkSupabaseConfig && window.checkSupabaseConfig()) {
    // Si la configuración es correcta, creamos el cliente de Supabase
    supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseAnonKey);
    console.log("Supabase inicializado correctamente para autenticación.");

    // Configurar listener de cambios de autenticación para persistencia y propagación de estado
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log("Supabase Auth Event:", event, session);
        if (session && session.user) {
            try {
                // Obtener datos del perfil público
                const { data: profile, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                const isLocalAdmin = session.user.email === 'josevicente@gmail.com' || session.user.email === 'jose.vicente@gmail.com';
                const userRole = (profile && (profile.role === 'admin') || isLocalAdmin) ? 'admin' : 'user';

                if (profile) {
                    setCurrentUser({
                        id: session.user.id,
                        username: profile.full_name || session.user.user_metadata.username || 'Noble Viajero',
                        email: session.user.email,
                        role: userRole,
                        visited: profile.visited || [],
                        country: profile.country || '',
                        city: profile.city || '',
                        province: profile.province || '',
                        loginCount: profile.login_count || 1
                    });
                } else {
                    setCurrentUser({
                        id: session.user.id,
                        username: session.user.user_metadata.username || 'Noble Viajero',
                        email: session.user.email,
                        role: userRole,
                        visited: [],
                        country: session.user.user_metadata.country || '',
                        city: session.user.user_metadata.city || '',
                        province: session.user.user_metadata.province || '',
                        loginCount: 1
                    });
                }
            } catch (err) {
                console.error("Error al sincronizar perfil de Supabase:", err);
            }
        } else {
            // Si la sesión de Supabase expiró o se cerró, y teníamos un usuario de Supabase activo, lo deslogueamos
            if (currentUser && currentUser.id) {
                setCurrentUser(null);
            }
        }
    });
} else {
    console.log("Supabase no configurado. Utilizando fallback a servidor local (Express).");
}

let map;
let markers = [];

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    handleIntro();
    initApp();
    setupEventListeners();
    incrementViews();
    updateDashboard();
    handleHashRouting();
    window.addEventListener('hashchange', handleHashRouting);
    // Inicializar menú móvil y overlays táctiles
    initMobileMenu();
    initMapMobileScrollOverlays();
});

async function initApp() {
    updateAuthUI();
    initFilters();
    initLocalidades();
    initMap();
    renderList();
    updateProgress();
    renderPendingChurches();
    renderUserRanking();
    
    // Cargar eventos de la agenda asíncronamente
    loadEvents();
    
    renderRanking();
    renderRestaurants();
    renderSketchfab();
    renderLearnSection();
    renderComments();
    checkEmailVerificationParams();

    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registrado correctamente.', reg.scope))
                .catch(err => console.error('Error al registrar Service Worker:', err));
        });

        // Recargar la página automáticamente si el Service Worker cambia de control (actualización)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }
}

async function loadEvents() {
    try {
        // Intentar obtener los eventos desde la API del backend
        const res = await fetch('/api/events');
        if (res.ok) {
            eventsData = await safeJson(res, []);
            console.log("Eventos cargados desde la API del backend.");
            renderAgenda();
            return;
        } else {
            console.log("Respuesta de la API del backend no exitosa, intentando events.json estático.");
        }
    } catch(e) {
        console.log("No se pudo conectar al backend, intentando cargar events.json estático...");
    }

    try {
        // Fallback: Intentar obtener el archivo events.json estático directamente
        const staticRes = await fetch('./events.json');
        if (staticRes.ok) {
            eventsData = await safeJson(staticRes, []);
            console.log("Eventos cargados desde el archivo events.json estático.");
        } else {
            console.warn("No se pudo cargar events.json, usando window.eventsData.");
            eventsData = window.eventsData || [];
        }
    } catch(staticErr) {
        console.error("Error al cargar events.json estático:", staticErr);
        eventsData = window.eventsData || [];
    }

    // Renderizar la agenda en la interfaz de usuario
    renderAgenda();
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
    const cultures = new Set();
    poiData.forEach(poi => {
        if(poi.zone) zones.add(poi.zone);
        if(poi.order) orders.add(poi.order);
        if(poi.culture) cultures.add(poi.culture);
    });

    const filterZone = document.getElementById('filter-zone');
    const filterOrder = document.getElementById('filter-order');
    const filterCulture = document.getElementById('filter-culture');
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
    if (filterCulture) {
        cultures.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            filterCulture.appendChild(opt);
        });
    }
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
            .map(p => ({d: calculateDistance(match.lat, match.lon, p.lat, p.lon)}))
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
    
    // Obtener los filtros de los nuevos controles del mapa
    const layerSelect = document.getElementById('map-layer-select');
    const comarcaSelect = document.getElementById('map-comarca-select');
    
    const layer = layerSelect ? layerSelect.value : 'all';
    const comarca = comarcaSelect ? comarcaSelect.value : '';

    let data = [...poiData];

    // 1. Filtrar por comarca
    if (comarca) {
        data = data.filter(poi => poi.zone === comarca);
    }

    // 2. Filtrar por capa de importancia
    if (layer === 'top6') {
        const top6Ids = [
            "colegiata-de-santa-juliana-santillana-del-mar",
            "colegiata-de-san-pedro-de-cervatos",
            "colegiata-de-san-mart-n-de-elines",
            "colegiata-de-santa-cruz-de-casta-eda",
            "iglesia-de-santa-mar-a-bareyo",
            "iglesia-de-santa-mar-a-piasca"
        ];
        data = data.filter(poi => top6Ids.includes(poi.id));
    } else if (layer === 'top15') {
        // Ordenar por popularidad y coger las primeras 15
        const sorted = [...poiData].sort((a, b) => {
            const aPop = a.searchPopularity || a.pop || 0;
            const bPop = b.searchPopularity || b.pop || 0;
            return bPop - aPop;
        });
        const top15Ids = sorted.slice(0, 15).map(poi => poi.id);
        data = data.filter(poi => top15Ids.includes(poi.id));
    }

    const visited = getVisited();

    data.forEach(poi => {
        const marker = L.circleMarker([poi.lat, poi.lon], {
            radius: 10,
            fillColor: visited.has(poi.id) ? '#27ae60' : '#1c3a6b',
            color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
        }).addTo(map);

        // Detectar si hay información de horarios
        const descLower = (poi.description || "").toLowerCase();
        const hasScheduleInfo = descLower.includes("horario") || descLower.includes("abierto") || descLower.includes("visita") || descLower.includes("10:") || descLower.includes("16:") || descLower.includes("mañana");
        const scheduleHTML = hasScheduleInfo 
            ? `<span style="color:#27ae60; font-size:0.8rem; font-weight:bold;">🟢 Horario Disponible (ver detalles)</span>`
            : `<span style="color:#f39c12; font-size:0.8rem; font-weight:bold;">🟡 Horario: Consultar localmente</span>`;

        marker.bindPopup(`
            <b style="font-family:'Noto Serif', serif; font-size:0.95rem; display:block; margin-bottom:5px;">${poi.name}</b>
            <span style="font-size:0.8rem; color:#666; display:block; margin-bottom:5px;">📍 ${poi.location} (${poi.zone})</span>
            <div style="margin-bottom:8px;">${scheduleHTML}</div>
            <button onclick="openDetailById('${poi.id}')" class="btn-primary" style="padding:6px 12px; font-size:10px; width:100%; border-radius:4px; text-transform:none;">Ver Detalles</button>
        `);
        markers.push(marker);
    });
}

// --- Buscador y Filtros Combinados con búsqueda por localidad ---
function getFilteredData() {
    const zone = document.getElementById('filter-zone').value;
    const order = document.getElementById('filter-order').value;
    const filterCultureEl = document.getElementById('filter-culture');
    const culture = filterCultureEl ? filterCultureEl.value : '';
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
                distancia: calculateDistance(localidadMatch.lat, localidadMatch.lon, poi.lat, poi.lon)
            }))
            .filter(poi => {
                const matchZone = !zone || poi.zone === zone;
                const matchOrder = !order || poi.order === order;
                const matchCulture = !culture || poi.culture === culture;
                return matchZone && matchOrder && matchCulture;
            })
            .sort((a, b) => a.distancia - b.distancia);
    }

    // Búsqueda normal por nombre, ubicación o zona
    return poiData.filter(poi => {
        const matchZone = !zone || poi.zone === zone;
        const matchOrder = !order || poi.order === order;
        const matchCulture = !culture || poi.culture === culture;
        const matchSearch = !search || 
            poi.name.toLowerCase().includes(search) || 
            poi.location.toLowerCase().includes(search) || 
            (poi.zone && poi.zone.toLowerCase().includes(search));
        return matchZone && matchOrder && matchCulture && matchSearch;
    }).sort((a, b) => {
        if (sort === 'popularity') {
            const aIsCol = a.order === 'Colegiata' || a.name.toLowerCase().includes('colegiata');
            const bIsCol = b.order === 'Colegiata' || b.name.toLowerCase().includes('colegiata');
            if (aIsCol && !bIsCol) return -1;
            if (!aIsCol && bIsCol) return 1;
            const aPop = a.pop || a.searchPopularity || 0;
            const bPop = b.pop || b.searchPopularity || 0;
            return bPop - aPop;
        }
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
            ? `<span class="tag tag-distance">📍 ${poi.distancia.toFixed(1)} km</span>`
            : '';
        
        const hasRealImages = poi.images && poi.images.length > 0;
        const imgHTML = hasRealImages 
            ? `<img src="${getOptimizedImageUrl(poi.images[0], 400)}" alt="${poi.name}" width="400" height="250" loading="lazy">`
            : `<div class="card-img-placeholder" title="Foto próximamente"><span>Foto próximamente</span></div>`;

        card.innerHTML = `
            <div class="card-img-container">
                ${imgHTML}
            </div>
            <div class="card-content">
                <h3 class="card-title">${poi.name}</h3>
                <p class="card-location">📍 ${poi.location}</p>
                <div class="tags">
                    <span class="tag">${poi.zone}</span>
                    <span class="tag tag-order">${poi.order}</span>
                    ${distHTML}
                </div>
            </div>
        `;
        card.addEventListener('click', () => openDetail(poi));
        container.appendChild(card);
    });
}

// =========================================================================
// MOTOR DE AFINIDADES Y VÍNCULOS ENTRE TEMPLOS ROMÁNICOS
// =========================================================================
// Calcula la compatibilidad y los vínculos artísticos y geográficos entre
// un templo seleccionado y todos los demás templos del catálogo.
function calculateAffinities(sourcePoi) {
    if (!sourcePoi || !window.poiData) return [];

    // Descriptores artísticos y arquitectónicos para encontrar afinidades temáticas
    const keywords = [
        { word: "erótico", label: "Relieves o canecillos erótico-satíricos" },
        { word: "satíric", label: "Esculturas de carácter satírico o burlesco" },
        { word: "canecillo", label: "Decoración singular en canecillos" },
        { word: "bestiario", label: "Escultura moralizante con bestiario medieval" },
        { word: "animal", label: "Motivos zoomorfos esculpidos en capiteles" },
        { word: "claustro", label: "Claustro historiado o galerías porticadas" },
        { word: "pinturas", label: "Magnífico ciclo de pinturas murales góticas/románicas" },
        { word: "murales", label: "Pinturas murales medievales" },
        { word: "cueva", label: "Arquitectura rupestre excavada en roca arenisca" },
        { word: "rupestre", label: "Eremitismo rupestre e iglesias hipogeas" },
        { word: "mozárabe", label: "Pervivencias estilísticas mozárabes" },
        { word: "ábside", label: "Ábside decorado con columnas e impostas" },
        { word: "espadaña", label: "Típica espadaña románica campurriana" },
        { word: "puntas de diamante", label: "Decoración geométrica con puntas de diamante" }
    ];

    const results = [];

    // Cálculo simplificado de la distancia Haversine
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio terrestre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    const sourceText = ((sourcePoi.description || "") + " " + (sourcePoi.bestiary ? sourcePoi.bestiary.description : "")).toLowerCase();

    // Focos y corrientes existentes
    const fociMap = {
        colegiatas: [
            "colegiata-de-santa-juliana-santillana-del-mar",
            "colegiata-de-san-pedro-de-cervatos",
            "colegiata-de-san-mart-n-de-elines",
            "colegiata-de-santa-cruz-de-casta-eda",
            "iglesia-de-santa-mar-a-piasca"
        ],
        septentrional: [
            "iglesia-de-santa-mar-a-bareyo",
            "iglesia-de-santa-mar-a-yermo",
            "iglesia-de-san-andr-s-argomilla",
            "iglesia-de-santa-mar-a-de-puerto-santo-a"
        ],
        rural: [
            "iglesia-de-san-cipriano-bolmir",
            "iglesia-de-santa-mar-a-la-mayor-villacantid",
            "iglesia-de-san-juan-bautista-loma-somera",
            "iglesia-de-santa-eulalia-bustasur",
            "iglesia-de-santa-eulalia-sopenilla",
            "iglesia-de-san-pedro-gervelas",
            "iglesia-de-san-pedro-castillo-pedroso"
        ],
        eremitismo: [
            "iglesia-rupestre-de-arroyuelos",
            "iglesia-rupestre-de-santa-mar-a-de-valverde",
            "iglesia-rupestre-de-cadalso"
        ],
        lebaniega: [
            "iglesia-de-santa-mar-a-lebe-a",
            "monasterio-de-santo-toribio-de-liebana"
        ]
    };

    let sourceFocus = "";
    for (const [focusId, ids] of Object.entries(fociMap)) {
        if (ids.includes(sourcePoi.id)) {
            sourceFocus = focusId;
            break;
        }
    }

    window.poiData.forEach(poi => {
        if (poi.id === sourcePoi.id) return;

        let score = 10;
        const reasons = [];

        // 1. Mismo foco/corriente (40 ptos)
        let sameFocus = false;
        if (sourceFocus && fociMap[sourceFocus].includes(poi.id)) {
            score += 40;
            sameFocus = true;
            const focusNames = {
                colegiatas: "Grandes Colegiatas y Prioratos",
                septentrional: "Románico Septentrional (Costa)",
                rural: "Románico Rural",
                eremitismo: "Eremitismo Rupestre e hipogeo",
                lebaniega: "Escuela Románica Lebaniega"
            };
            reasons.push(`Mismo foco estilístico: <strong>${focusNames[sourceFocus]}</strong>.`);
        }

        // Mismo tipo de orden (ej: colegiata con colegiata)
        if (!sameFocus && poi.order && sourcePoi.order && poi.order === sourcePoi.order) {
            score += 20;
            reasons.push(`Misma tipología: Ambas catalogadas como <strong>${poi.order}</strong>.`);
        }

        // 2. Proximidad Geográfica (35 ptos)
        const dist = getDistanceKm(sourcePoi.lat, sourcePoi.lon, poi.lat, poi.lon);
        if (dist <= 15) {
            score += 35;
            reasons.push(`Cercanía extrema: A solo <strong>${dist.toFixed(1)} km</strong> de distancia.`);
        } else if (dist <= 30) {
            score += 20;
            reasons.push(`Misma comarca: Situadas a <strong>${dist.toFixed(1)} km</strong>.`);
        } else if (dist <= 55) {
            score += 10;
            reasons.push(`Distancia de ruta: A <strong>${dist.toFixed(1)} km</strong>.`);
        }

        // 3. Superposición de términos artísticos (25 ptos)
        const poiText = ((poi.description || "") + " " + (poi.bestiary ? poi.bestiary.description : "")).toLowerCase();
        let matches = 0;
        keywords.forEach(kw => {
            if (sourceText.includes(kw.word) && poiText.includes(kw.word)) {
                matches++;
                if (matches <= 2) {
                    score += 12;
                    reasons.push(`Detalle común: Ambos poseen ${kw.label}.`);
                }
            }
        });

        // Normalizar afinidad en porcentaje
        let affinityPercentage = Math.min(100, Math.round((score / 100) * 100));
        if (affinityPercentage < 25) affinityPercentage = 25 + (score % 15);

        results.push({
            poi: poi,
            distance: dist,
            affinity: affinityPercentage,
            reasons: reasons.slice(0, 3)
        });
    });

    results.sort((a, b) => b.affinity - a.affinity || a.distance - b.distance);
    return results;
}

// --- Detail View con Mini-Mapa y Geofencing ---
function openDetail(poi) {
    // Guardar título y descripción originales para restauración posterior
    if (!window.originalTitle) {
        window.originalTitle = document.title;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (!window.originalDescription && metaDesc) {
        window.originalDescription = metaDesc.getAttribute('content');
    }

    // Actualizar metadatos dinámicamente para SEO
    document.title = `${poi.name} | Guía del Románico en Cantabria`;
    if (metaDesc) {
        metaDesc.setAttribute('content', `${poi.name} en ${poi.location}: ${poi.description.substring(0, 140)}...`);
    }

    // Actualizar hash para enlazado profundo (Deep Linking)
    window.location.hash = poi.id;

    // Inyectar Datos Estructurados Schema.org JSON-LD para SEO y GEO local
    let jsonLdEl = document.getElementById('dynamic-jsonld');
    if (!jsonLdEl) {
        jsonLdEl = document.createElement('script');
        jsonLdEl.type = 'application/ld+json';
        jsonLdEl.id = 'dynamic-jsonld';
        document.head.appendChild(jsonLdEl);
    }
    const schemaData = {
        "@context": "https://schema.org",
        "@type": "TouristAttraction",
        "name": poi.name,
        "description": poi.description.substring(0, 250),
        "image": (poi.images && poi.images.length > 0) ? poi.images[0] : "",
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": poi.lat,
            "longitude": poi.lon
        },
        "address": {
            "@type": "PostalAddress",
            "addressLocality": poi.location,
            "addressRegion": "Cantabria",
            "addressCountry": "ES"
        }
    };
    jsonLdEl.textContent = JSON.stringify(schemaData);

    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('modal-body');
    const visited = getVisited();
    const isVisited = visited.has(poi.id);

    const hasRealImages = poi.images && poi.images.length > 0;
    const galleryHTML = hasRealImages
        ? `<div class="modal-gallery">
            ${poi.images.slice(0, (poi.order === 'Colegiata' || (poi.name && poi.name.toLowerCase().includes('colegiata'))) ? 6 : 4).map((img, idx) => {
                const lazyAttr = idx === 0 ? '' : ' loading="lazy"';
                const optimizedUrl = getOptimizedImageUrl(img, idx === 0 ? 800 : 400);
                return `<img src="${optimizedUrl}" class="gallery-img" width="300" height="200" ${lazyAttr} alt="${poi.name} - Imagen ${idx + 1}">`;
            }).join('')}
           </div>`
        : `<div class="detail-img-placeholder" title="Foto próximamente">
            <span>Foto próximamente</span>
           </div>`;

    body.innerHTML = `
        ${galleryHTML}
        <h2 class="modal-detail-title">${poi.name}</h2>
        <p class="modal-detail-location">📍 ${poi.location}</p>
        
        <!-- Botones Sociales -->
        <div class="modal-social-buttons">
            <button onclick="shareContent('whatsapp', '${poi.name}', 'Descubre esta joya del románico en Cantabria.', window.location.href)" class="btn-social-wa">💬 WhatsApp</button>
            <button onclick="shareContent('telegram', '${poi.name}', 'Descubre esta joya del románico en Cantabria.', window.location.href)" class="btn-social-tg">✈️ Telegram</button>
        </div>
        
        <div class="mini-map-container" id="mini-map-${poi.id}"></div>
        
        <div class="modal-action-buttons">
            <button id="btn-visit-${poi.id}" onclick="checkLocationAndVisit('${poi.id}', ${poi.lat}, ${poi.lon})" class="btn-primary" style="background:${isVisited ? '#7f8c8d' : 'var(--primary)'}">
                ${isVisited ? '✓ Ya visitado' : 'Marcar como Visitado (<100m)'}
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}" target="_blank" class="btn-auth">🗺️ Cómo llegar</a>
            ${currentUser && currentUser.role === 'admin' ? `
            <button onclick="openEditPoiById('${poi.id}')" class="btn-primary" style="background:var(--accent); color:white;">⚙️ Editar Datos</button>
            ` : ''}
        </div>

        <div class="detail-description">
            ${poi.description}
        </div>

        ${poi.bestiary ? `
        <div class="bestiary-section">
            <h3 class="bestiary-title">
                🦁 Bestiario Románico: Capiteles y Simbolismo
            </h3>
            <p class="bestiary-desc">${poi.bestiary.description}</p>
            <div class="bestiary-grid">
                ${poi.bestiary.images.map(img => `
                    <div class="bestiary-item">
                        <div class="bestiary-img-container">
                            <img src="${getOptimizedImageUrl(img.url, 400)}" alt="${img.caption}" loading="lazy" width="300" height="200"
                                onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:2rem;\\'>🏛️</div>'">
                        </div>
                        <p class="bestiary-caption">${img.caption}</p>
                    </div>
                `).join('')}
            </div>
            <p class="bestiary-source">📷 Fuente: Wikimedia Commons (CC BY-SA)</p>
        </div>
        ` : ''}

        <h3 class="restaurants-list-title">🍽️ Dónde comer cerca</h3>
        <div class="restaurants-list">
            ${poi.restaurants && poi.restaurants.length > 0 ? poi.restaurants.map(r => `
                <div class="restaurant-item">
                    <div class="restaurant-header">
                        <span>${r.name}</span>
                        <span style="color:var(--accent)">${r.avgPrice}</span>
                    </div>
                    <div class="restaurant-meta">${r.foodType} • 📞 ${r.contact}</div>
                    <div class="restaurant-actions">
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((r.name || 'Restaurante') + ' ' + poi.location)}" target="_blank">📍 Ver en Mapa</a>
                        <a href="${(!r.tripadvisor || r.tripadvisor.includes('/Restaurants-')) ? `https://www.google.com/search?q=${encodeURIComponent('site:tripadvisor.es "' + r.name + '" ' + (poi.location || 'Cantabria'))}` : r.tripadvisor}" target="_blank" style="color:#00aa6c;">🟢 TripAdvisor</a>
                        <button onclick="shareContent('whatsapp', 'Cómo llegar a ${r.name || 'Restaurante'}', 'Ubicado cerca de ${poi.name}. Aquí tienes la ruta para llegar:', 'https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name + ' ' + poi.location)}')" style="color: #25D366;">💬 Enviar Ruta WhatsApp</button>
                    </div>
                </div>
            `).join('') : '<p>No hay datos de restaurantes cercanos.</p>'}
        </div>
        
        ${poi.userGallery && poi.userGallery.length > 0 ? `
        <div class="user-gallery-section">
            <h3>📸 Galería de Usuarios</h3>
            <div class="user-gallery-container">
                ${poi.userGallery.map(img => `<img src="${img}" class="user-gallery-img" width="150" height="100" loading="lazy" alt="Foto de viajero">`).join('')}
            </div>
        </div>` : ''}

        <div class="upload-form-container">
            <h4>¿Tienes una foto? Añádela a la galería</h4>
            <form id="upload-form" onsubmit="handleUpload(event, '${poi.id}')" enctype="multipart/form-data">
                <input type="file" name="photo" accept="image/*" required><br>
                <button type="submit" class="btn-primary">Subir Foto (Verificación Automática)</button>
            </form>
            <div id="upload-status" class="upload-form-status"></div>
        </div>

        <!-- Sección de Templos Relacionados en el Modal -->
        <div class="modal-related-section">
            <h4 class="modal-related-title">🔗 Templos Relacionados en la Guía</h4>
            <div class="modal-related-grid">
                ${(() => {
                    const related = calculateAffinities(poi).slice(0, 3);
                    return related.map(aff => {
                        const rp = aff.poi;
                        const mainImg = rp.images && rp.images.length > 0 ? rp.images[0] : '';
                        const imgTag = mainImg 
                            ? `<img src="${mainImg}" alt="${rp.name}">`
                            : `<div class="card-img-placeholder" style="min-height: 100px; height: 100%; font-size: 0.65rem; padding: 10px;"></div>`;
                        return `
                            <div class="modal-related-card" onclick="window.openDetailById('${rp.id}')">
                                <div class="modal-related-img-container">
                                    ${imgTag}
                                </div>
                                <div class="modal-related-info">
                                    <div>
                                        <h5 class="modal-related-card-title">${rp.name}</h5>
                                        <p class="modal-related-card-meta">📍 ${rp.location} • 📏 ${aff.distance.toFixed(1)} km</p>
                                    </div>
                                    <span class="modal-related-card-badge">${aff.affinity}% Afinidad</span>
                                </div>
                            </div>
                        `;
                    }).join('');
                })()}
            </div>
        </div>

        <div class="modal-footer">
            <button onclick="closeDetail()">Cerrar</button>
        </div>
    `;
    modal.classList.add('active');

    // Inicializar mini-mapa
    setTimeout(() => {
        const miniMap = L.map(`mini-map-${poi.id}`, {zoomControl: false}).setView([poi.lat, poi.lon], 15);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps'
        }).addTo(miniMap);
        L.marker([poi.lat, poi.lon]).addTo(miniMap);
    }, 200);

    // Incrementar popularidad por visita (para el ranking)
    incrementChurchVisit(poi.id);
}

async function handleUpload(e, poiId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('poiId', poiId);
    
    // Adjuntar nombre de usuario para el backend
    const uName = currentUser ? currentUser.username : "Viajero Anónimo";
    formData.append('username', uName);
    
    const status = document.getElementById('upload-status');
    status.innerHTML = "Verificando imagen con IA...";
    status.style.color = "blue";
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await safeJson(res);
        if (data.success) {
            status.innerHTML = "✅ " + data.message;
            status.style.color = "green";
            // Limpiar formulario
            form.reset();
            // Cerrar el modal después de 3 segundos para que lean el aviso
            setTimeout(() => {
                const detailModal = document.getElementById('detail-modal');
                if (detailModal) detailModal.classList.remove('active');
            }, 3500);
        } else {
            status.innerHTML = "❌ " + data.error;
            status.style.color = "red";
        }
    } catch(err) {
        status.innerHTML = "❌ Error de conexión con el servidor.";
        status.style.color = "red";
    }
}

// --- Geofencing Logic ---
window.checkLocationAndVisit = (id, targetLat, targetLon) => {
    if (!currentUser) {
        alert("🔒 Debes registrarte o iniciar sesión para poder marcar esta iglesia como visitada.");
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.add('active');
        return;
    }

    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    alert("⌛ Obteniendo tu señal GPS... Por favor, asegúrate de estar al aire libre para mejorar la precisión.");

    navigator.geolocation.getCurrentPosition((pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, targetLat, targetLon);
        const distMeters = dist * 1000;
        
        if (distMeters <= 100) {
            markChurchAsVisitedForUser(id);
            alert(`✅ ¡Felicidades! Estás a ${distMeters.toFixed(1)} metros de la iglesia. Marcada como visitada.`);
        } else {
            alert(`❌ Estás demasiado lejos (a ${dist.toFixed(2)} km o ${distMeters.toFixed(0)}m). Debes estar a menos de 100 metros para marcar tu visita.`);
        }
    }, (err) => {
        alert("❌ Error al obtener tu ubicación GPS. Por favor, concede permisos de localización en tu navegador.");
    }, {enableHighAccuracy: true, timeout: 10000});
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
    if(!container) return;

    const searchInput = document.getElementById('search-extra');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = eventsData.filter(ev => 
        !search || ev.title.toLowerCase().includes(search) || (ev.location && ev.location.toLowerCase().includes(search))
    );

    container.innerHTML = filtered.map(ev => {
        const urlHTML = ev.url ? `
            <div style="margin-top: 15px;">
                <a href="${ev.url}" target="_blank" class="btn-primary" style="display: block; text-align: center; font-size: 0.8rem; text-decoration: none; padding: 8px 12px; width: 100%;">ℹ️ Más Información</a>
            </div>
        ` : '';
        const clickAttr = ev.url ? `onclick="window.open('${ev.url}', '_blank')"` : '';
        const cursorStyle = ev.url ? 'cursor:pointer; transition: transform 0.2s, box-shadow 0.2s;' : 'cursor:default';
        const newBadge = ev.isNew ? `<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; animation: pulse 1.5s infinite;">🆕 NUEVO</span>` : '';
        
        return `
            <div class="card event-card" ${clickAttr} style="${cursorStyle}">
                <div class="card-content" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="tag" style="background:var(--accent); color:white">${ev.type || 'Evento'}</span>
                            ${newBadge}
                        </div>
                        <h3 class="card-title" style="margin-top:10px">${ev.title}</h3>
                        <p style="font-size:0.8rem; font-weight:600">📅 ${ev.date}</p>
                        <p style="font-size:0.8rem; color:var(--text-muted)">📍 ${ev.location || 'Cantabria'}</p>
                        <p style="font-size:0.85rem; margin-top:10px">${ev.desc || ev.description || ''}</p>
                    </div>
                    ${urlHTML}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Carga de forma asíncrona las noticias de prensa del románico desde la API
 * local (/api/news), mostrando un spinner animado durante el proceso.
 */
async function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    // Pintamos un spinner premium de carga con estética medieval
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
            <div class="spinner"></div>
            <span style="font-family: 'Noto Serif', serif; font-style: italic;">Buscando crónicas en los reinos de Cantabria...</span>
        </div>
    `;

    try {
        const res = await fetch('/api/news');
        if (res.ok) {
            const data = await safeJson(res, { success: false, news: [] });
            if (data.success) {
                newsData = data.news || [];
                console.log("WEB_APP: Noticias de prensa cargadas desde el backend.");
                renderNews();
                return;
            }
        }
    } catch(e) {
        console.error("WEB_APP: Error al cargar noticias de prensa:", e);
    }

    // Fallback con estética medieval si hay algún error
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: rgba(231, 76, 60, 0.05); border: 1px solid rgba(231, 76, 60, 0.2); border-radius: 8px; color: #c0392b; font-family: 'Noto Serif', serif;">
            🛡️ Las palomas mensajeras no han podido regresar con las crónicas. Inténtalo de nuevo más tarde o comprueba tu conexión real con el servidor.
        </div>
    `;
}

/**
 * Renderiza la lista de noticias de prensa filtradas según el buscador secundario
 */
function renderNews() {
    const container = document.getElementById('news-container');
    if(!container) return;

    const searchInput = document.getElementById('search-extra');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filtrar según coincidencia de título o descripción
    const filtered = newsData.filter(n => 
        !search || n.title.toLowerCase().includes(search) || (n.desc && n.desc.toLowerCase().includes(search))
    );

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted); font-style: italic; font-family: 'Noto Serif', serif;">
                No se encontraron crónicas en esta comarca que coincidan con tu búsqueda.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(n => {
        // Formatear fecha RSS de manera legible para viajeros
        let dateStr = "Reciente";
        if (n.pubDate) {
            try {
                const dateObj = new Date(n.pubDate);
                if (!isNaN(dateObj)) {
                    dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            } catch(e) {}
        }

        return `
            <div class="card event-card" onclick="window.open('${n.link}', '_blank')" style="cursor:pointer; transition: transform 0.2s, box-shadow 0.2s;">
                <div class="card-content" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="tag" style="background:#8c2512; color:white">Prensa 📰</span>
                        </div>
                        <h3 class="card-title" style="margin-top:10px; color:#8c2512; font-family: 'Noto Serif', serif;">${n.title}</h3>
                        <p style="font-size:0.8rem; font-weight:600; color:var(--text-muted)">📅 ${dateStr}</p>
                        <p style="font-size:0.85rem; margin-top:10px; line-height: 1.4; color: var(--text);">${n.desc || 'Haz clic para leer la crónica completa en el diario de origen.'}</p>
                    </div>
                    <div style="margin-top: 15px;">
                        <a href="${n.link}" target="_blank" class="btn-primary" style="display: block; text-align: center; font-size: 0.8rem; text-decoration: none; padding: 8px 12px; width: 100%; background: #8c2512; border-color: #751f0e;">⚔️ Leer Crónica Completa</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// --- Helpers de Visita ---
function getVisited() {
    if (currentUser) {
        return new Set(currentUser.visited || []);
    }
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
    
    // Leer el término de búsqueda del buscador secundario
    const searchInput = document.getElementById('search-extra');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const allRestaurants = [];
    poiData.forEach(poi => {
        if (poi.restaurants) {
            poi.restaurants.forEach(r => {
                // Filtrar según coincidencia con el nombre del restaurante, tipo de comida, nombre del templo cercano o localidad (poi.location)
                const matchesSearch = !search || 
                    r.name.toLowerCase().includes(search) || 
                    r.foodType.toLowerCase().includes(search) || 
                    poi.name.toLowerCase().includes(search) ||
                    (poi.location && poi.location.toLowerCase().includes(search));
                
                if (matchesSearch) {
                    allRestaurants.push({ ...r, poiName: poi.name, poiLocation: poi.location });
                }
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
                <div style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                    <a href="${(!r.tripadvisor || r.tripadvisor.includes('/Restaurants-')) ? `https://www.google.com/search?q=${encodeURIComponent('site:tripadvisor.es "' + r.name + '" ' + (r.poiLocation || 'Cantabria'))}` : r.tripadvisor}" target="_blank" class="btn-auth" style="text-decoration:none; display:inline-block; font-size:0.8rem; background:#00aa6c; border:none; width:auto; padding:5px 15px; color: white;">🟢 TripAdvisor</a>
                    <button onclick="shareContent('whatsapp', 'Cómo llegar a ${r.name || 'Restaurante'}', 'Ubicado cerca de ${r.poiName}. Aquí tienes la ruta para llegar:', 'https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name + ' ' + r.poiLocation)}')" class="btn-auth" style="background: #25D366; border: none; font-size: 0.8rem; width: auto; padding: 5px 15px; color: white; cursor: pointer;">💬 Enviar por WhatsApp</button>
                </div>
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

    const zoneDataUnsorted = poiData.filter(p => p.zone === zone);
    if(zoneDataUnsorted.length < 4) {
        alert("Esta zona no tiene suficientes iglesias para una ruta (mínimo 4).");
        return;
    }

    const numToSelect = Math.min(8, Math.max(4, zoneDataUnsorted.length));
    const zoneData = zoneDataUnsorted
        .sort(() => Math.random() - 0.5)
        .slice(0, numToSelect);
    
    // Ordenar por Latitud para que el recorrido tenga sentido geográfico (Norte-Sur o Sur-Norte)
    zoneData.sort((a, b) => a.lat - b.lat);

    document.getElementById('itinerary-results').style.display = 'block';
    
    // Preparar el botón de compartir del itinerario
    const btnShareContainer = document.getElementById('itinerary-share-container') || document.createElement('div');
    btnShareContainer.id = 'itinerary-share-container';
    btnShareContainer.style.margin = '20px 0';
    btnShareContainer.style.textAlign = 'center';
    
    const routeText = zoneData.map((p, i) => `${i+1}. ${p.name}`).join('\n');
    btnShareContainer.innerHTML = `
        <button onclick="shareContent('whatsapp', 'Mi Ruta Románica por ${zone}', '${routeText}', window.location.href)" style="background: #25D366; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">💬 Compartir Ruta en WhatsApp</button>
        <button onclick="shareContent('telegram', 'Mi Ruta Románica por ${zone}', '${routeText}', window.location.href)" style="background: #0088cc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">✈️ Compartir en Telegram</button>
    `;
    
    const resultsContainer = document.getElementById('itinerary-results');
    resultsContainer.insertBefore(btnShareContainer, document.getElementById('itinerary-timeline'));

    renderItineraryTimeline(zoneData);
    renderItineraryMap(zoneData);
}

function renderItineraryTimeline(data) {
    const container = document.getElementById('itinerary-timeline');
    const hours = ["10:00", "11:00", "12:00", "13:00 (Comida)", "14:30", "15:30", "16:30", "17:30", "18:00 (Final)"];
    
    // Buscar 3 opciones de comida en la zona
    const restaurants = data.flatMap(p => p.restaurants || []).slice(0, 3);
    const middleIndex = Math.floor(data.length / 2);

    let html = '';
    data.forEach((poi, i) => {
        let hour = hours[i > middleIndex ? i + 1 : i] || "19:00"; // Asegurar que haya horas suficientes
        
        html += `
            <div class="timeline-item">
                <div class="time">${hour}</div>
                <div class="content">
                    <h4>${poi.name}</h4>
                    <p>${poi.location}</p>
                </div>
            </div>
        `;

        if (i === middleIndex) {
            html += `
                <div class="timeline-item lunch">
                    <div class="time">14:00</div>
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
    itineraryMap = L.map('itinerary-map').setView([data[0].lat, data[0].lon], 11);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(itineraryMap);

    const latlngs = data.map(p => [p.lat, p.lon]);
    
    data.forEach((p, i) => {
        L.marker([p.lat, p.lon])
            .addTo(itineraryMap)
            .bindPopup(`<b>Punto ${i+1}: ${p.name}</b>`);
    });

    L.polyline(latlngs, {color: 'var(--accent)', weight: 4, dashArray: '10, 10'}).addTo(itineraryMap);
    itineraryMap.fitBounds(L.latLngBounds(latlngs));
}

function renderSketchfab() {
    const container = document.getElementById('sketchfab-container');
    if (!container) return;
    
    // Modelos 3D Reales
    const details = [
        { name: "Canecillo Piasca", uid: "6ff35483791843d9a2b33a956fc37a9a", desc: "Detalle de la cornisa.", image: "colegiata_santa_juliana_santillana_1777204517020.png" },
        { name: "Pantocrátor Santillana", uid: "229f051da6a54d5cb5b608b500e94dd1", desc: "Cristo en Majestad del tímpano.", image: "colegiata_santa_juliana_santillana_1777204517020.png" },
        { name: "Capitel Santillana", uid: "036f7f21a8334cfe9526bc15c9a50da9", desc: "Escena historiada del claustro.", image: "colegiata_santa_juliana_santillana_1777204517020.png" },
        { name: "Canecillo Arpista Piasca", uid: "12791f7514414c52b5130f37325c779a", desc: "Músico románico esculpido.", image: "colegiata_santa_juliana_santillana_1777204517020.png" }
    ];

    container.innerHTML = details.map((d, index) => `
        <div class="card" style="cursor:default; height: 350px; display: flex; flex-direction: column;" id="sketchfab-card-${index}">
            <div class="card-img-container" style="flex: 1; position: relative; background: #eaeaea; display: flex; justify-content: center; align-items: center; overflow: hidden;" id="sketchfab-viewport-${index}">
                <img src="${d.image}" alt="${d.name}" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.75);">
                <button onclick="load3DModel(${index}, '${d.uid}', '${d.name}')" style="position: absolute; padding: 12px 24px; font-size: 0.9rem; font-weight: bold; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: var(--shadow); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🔌 Cargar Modelo 3D
                </button>
            </div>
            <div class="card-content" style="padding: 10px;">
                <h3 class="card-title">${d.name}</h3>
                <p style="font-size:0.85rem; color:var(--text-muted); margin: 0;">${d.desc}</p>
            </div>
        </div>
    `).join('');
}

// Función global para inyectar dinámicamente el iframe cuando el usuario lo solicite
window.load3DModel = function(index, uid, name) {
    const isMobile = window.innerWidth <= 768;
    const iframeHtml = `
        <iframe title="${name}" frameborder="0" allowfullscreen mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking" xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share src="https://sketchfab.com/models/${uid}/embed" style="width:100%; height:100%; border:none;"></iframe>
    `;

    if (isMobile) {
        // En móviles, abrir el modelo 3D en el detail-modal a pantalla completa para una mejor experiencia táctil y evitar atascos de scroll
        const detailModal = document.getElementById('detail-modal');
        const modalBody = document.getElementById('modal-body');
        if (detailModal && modalBody) {
            modalBody.innerHTML = `
                <h2 style="font-family:'Noto Serif', serif; color:var(--primary); margin-bottom:15px; text-align:center;">🏛️ Visita 3D: ${name}</h2>
                <div style="width: 100%; height: 60vh; border-radius: 8px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid rgba(28, 58, 107, 0.1);">
                    ${iframeHtml}
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 15px; font-style: italic;">
                    Usa un dedo para rotar el modelo en 3D y dos dedos para hacer zoom y desplazarte.
                </p>
            `;
            detailModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Bloquear scroll de la página de fondo
        }
    } else {
        // En escritorio, inyectar en la tarjeta directamente
        const viewport = document.getElementById(`sketchfab-viewport-${index}`);
        if (viewport) {
            viewport.innerHTML = iframeHtml;
        }
    }
}

// Renderizar la sección Saber Más (Libros y Artículos)
// Renderizar la sección Saber Más (Libros, Artículos, Guía de Viajes y SEO)
function renderLearnSection() {
    const articlesCont = document.getElementById('articles-container');
    const booksCont = document.getElementById('books-container');
    const learnData = window.learnData || { articles: [], books: [] };

    if (articlesCont) {
        articlesCont.innerHTML = learnData.articles.map(art => `
            <div class="card" style="cursor:default; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
                <div class="card-img-container" style="height:160px;">
                    <img src="${getOptimizedImageUrl(art.image, 400)}" alt="${art.title}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='colegiata_santa_juliana_santillana_1777204517020.png'">
                </div>
                <div class="card-content" style="padding:15px; flex-grow:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <h3 class="card-title" style="font-size:1.1rem; line-height:1.3; margin-bottom:5px;">${art.title}</h3>
                        <p style="font-size:0.8rem; color:var(--accent); font-weight:600; margin-bottom:10px;">Autor: ${art.author}</p>
                        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${art.description}</p>
                    </div>
                    <div style="margin-top:15px;">
                        <a href="${art.url}" target="_blank" class="btn-primary" style="display:block; text-align:center; font-size:0.85rem; text-decoration:none; padding:8px 15px;">📖 Leer Artículo</a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    if (booksCont) {
        booksCont.innerHTML = learnData.books.map(book => `
            <div class="card" style="cursor:default; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
                <div class="card-img-container" style="height:200px; display:flex; justify-content:center; align-items:center; background:#f4f7f6; padding:10px;">
                    <img src="${getOptimizedImageUrl(book.image, 300)}" alt="${book.title}" style="max-height:100%; max-width:100%; object-fit:contain; border-radius:4px; box-shadow:0 4px 6px rgba(0,0,0,0.1);" onerror="this.src='colegiata_santa_juliana_santillana_1777204517020.png'">
                </div>
                <div class="card-content" style="padding:15px; flex-grow:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <h3 class="card-title" style="font-size:1.1rem; line-height:1.3; margin-bottom:5px;">${book.title}</h3>
                        <p style="font-size:0.8rem; color:var(--accent); font-weight:600; margin-bottom:10px;">Autor: ${book.author}</p>
                        <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${book.description}</p>
                    </div>
                    <div style="margin-top:15px;">
                        <a href="${book.url}" target="_blank" class="btn-primary" style="display:block; text-align:center; font-size:0.85rem; text-decoration:none; padding:8px 15px; background:#ff9900; border-color:#ff9900; color:#111; font-weight:bold;">🛒 Ver en Amazon</a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Inyectar el apartado de relaciones estilísticas del románico
    renderStyleRelations();
}

// =========================================================================
// APARTADO INTERACTIVO: RELACIONES ESTILÍSTICAS DEL ROMÁNICO EN CANTABRIA
// =========================================================================
// Renderiza la tabla estructurada de corrientes estilísticas que nos ha enviado
// el usuario y configura un panel interactivo premium con tarjetas dinámicas
// para explorar cómo se vinculan los templos de Cantabria entre sí.
function renderStyleRelations() {
    const container = document.getElementById('style-relations-container');
    if (!container) return;

    // Datos estructurados de las corrientes estilísticas de Cantabria
    const focos = [
        {
            id: "colegiatas",
            name: "Grandes Colegiatas y Prioratos",
            emoji: "🏰",
            desc: "Obras cumbre de enorme complejidad volumétrica (fruto de la conversión de antiguos monasterios por el poder real). Destacan sus dobles arquerías, claustros, bóvedas y capiteles historiados de altísima calidad. Muestran fuertes influencias del románico dinástico (Jaca, León, Frómista) y de la abadía francesa de Cluny.",
            churchIds: [
                "colegiata-de-santa-juliana-santillana-del-mar",
                "colegiata-de-san-pedro-de-cervatos",
                "colegiata-de-san-mart-n-de-elines",
                "colegiata-de-santa-cruz-de-casta-eda",
                "iglesia-de-santa-mar-a-piasca"
            ]
        },
        {
            id: "septentrional",
            name: "Románico Septentrional (Costa y Valles Centrales)",
            emoji: "🌊",
            desc: "Emplazado en rutas de comercio marítimo y en el Camino de Santiago de la costa, se caracteriza por obras de gran envergadura técnica. Posee un complejo código escultórico con predominancia del bestiario (leones, aves, monstruos fantásticos) de gran intención moralizante y pedagógica.",
            churchIds: [
                "iglesia-de-santa-mar-a-bareyo",
                "iglesia-de-santa-mar-a-yermo",
                "iglesia-de-san-andr-s-argomilla",
                "iglesia-de-santa-mar-a-de-puerto-santo-a"
            ]
        },
        {
            id: "rural",
            name: "Románico Rural (Campoo y Valderredible)",
            emoji: "🌾",
            desc: "Iglesias de concejo con gran pureza tectónica (una sola nave, magnífica piedra de sillería) que funcionan como nexo estilístico con el románico del norte de Palencia y Burgos. Se distinguen por sus espadañas campurrianas (frecuentemente con escaleras exteriores) y el abundante románico erótico y satírico en sus canecillos.",
            churchIds: [
                "iglesia-de-san-cipriano-bolmir",
                "iglesia-de-santa-mar-a-la-mayor-villacantid",
                "iglesia-de-san-juan-bautista-loma-somera",
                "iglesia-de-santa-eulalia-bustasur",
                "iglesia-de-santa-eulalia-sopenilla",
                "iglesia-de-san-pedro-gervelas",
                "iglesia-de-san-pedro-castillo-pedroso"
            ]
        },
        {
            id: "eremitismo",
            name: "Eremitismo Rupestre (Prerrománico y Mozárabe)",
            emoji: "🪨",
            desc: "Supone la manifestación arquitectónica y religiosa más arcaica de la región, conformada por templos tallados directamente en la roca arenisca del valle del Ebro. Presentan una relación arquitectónica directa con la corriente mozárabe (arcos de herradura, pilares de palmera) y el prerrománico asturiano (arcos peraltados).",
            churchIds: [
                "iglesia-rupestre-de-arroyuelos"
            ]
        },
        {
            id: "lebaniega",
            name: "Escuela Románica Lebaniega",
            emoji: "⛰️",
            desc: "Marcada por el aislamiento de sus montañas, sus iglesias mantienen un arraigo a formas más tradicionales. Se observan fábricas más rústicas a base de mampostería, decoración sumamente sobria, pervivencias mozárabes y un empleo muy característico de la decoración con 'puntas de diamante'.",
            churchIds: [
                "iglesia-de-santa-mar-a-lebe-a"
            ]
        }
    ];

    container.innerHTML = `
        <div class="style-relations-panel" style="margin-top: 20px;">
            <div class="travel-header-banner" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); padding: 35px; border-radius: 12px; color: white; margin-bottom: 40px; box-shadow: var(--shadow);">
                <h3 style="font-family:'Noto Serif', serif; color: white; font-size: 1.8rem; margin-bottom: 10px;">🔬 Corrientes y Relaciones Estilísticas del Románico</h3>
                <p style="font-size: 1rem; opacity: 0.9; max-width: 800px; line-height: 1.6;">
                    La encrucijada geográfica de Cantabria originó una marcada polarización de estilos: desde la finura técnica en el norte hasta las pervivencias mozárabes en Liébana y el románico rural erótico del sur.
                </p>
            </div>

            <!-- Tabla de datos estructurada -->
            <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 40px; border: 1px solid rgba(0,0,0,0.05); overflow-x: auto;">
                <h4 style="font-family:'Noto Serif', serif; color: var(--primary); font-size: 1.3rem; margin-top: 0; margin-bottom: 20px; border-bottom: 2px solid var(--accent); padding-bottom: 8px;">📊 Tabla de Focos Monumentales</h4>
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.92rem; line-height: 1.5;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--primary); color: var(--primary); font-weight: bold; background: rgba(28, 58, 107, 0.02);">
                            <th style="padding: 15px; width: 25%;">Foco / Corriente Estilística</th>
                            <th style="padding: 15px; width: 50%;">Relaciones y Características de Estilo</th>
                            <th style="padding: 15px; width: 25%;">Ejemplos de Templos Relacionados</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${focos.map((f, index) => `
                            <tr style="border-bottom: 1px solid rgba(0,0,0,0.05); background: ${index % 2 === 0 ? 'transparent' : 'rgba(28, 58, 107, 0.01)'}">
                                <td style="padding: 15px; font-weight: bold; color: var(--primary); font-size: 0.95rem;">${f.emoji} ${f.name}</td>
                                <td style="padding: 15px; color: var(--text-main); text-align: justify;">${f.desc}</td>
                                <td style="padding: 15px; font-weight: 600; color: var(--accent); font-style: italic;">
                                    ${f.churchIds.map(id => {
                                        const poi = poiData.find(p => p.id === id);
                                        return poi ? `<a href="#list-view" onclick="window.openDetailById('${id}')" style="color: var(--accent); text-decoration: none; display: block; margin-bottom: 5px; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--accent)'">🏰 ${poi.name}</a>` : '';
                                    }).join('')}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Buscador e interactividad de relaciones -->
            <div style="background: var(--surface-highest); padding: 30px; border-radius: 12px; border: 1px solid rgba(28, 58, 107, 0.08); box-shadow: var(--shadow); margin-bottom: 40px;">
                <h4 style="font-family:'Noto Serif', serif; color: var(--primary); font-size: 1.3rem; margin-top: 0; margin-bottom: 15px; text-align: center;">🔬 Explorador de Corrientes del Románico</h4>
                <p style="text-align: center; font-size: 0.9rem; color: var(--text-muted); margin-bottom: 25px;">Selecciona una corriente para filtrar dinámicamente los templos vinculados y ver cómo se relacionan artísticamente.</p>
                
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 30px;">
                    ${focos.map(f => `
                        <button class="learn-tab-btn" onclick="window.selectStyleRelationsFocus('${f.id}')" id="btn-focus-${f.id}" style="width: auto; padding: 10px 20px; font-size: 0.85rem; font-weight: bold; border-radius: 20px; background: white; border: 1px solid rgba(28, 58, 107, 0.15); color: var(--primary); cursor: pointer; transition: all 0.2s;">
                            ${f.emoji} ${f.name}
                        </button>
                    `).join('')}
                </div>

                <div id="style-focus-results" style="display: none; background: white; padding: 25px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.05); box-shadow: var(--shadow);">
                    <h5 id="style-focus-title" style="font-family:'Noto Serif', serif; color: var(--primary); font-size: 1.15rem; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;"></h5>
                    <p id="style-focus-desc" style="font-size: 0.9rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px; text-align: justify;"></p>
                    
                    <h6 style="font-weight: 700; color: var(--primary); font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        🏰 Iglesias Vinculadas a este Foco en la Guía:
                    </h6>
                    <div id="style-focus-grid" class="magical-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                        <!-- Tarjetas inyectadas dinámicamente -->
                    </div>
                </div>
            </div>

            <!-- NUEVA SECCIÓN: RED DE AFINIDADES E IGLESIAS CONECTADAS ENTRE SÍ -->
            <div style="background: var(--surface-highest); padding: 30px; border-radius: 12px; border: 1px solid rgba(28, 58, 107, 0.08); box-shadow: var(--shadow);">
                <h4 style="font-family:'Noto Serif', serif; color: var(--primary); font-size: 1.4rem; margin-top: 0; margin-bottom: 10px; text-align: center;">🔗 Red de Afinidades e Iglesias Conectadas</h4>
                <p style="text-align: center; font-size: 0.9rem; color: var(--text-muted); margin-bottom: 25px; max-width: 700px; margin-left: auto; margin-right: auto;">
                    Selecciona un templo de origen para descubrir cuáles son las iglesias de Cantabria más vinculadas estilística, artística y geográficamente a través de nuestra red de conexiones.
                </p>

                <div class="relations-layout">
                    <!-- Mapa interactivo de la red de conexiones (Leaflet) -->
                    <div class="relations-map-wrapper">
                        <h5 class="relations-map-title">🗺️ Mapa de Conexiones de Estilo y Ruta</h5>
                        <div id="relations-network-map" class="relations-map"></div>
                    </div>

                    <!-- Selector de Templo e Iglesias sugeridas -->
                    <div class="relations-panel-sidebar">
                        <div class="relation-selector-card">
                            <label for="relation-source-select">Selecciona el Templo de Origen:</label>
                            <select id="relation-source-select" class="relation-select" onchange="window.updateChurchRelations(this.value)">
                                <!-- Opciones inyectadas dinámicamente -->
                            </select>
                        </div>

                        <!-- Listado de tarjetas de iglesias afines -->
                        <div id="relations-results" class="relations-results-list">
                            <!-- Inyectado dinámicamente -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Cargar los templos ordenados alfabéticamente en el selector
    setTimeout(() => {
        const selectEl = document.getElementById('relation-source-select');
        if (selectEl && window.poiData) {
            const sortedPois = [...window.poiData].sort((a, b) => a.name.localeCompare(b.name));
            selectEl.innerHTML = sortedPois.map(poi => `<option value="${poi.id}">${poi.name}</option>`).join('');
            
            if (sortedPois.length > 0) {
                // Colegiata de Santa Juliana por defecto
                const juliana = sortedPois.find(p => p.id.includes('santa-juliana'));
                const defaultId = juliana ? juliana.id : sortedPois[0].id;
                selectEl.value = defaultId;
                
                // Si la pestaña está activa, inicializar mapa
                const tabBtn = document.querySelector('.learn-tab-btn[data-learn-tab="style-relations"]');
                if (tabBtn && tabBtn.classList.contains('active')) {
                    window.initRelationsMap(defaultId);
                }
            }
        }
    }, 100);
}

// Permite filtrar e interactuar con las iglesias vinculadas al foco estilístico
window.selectStyleRelationsFocus = (focusId) => {
    const buttons = ["colegiatas", "septentrional", "rural", "eremitismo", "lebaniega"];
    buttons.forEach(id => {
        const btn = document.getElementById(`btn-focus-${id}`);
        if (btn) {
            btn.style.background = 'white';
            btn.style.color = 'var(--primary)';
            btn.style.borderColor = 'rgba(28, 58, 107, 0.15)';
        }
    });

    const activeBtn = document.getElementById(`btn-focus-${focusId}`);
    if (activeBtn) {
        activeBtn.style.background = 'var(--primary)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'var(--primary)';
    }

    const focos = {
        colegiatas: {
            title: "Grandes Colegiatas y Prioratos",
            desc: "Representan la cúspide de la complejidad arquitectónica y escultórica en Cantabria. Al ser conversiones de antiguos cenobios bajo patrocinio real o de grandes linajes, exhiben una elaborada planificación espacial de influencia de Cluny y el románico de autopista (Camino de Santiago dinástico).",
            churchIds: [
                "colegiata-de-santa-juliana-santillana-del-mar",
                "colegiata-de-san-pedro-de-cervatos",
                "colegiata-de-san-mart-n-de-elines",
                "colegiata-de-santa-cruz-de-casta-eda",
                "iglesia-de-santa-mar-a-piasca"
            ]
        },
        septentrional: {
            title: "Románico Septentrional (Costa y Valles Centrales)",
            desc: "Ligado a las comarcas marineras y la Trasmiera, este estilo destaca por templos con fachadas de sillería de gran prestancia y un fascinante repertorio escultórico de bestiario (leones, centauros, monstruos campurrianos y mitológicos) empleado con fines pedagógicos y morales.",
            churchIds: [
                "iglesia-de-santa-mar-a-bareyo",
                "iglesia-de-santa-mar-a-yermo",
                "iglesia-de-san-andr-s-argomilla",
                "iglesia-de-santa-mar-a-de-puerto-santo-a"
            ]
        },
        rural: {
            title: "Románico Rural (Campoo y Valderredible)",
            desc: "Característico de los pequeños concejos agrarios del sur. Son iglesias de una sola nave con ábsides muy bien esculpidos, famosas por sus espadañas integradas y un profuso catálogo de canecillos eróticos, burlescos o satíricos de gran libertad artística.",
            churchIds: [
                "iglesia-de-san-cipriano-bolmir",
                "iglesia-de-santa-mar-a-la-mayor-villacantid",
                "iglesia-de-san-juan-bautista-loma-somera",
                "iglesia-de-santa-eulalia-bustasur",
                "iglesia-de-santa-eulalia-sopenilla",
                "iglesia-de-san-pedro-gervelas",
                "iglesia-de-san-pedro-castillo-pedroso"
            ]
        },
        eremitismo: {
            title: "Eremitismo Rupestre (Prerrománico y Mozárabe)",
            desc: "La manifestación más primigenia del cristianismo en la región, constituida por cuevas artificiales e iglesias excavadas directamente en la roca arenisca del alto Ebro, con reminiscencias mozárabes (arcos de herradura y pilares palmera).",
            churchIds: [
                "iglesia-rupestre-de-arroyuelos"
            ]
        },
        lebaniega: {
            title: "Escuela Románica Lebaniega",
            desc: "Focos geográficamente aislados en los Picos de Europa. Se caracterizan por mantener un fuerte arraigo a las tradiciones locales mozárabes y asturianas, fábricas rústicas y un profuso uso de la ornamentación geométrica de 'punta de diamante' en arcos e impostas.",
            churchIds: [
                "iglesia-de-santa-mar-a-lebe-a"
            ]
        }
    };

    // Ajustar listado de IDs eliminando duplicados si los hubiera
    if (focusId === 'rural') {
        selChurchIds = [
            "iglesia-de-san-cipriano-bolmir",
            "iglesia-de-santa-mar-a-la-mayor-villacantid",
            "iglesia-de-san-juan-bautista-loma-somera",
            "iglesia-de-santa-eulalia-bustasur",
            "iglesia-de-santa-eulalia-sopenilla",
            "iglesia-de-san-pedro-gervelas",
            "iglesia-de-san-pedro-castillo-pedroso"
        ];
    } else {
        selChurchIds = focos[focusId].churchIds;
    }

    const sel = focos[focusId];
    if (!sel) return;

    document.getElementById('style-focus-results').style.display = 'block';
    document.getElementById('style-focus-title').innerHTML = `🔬 Foco: ${sel.title}`;
    document.getElementById('style-focus-desc').innerHTML = sel.desc;

    const grid = document.getElementById('style-focus-grid');
    if (!grid) return;

    grid.innerHTML = '';
    selChurchIds.forEach(id => {
        const poi = poiData.find(p => p.id === id);
        if (poi) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div class="card-img-container" style="height:140px;">
                    <img src="${poi.images[0]}" alt="${poi.name}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="card-content" style="padding:15px;">
                    <h4 class="card-title" style="font-size:1.05rem; margin-bottom:5px; color:var(--primary);">${poi.name}</h4>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">📍 ${poi.location}</p>
                </div>
            `;
            card.addEventListener('click', () => {
                document.querySelector('[data-view="list"]').click();
                openDetail(poi);
            });
            grid.appendChild(card);
        }
    });
};

// =========================================================================
// GESTIÓN DEL MAPA INTERACTIVO DE RELACIONES Y RED DE AFINIDADES
// =========================================================================

window.initRelationsMap = (startId) => {
    const mapContainer = document.getElementById('relations-network-map');
    if (!mapContainer) return;

    if (window.relationsMap) {
        window.relationsMap.invalidateSize();
        if (startId) window.updateChurchRelations(startId);
        return;
    }

    // Inicializar mapa de Leaflet centrado en Cantabria
    window.relationsMap = L.map('relations-network-map', {
        zoomControl: true,
        scrollWheelZoom: false
    }).setView([43.2, -4.0], 9);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: 'Google Maps'
    }).addTo(window.relationsMap);

    setTimeout(() => {
        window.relationsMap.invalidateSize();
        if (startId) window.updateChurchRelations(startId);
    }, 150);
};

window.updateChurchRelations = (sourceId) => {
    const sourcePoi = window.poiData.find(p => p.id === sourceId);
    if (!sourcePoi) return;

    // Sincronizar el select dropdown
    const selectEl = document.getElementById('relation-source-select');
    if (selectEl) {
        selectEl.value = sourceId;
    }

    // Calcular templos afines
    const affinities = calculateAffinities(sourcePoi).slice(0, 4);

    // Actualizar listado en sidebar
    const resultsContainer = document.getElementById('relations-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = affinities.map(aff => {
            const p = aff.poi;
            const reasonsHtml = aff.reasons.map(r => `<li>${r}</li>`).join('');
            const mainImg = p.images && p.images.length > 0 ? p.images[0] : '';
            const imgHtml = mainImg 
                ? `<img src="${mainImg}" alt="${p.name}">`
                : `<div class="card-img-placeholder" style="min-height: 100px; height: 100%; font-size: 0.65rem; padding: 10px;"></div>`;
            return `
                <div class="relation-card" data-church-id="${p.id}" onmouseover="window.highlightRelationLine('${p.id}', true)" onmouseout="window.highlightRelationLine('${p.id}', false)">
                    <div class="relation-card-thumb">
                        ${imgHtml}
                    </div>
                    <div class="relation-card-info">
                        <div>
                            <div class="relation-card-title-row">
                                <h6 class="relation-card-title">${p.name}</h6>
                                <span class="affinity-badge">${aff.affinity}% Afinidad</span>
                            </div>
                            <p class="relation-card-subtitle">📍 ${p.location} • 📏 a ${aff.distance.toFixed(1)} km</p>
                            <ul class="relation-card-reasons" style="margin: 0; padding-left: 15px; font-size: 0.78rem;">
                                ${reasonsHtml}
                            </ul>
                        </div>
                        <div class="relation-card-actions" style="margin-top: 10px;">
                            <button class="relation-btn relation-btn-primary" onclick="window.openDetailById('${p.id}')">Ver Ficha</button>
                            <button class="relation-btn relation-btn-secondary" onclick="window.updateChurchRelations('${p.id}')">Centrar Relación 🎯</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Actualizar el mapa
    if (!window.relationsMap) return;

    if (!window.relationsMapLayers) {
        window.relationsMapLayers = [];
    }
    // Eliminar capas/líneas anteriores
    window.relationsMapLayers.forEach(layer => window.relationsMap.removeLayer(layer));
    window.relationsMapLayers = [];

    // Marcador principal (Origen)
    const sourceIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #d45d00; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const sourceMarker = L.marker([sourcePoi.lat, sourcePoi.lon], {icon: sourceIcon})
        .addTo(window.relationsMap)
        .bindPopup(`<b>Origen: ${sourcePoi.name}</b><br>📍 ${sourcePoi.location}`);
    
    window.relationsMapLayers.push(sourceMarker);

    const points = [[sourcePoi.lat, sourcePoi.lon]];
    window.relationsMapLines = {};

    // Marcadores destinos y líneas
    affinities.forEach(aff => {
        const p = aff.poi;
        points.push([p.lat, p.lon]);

        const destIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #1c3a6b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        const destMarker = L.marker([p.lat, p.lon], {icon: destIcon})
            .addTo(window.relationsMap)
            .bindPopup(`<b>${p.name}</b><br>📍 ${p.location}<br>Afinidad: ${aff.affinity}%<br>Distancia: ${aff.distance.toFixed(1)} km`);
        
        window.relationsMapLayers.push(destMarker);

        // Línea punteada
        const polyline = L.polyline([[sourcePoi.lat, sourcePoi.lon], [p.lat, p.lon]], {
            color: '#d45d00',
            weight: 3,
            dashArray: '5, 8',
            opacity: 0.65
        }).addTo(window.relationsMap);

        polyline.bindPopup(`Conexión: ${aff.affinity}% de afinidad con ${p.name}`);

        window.relationsMapLayers.push(polyline);
        window.relationsMapLines[p.id] = polyline;
    });

    // Ajustar límites del mapa
    window.relationsMap.fitBounds(L.latLngBounds(points), {padding: [40, 40]});
};

window.highlightRelationLine = (churchId, highlight) => {
    if (window.relationsMapLines && window.relationsMapLines[churchId]) {
        const line = window.relationsMapLines[churchId];
        if (highlight) {
            line.setStyle({
                color: '#1c3a6b',
                weight: 5,
                dashArray: 'none',
                opacity: 0.95
            });
            line.bringToFront();
        } else {
            line.setStyle({
                color: '#d45d00',
                weight: 3,
                dashArray: '5, 8',
                opacity: 0.65
            });
        }
    }
};

// Función global para compartir en redes
window.shareContent = function(type, title, text, url) {
    const encodedText = encodeURIComponent(title + "\n\n" + text + "\n\nEnlace: " + url);
    if(type === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    } else if(type === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + " - " + text)}`, '_blank');
    }
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

            // Cerrar menú móvil y overlay de forma fluida si está abierto
            const hamburgerBtn = document.getElementById('hamburger-btn');
            const magicalNav = document.querySelector('.magical-nav');
            const menuOverlay = document.getElementById('menu-overlay');
            if (hamburgerBtn && hamburgerBtn.classList.contains('open')) {
                hamburgerBtn.classList.remove('open');
                if (magicalNav) magicalNav.classList.remove('open');
                if (menuOverlay) menuOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
            if(view === 'map') setTimeout(() => map.invalidateSize(), 100);
            if(view === 'itinerary' && itineraryMap) setTimeout(() => itineraryMap.invalidateSize(), 100);
            if(view === 'community') renderComments();
            if(view === 'profile') updateProfileForm();
            
            // Mostrar o ocultar controles de búsqueda según la sección activa
            // Modificado: Se incluye 'agenda' para que el buscador sea visible al ver los eventos culturales
            const controlsSection = document.querySelector('.controls-section');
            if (controlsSection) {
                if (view === 'list' || view === 'restaurants' || view === 'agenda') {
                    controlsSection.style.display = 'block';
                    const secondarySearch = document.querySelector('.secondary-search');
                    const primarySearch = document.querySelector('.search-bar:not(.secondary-search)');
                    if (view === 'list') {
                        if (primarySearch) primarySearch.style.display = 'block';
                        if (secondarySearch) secondarySearch.style.display = 'none';
                    } else {
                        if (primarySearch) primarySearch.style.display = 'none';
                        if (secondarySearch) secondarySearch.style.display = 'block';
                    }
                } else {
                    controlsSection.style.display = 'none';
                }
            }
        });
    });

    document.getElementById('btn-gen-itinerary').addEventListener('click', generateItinerary);

    document.getElementById('filter-zone').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('filter-order').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('filter-culture').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('sort-by').addEventListener('change', () => { renderList(); renderMarkers(); });
    document.getElementById('search-input').addEventListener('input', () => { renderList(); renderMarkers(); updateLocalityInfo(); });
    // Registrar evento de búsqueda para actualizar la agenda, crónicas de prensa y el catálogo de restaurantes al escribir
    document.getElementById('search-extra').addEventListener('input', () => { 
        renderAgenda(); 
        renderNews();
        renderRestaurants(); 
    });

    // Control de pestañas en la Agenda (Eventos vs Crónicas de Prensa)
    const agendaTabBtns = document.querySelectorAll('.agenda-tab-btn');
    agendaTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.agendaTab;
            
            agendaTabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(0,0,0,0.05)';
                b.style.color = 'var(--text)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';

            const eventsContent = document.getElementById('events-tab-content');
            const newsContent = document.getElementById('news-tab-content');

            if (tab === 'events') {
                if (eventsContent) eventsContent.style.display = 'block';
                if (newsContent) newsContent.style.display = 'none';
            } else {
                if (eventsContent) eventsContent.style.display = 'none';
                if (newsContent) newsContent.style.display = 'block';
                // Si la sección de noticias está vacía, cargamos por primera vez
                if (newsData.length === 0) {
                    loadNews();
                }
            }
        });
    });

    // Listeners para controles del mapa general
    const mapLayerSelect = document.getElementById('map-layer-select');
    if (mapLayerSelect) mapLayerSelect.addEventListener('change', renderMarkers);

    const mapComarcaSelect = document.getElementById('map-comarca-select');
    if (mapComarcaSelect) mapComarcaSelect.addEventListener('change', renderMarkers);

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => {
                if (m.id === 'detail-modal') {
                    closeDetail();
                } else {
                    m.classList.remove('active');
                }
            });
        });
    });

    // Formularios de Autenticación
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Botones de Google Auth
    const btnGoogleRegister = document.getElementById('btn-google-register');
    if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', handleGoogleLogin);

    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', handleGoogleLogin);

    // Toggle de pestañas en modal Auth
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const formEl = document.getElementById(`${tab}-form`);
            if (formEl) formEl.classList.add('active');
        });
    });

    // Medidor de fuerza de contraseña y toggle de ver contraseña
    const regPass = document.getElementById('reg-pass');
    if (regPass) regPass.addEventListener('input', checkPasswordStrength);

    document.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.pass-wrapper');
            if (wrapper) {
                const input = wrapper.querySelector('input');
                if (input.type === 'password') {
                    input.type = 'text';
                    e.target.textContent = '🙈';
                } else {
                    input.type = 'password';
                    e.target.textContent = '👁️';
                }
            }
        });
    });

    // Listeners para pestañas de aprendizaje
    document.querySelectorAll('.learn-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.learnTab;
            document.querySelectorAll('.learn-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.learn-tab-content').forEach(c => c.style.display = 'none');
            const targetContent = document.getElementById(`learn-tab-content-${tab}`);
            if (targetContent) targetContent.style.display = 'block';

            // Si se selecciona la pestaña de relaciones estilísticas, inicializar o redimensionar el mapa de relaciones
            if (tab === 'style-relations') {
                const selectEl = document.getElementById('relation-source-select');
                const currentId = selectEl ? selectEl.value : null;
                setTimeout(() => {
                    window.initRelationsMap(currentId);
                }, 100);
            }
        });
    });

    // Listener para formulario de newsletter
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('news-email');
            const statusDiv = document.getElementById('newsletter-status');
            const email = emailInput.value.trim().toLowerCase();
            
            if (email) {
                // Guardar en suscriptores locales
                let subscribers = JSON.parse(localStorage.getItem('romanico_subscribers') || '[]');
                if (!subscribers.includes(email)) {
                    subscribers.push(email);
                    localStorage.setItem('romanico_subscribers', JSON.stringify(subscribers));
                }
                
                // Actualizar la interfaz con mensaje de éxito
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#27ae60';
                statusDiv.textContent = '¡Gracias por suscribirte! Te hemos enviado un correo de bienvenida.';
                emailInput.value = '';
                
                // Ocultar mensaje tras 5 segundos
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 5000);
            } else {
                // Mostrar advertencia visual si el correo está vacío
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#e74c3c';
                statusDiv.textContent = 'Por favor, introduce una dirección de correo electrónico.';
                
                // Ocultar mensaje tras 5 segundos
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 5000);
            }
        });
    }

    window.openDetailById = id => {
        const poi = poiData.find(p => p.id === id);
        if(poi) openDetail(poi);
    };

    // Listeners del Perfil del Viajero
    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileSave);

    const btnProfileLogout = document.getElementById('btn-profile-logout');
    if (btnProfileLogout) btnProfileLogout.addEventListener('click', handleLogout);
}

// --- Funciones del Sistema de Autenticación y Gamificación ---

function handleRegister(e) {
    e.preventDefault();
    const user = document.getElementById('reg-fullname').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass').value;
    const passConfirm = document.getElementById('reg-pass-confirm').value;
    const country = document.getElementById('reg-country').value.trim();
    const city = document.getElementById('reg-city').value.trim();
    const province = document.getElementById('reg-province').value.trim();
    const statusMsg = document.getElementById('reg-status');

    if (!user || !email || !pass || !passConfirm || !country || !city || !province) {
        statusMsg.textContent = "Por favor, completa todos los campos.";
        statusMsg.style.color = "red";
        return;
    }

    // Validación del formato de email con expresión regular estándar
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        statusMsg.textContent = "Por favor, introduce un correo electrónico válido.";
        statusMsg.style.color = "red";
        return;
    }

    // Validación de coincidencia de contraseñas
    if (pass !== passConfirm) {
        statusMsg.textContent = "Las contraseñas no coinciden.";
        statusMsg.style.color = "red";
        return;
    }

    if (pass.length < 6) {
        statusMsg.textContent = "La contraseña debe tener al menos 6 caracteres.";
        statusMsg.style.color = "red";
        return;
    }

    statusMsg.textContent = "Registrando noble viajero, por favor espera...";
    statusMsg.style.color = "blue";

    if (supabaseClient) {
        // Registro de usuario en Supabase (servidor realiza el hashing y validación)
        supabaseClient.auth.signUp({
            email: email,
            password: pass,
            options: {
                data: {
                    username: user,
                    full_name: user, // Sincronizado para que coincida con el trigger SQL de public.profiles
                    country: country,
                    city: city,
                    province: province
                }
            }
        })
        .then(({ data, error }) => {
            if (error) throw error;
            statusMsg.textContent = "✅ ¡Registro enviado! Revisa tu correo electrónico para confirmar tu cuenta y acceder.";
            statusMsg.style.color = "green";
            e.target.reset();
        })
        .catch(err => {
            console.error("Error en registro de Supabase:", err);
            statusMsg.textContent = "❌ Error: " + err.message;
            statusMsg.style.color = "red";
        });
    } else {
        // Registro de usuario en el Servidor Local Fallback (Express + JSON)
        const newUser = {
            username: user,
            email: email,
            password: pass,
            country: country,
            city: city,
            province: province,
            visited: [],
            role: 'user'
        };

        fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newUser)
        })
        .then(async response => {
            if (!response.ok) {
                const errData = await safeJson(response);
                throw new Error(errData.error || response.statusText);
            }
            return safeJson(response);
        })
        .then(data => {
            console.log("Registro en backend local completado:", data);
            
            // Si el servidor ha verificado automáticamente la cuenta (sin SMTP)
            if (data.autoVerified) {
                statusMsg.textContent = "✅ ¡Registro completado con éxito! Tu cuenta se ha activado automáticamente por estar en entorno de desarrollo. Ya puedes iniciar sesión.";
                statusMsg.style.color = "green";
            } else {
                statusMsg.textContent = "✅ ¡Registro recibido! Se ha enviado un pergamino de verificación a tu correo. Revisa la consola del servidor para el enlace.";
                statusMsg.style.color = "green";
            }
            
            // Reiniciar el formulario de registro
            e.target.reset();
            
            // Si el servidor está usando Ethereal en desarrollo y hay previsualización de correo
            if (data.previewUrl) {
                console.log(`🔗 [DESARROLLO] Previsualización del correo de confirmación: ${data.previewUrl}`);
            }
        })
        .catch(error => {
            console.error("Error al sincronizar registro con servidor local:", error);
            statusMsg.textContent = "❌ Error: " + error.message;
            statusMsg.style.color = "red";
        });
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;

    if (!email || !pass) {
        alert("Por favor, introduce tu correo y contraseña.");
        return;
    }

    if (supabaseClient) {
        // Inicio de sesión en Supabase (el estado se propaga a través de onAuthStateChange)
        supabaseClient.auth.signInWithPassword({
            email: email,
            password: pass
        })
        .then(async ({ data, error }) => {
            if (error) throw error;

            // Incrementar login_count en profiles de Supabase para este usuario
            try {
                if (data && data.user) {
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('login_count')
                        .eq('id', data.user.id)
                        .single();

                    const currentCount = profile ? (profile.login_count || 0) : 0;
                    await supabaseClient
                        .from('profiles')
                        .update({ login_count: currentCount + 1 })
                        .eq('id', data.user.id);
                }
            } catch (err) {
                console.error("Error al incrementar login_count en Supabase:", err);
            }

            document.getElementById('auth-modal').classList.remove('active');
            e.target.reset();
        })
        .catch(err => {
            console.error("Error en login Supabase:", err);
            alert("❌ " + err.message);
        });
    } else {
        // Inicio de sesión en el Servidor Local Fallback
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password: pass })
        })
        .then(async response => {
            if (!response.ok) {
                const errData = await safeJson(response);
                throw new Error(errData.error || "Error de inicio de sesión.");
            }
            return safeJson(response);
        })
        .then(data => {
            if (data.success) {
                setCurrentUser(data.user);
                document.getElementById('auth-modal').classList.remove('active');
                e.target.reset();
                
                // Redirigir y hacer foco en pendientes
                document.querySelector('[data-view="list"]').click();
                const pendingSec = document.getElementById('pending-section');
                if (pendingSec) pendingSec.scrollIntoView({ behavior: 'smooth' });
            }
        })
        .catch(error => {
            console.error("Error al autenticar en servidor local:", error);
            alert("❌ " + error.message);
        });
    }
}

function handleGoogleLogin() {
    if (supabaseClient) {
        const authUrl = `${window.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin)}`;
        
        // Deshabilitar botón temporalmente para indicar progreso
        const btnGoogleLogin = document.getElementById('btn-google-login') || document.getElementById('btn-google-register');
        const originalText = btnGoogleLogin ? btnGoogleLogin.innerHTML : '';
        if (btnGoogleLogin) {
            btnGoogleLogin.disabled = true;
            btnGoogleLogin.innerHTML = '<span>Verificando conexión...</span>';
        }
        
        // Validación previa (pre-flight)
        fetch(authUrl, { redirect: 'manual' })
            .then(async response => {
                if (btnGoogleLogin) {
                    btnGoogleLogin.disabled = false;
                    btnGoogleLogin.innerHTML = originalText;
                }
                
                if (response.status === 400) {
                    const errData = await response.json();
                    if (errData.msg && errData.msg.includes('Unsupported provider')) {
                        // El proveedor no está configurado en Supabase, ofrecemos el fallback local
                        const usarSimulado = confirm(
                            "El inicio de sesión con Google no está configurado en tu proyecto de Supabase (Falta el secreto de cliente OAuth).\n\n" +
                            "¿Deseas usar el inicio de sesión con Google simulado (modo desarrollo local)?"
                        );
                        if (usarSimulado) {
                            ejecutarGoogleLoginSimulado();
                        }
                        return;
                    }
                }
                // Si la respuesta es exitosa (redirección normal con status 0) o no es error 400
                window.location.href = authUrl;
            })
            .catch(error => {
                console.warn("Error comprobando el proveedor de Google, intentando redirección directa:", error);
                if (btnGoogleLogin) {
                    btnGoogleLogin.disabled = false;
                    btnGoogleLogin.innerHTML = originalText;
                }
                window.location.href = authUrl;
            });
    } else {
        ejecutarGoogleLoginSimulado();
    }
}

function ejecutarGoogleLoginSimulado() {
    const name = prompt("Google Auth (Simulado) - Introduce tu nombre completo:", "Viajero de Google");
    if (!name) return;
    const email = prompt("Google Auth (Simulado) - Introduce tu correo de Google:", "google-traveller@gmail.com");
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("El correo de Google introducido no es válido.");
        return;
    }

    fetch('/api/auth/google', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email })
    })
    .then(async response => {
        if (!response.ok) {
            const errData = await safeJson(response);
            throw new Error(errData.error || "Error de autenticación.");
        }
        return safeJson(response);
    })
    .then(data => {
        if (data.success) {
            setCurrentUser(data.user);
            document.getElementById('auth-modal').classList.remove('active');
            alert("✅ Sesión iniciada correctamente con Google (Simulado).");
            
            // Redirigir al inicio
            document.querySelector('[data-view="list"]').click();
        }
    })
    .catch(error => {
        console.error("Error al autenticar con Google local:", error);
        alert("❌ Error: " + error.message);
    });
}

function checkEmailVerificationParams() {
    // Si venimos de la redirección del enlace de verificación del servidor local: e.g. /#profile-view?verified=true&email=...
    const hash = window.location.hash;
    if (hash.includes('verified=true')) {
        // Extraer los parámetros de la URL del hash
        const parts = hash.split('?');
        if (parts.length > 1) {
            const params = new URLSearchParams(parts[1]);
            const email = params.get('email');
            if (email) {
                // Mostrar alerta premium
                alert(`🎉 ¡Excelente, noble viajero! Tu correo electrónico (${email}) ha sido verificado con éxito. Ya puedes iniciar sesión en tu cuenta.`);
                
                // Abrir el modal de login automáticamente
                setTimeout(() => {
                    const authModal = document.getElementById('auth-modal');
                    if (authModal) {
                        authModal.classList.add('active');
                        // Seleccionar la pestaña de login
                        const loginBtn = document.querySelector('.tab-btn[data-tab="login"]');
                        if (loginBtn) loginBtn.click();
                    }
                }, 500);
                
                // Limpiar el hash de verificación de forma limpia
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            }
        }
    }
}

function setCurrentUser(user) {
    currentUser = user;
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(CURRENT_USER_KEY);
    }
    updateAuthUI();
    updateProfileForm();
    renderList();
    renderMarkers();
    updateProgress();
    renderPendingChurches();
    renderAdminPanel();
    renderUserRanking();
    renderComments();
}

function handleLogout() {
    setCurrentUser(null);
    alert("Sesión cerrada correctamente.");
    // Redirigir a la colección general
    document.querySelector('[data-view="list"]').click();
}

function updateAuthUI() {
    const authContainer = document.getElementById('auth-header-container');
    if (!authContainer) return;

    const navProfile = document.getElementById('nav-profile');
    if (currentUser) {
        if (navProfile) navProfile.style.display = 'inline-block';
        const prefix = currentUser.role === 'admin' ? '⚙️ ' : '👑 ';
        authContainer.innerHTML = `
            <span style="font-weight:600; color:var(--primary); font-size:0.9rem; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prefix}${currentUser.username}</span>
            <button id="btn-logout" class="btn-auth" style="background:var(--accent); font-size:0.8rem; padding: 5px 10px;">Salir</button>
        `;
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.addEventListener('click', handleLogout);
    } else {
        if (navProfile) navProfile.style.display = 'none';
        authContainer.innerHTML = `
            <button id="btn-login" class="btn-auth">Iniciar Sesión</button>
        `;
        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) {
            btnLogin.addEventListener('click', () => {
                document.getElementById('auth-modal').classList.add('active');
            });
        }
    }
}

function updateProfileForm() {
    const navProfile = document.getElementById('nav-profile');
    const profileEmail = document.getElementById('profile-email');
    const profileFullname = document.getElementById('profile-fullname');
    const profileCountry = document.getElementById('profile-country');
    const profileCity = document.getElementById('profile-city');
    const profileProvince = document.getElementById('profile-province');
    
    // Contadores globales de suscriptores
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const globalCountEl = document.getElementById('global-subscribers-count');
    const communityCountEl = document.getElementById('community-subscribers-count');
    if (globalCountEl) globalCountEl.textContent = users.length;
    if (communityCountEl) communityCountEl.textContent = users.length;

    if (currentUser) {
        if (navProfile) navProfile.style.display = 'inline-block';
        if (profileEmail) profileEmail.value = currentUser.email;
        if (profileFullname) profileFullname.value = currentUser.username;
        if (profileCountry) profileCountry.value = currentUser.country || '';
        if (profileCity) profileCity.value = currentUser.city || '';
        if (profileProvince) profileProvince.value = currentUser.province || '';

        // Calcular progreso de iglesias visitadas
        const visitedCount = (currentUser.visited || []).length;
        const totalCount = poiData.length;
        const percent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

        const progressPercentEl = document.getElementById('profile-progress-percent');
        const visitedCountEl = document.getElementById('profile-visited-count');
        const totalCountEl = document.getElementById('profile-total-count');
        const progressRingEl = document.getElementById('profile-progress-ring');

        if (progressPercentEl) progressPercentEl.textContent = `${percent}%`;
        if (visitedCountEl) visitedCountEl.textContent = visitedCount;
        if (totalCountEl) totalCountEl.textContent = totalCount;
        if (progressRingEl) {
            progressRingEl.style.background = `radial-gradient(circle, #fff 60%, transparent 60.5%), conic-gradient(var(--accent) ${percent}%, #e0e0e0 ${percent}%)`;
        }
    } else {
        if (navProfile) navProfile.style.display = 'none';
    }
}

function handleProfileSave(e) {
    e.preventDefault();
    if (!currentUser) return;

    const fullname = document.getElementById('profile-fullname').value.trim();
    const country = document.getElementById('profile-country').value.trim();
    const city = document.getElementById('profile-city').value.trim();
    const province = document.getElementById('profile-province').value.trim();
    const statusMsg = document.getElementById('profile-status');

    if (!fullname || !country || !city || !province) {
        if (statusMsg) {
            statusMsg.textContent = "Por favor, completa todos los campos.";
            statusMsg.style.color = "red";
        }
        return;
    }

    // Actualizar en el array global de usuarios de localStorage
    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    
    currentUser.username = fullname;
    currentUser.country = country;
    currentUser.city = city;
    currentUser.province = province;

    if (userIndex !== -1) {
        users[userIndex].username = fullname;
        users[userIndex].country = country;
        users[userIndex].city = city;
        users[userIndex].province = province;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    
    if (statusMsg) {
        statusMsg.textContent = "✅ Cambios guardados correctamente.";
        statusMsg.style.color = "green";
        setTimeout(() => {
            statusMsg.textContent = "";
        }, 3000);
    }

    updateAuthUI();
    renderUserRanking();
}

function renderPendingChurches() {
    const pendingSection = document.getElementById('pending-section');
    const pendingContainer = document.getElementById('pending-cards-container');
    if (!pendingSection || !pendingContainer) return;

    if (!currentUser) {
        pendingSection.style.display = 'none';
        return;
    }

    const visitedSet = getVisited();
    const pendingData = poiData.filter(poi => !visitedSet.has(poi.id));

    if (pendingData.length === 0) {
        pendingSection.style.display = 'block';
        pendingContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: white; border-radius: 8px; border: 2px dashed var(--accent);">
                <p style="font-size: 1.2rem; font-weight: bold; color: var(--primary);">🏆 ¡Enhorabuena, has explorado todo el románico de Cantabria!</p>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 5px;">Eres un verdadero maestro de la historia medieval de la región.</p>
            </div>
        `;
        return;
    }

    pendingSection.style.display = 'block';
    pendingContainer.innerHTML = '';

    pendingData.forEach(poi => {
        const card = document.createElement('div');
        card.className = 'card pending-card';
        card.style.background = '#fff';
        card.style.border = '1px solid rgba(28, 58, 107, 0.1)';
        card.innerHTML = `
             <div class="card-img-container" style="height: 140px;">
                <img src="${(poi.images && poi.images.length > 0) ? getOptimizedImageUrl(poi.images[0], 300) : 'colegiata_santa_juliana_santillana_1777204517020.png'}" alt="${poi.name}" onerror="this.src='colegiata_santa_juliana_santillana_1777204517020.png'">
            </div>
            <div class="card-content" style="padding: 12px;">
                <h4 style="font-size:0.95rem; font-family:'Noto Serif', serif; color:var(--primary); margin-bottom:5px; height: 40px; overflow:hidden; text-overflow:ellipsis;">${poi.name}</h4>
                <p style="font-size:0.75rem; color:var(--text-muted);">📍 ${poi.location}</p>
                <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span class="tag" style="font-size:0.7rem; padding: 2px 6px;">${poi.zone}</span>
                    <span style="font-size:0.7rem; font-weight:bold; color:var(--accent);">Pendiente ⌛</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openDetail(poi));
        pendingContainer.appendChild(card);
    });
}

async function renderAdminPanel() {
    const adminPanelSection = document.getElementById('admin-panel-section');
    const tableBody = document.getElementById('admin-users-table-body');
    const countSpan = document.getElementById('admin-users-count');
    const photosContainer = document.getElementById('admin-pending-photos-container');
    const photosCountSpan = document.getElementById('admin-photos-count');

    if (!adminPanelSection) return;

    // =========================================================================
    // SEGURIDAD Y ACCESO DE ADMINISTRACIÓN
    // =========================================================================
    // Solo mostramos esta sección si el usuario logueado posee el rol de 'admin'.
    if (currentUser && currentUser.role === 'admin') {
        adminPanelSection.style.display = 'block';

        // 1. Cargar Usuarios Registrados
        try {
            let serverUsers = [];
            let totalUsers = 0;

            if (supabaseClient) {
                // Leer perfiles registrados en Supabase
                const { data: profiles, error } = await supabaseClient
                    .from('profiles')
                    .select('*');
                
                if (error) throw error;
                serverUsers = (profiles || []).map(p => ({
                    username: p.full_name || p.email.split('@')[0],
                    email: p.email,
                    province: p.province,
                    city: p.city,
                    loginCount: p.login_count || 0
                }));
                totalUsers = serverUsers.length;
            } else {
                // Fallback local
                const response = await fetch('/api/admin/users');
                const data = await safeJson(response);
                if (data.success) {
                    serverUsers = data.users || [];
                    totalUsers = data.total || serverUsers.length;
                } else {
                    throw new Error(data.error || "Error al obtener usuarios locales.");
                }
            }

            if (countSpan) countSpan.textContent = totalUsers;

            if (tableBody) {
                if (serverUsers.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="4" style="text-align: center; padding: 15px; color: var(--text-muted); font-style: italic;">
                                No hay usuarios registrados.
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = serverUsers.map(u => {
                        const locationInfo = `${u.province || 'Desconocida'} (${u.city || 'Desconocida'})`;
                        const loginCount = u.loginCount !== undefined ? u.loginCount : 0;
                        return `
                            <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                                <td style="padding: 12px; font-weight: bold; color: var(--primary);">👤 ${u.username}</td>
                                <td style="padding: 12px; font-family: monospace; color: var(--text);">${u.email}</td>
                                <td style="padding: 12px; text-align: center;">
                                    <span class="tag" style="background: var(--primary); color: white; font-size: 0.8rem; font-weight: bold; padding: 4px 10px; border-radius: 10px;">
                                        📍 ${locationInfo}
                                    </span>
                                </td>
                                <td style="padding: 12px; text-align: center; font-weight: bold; color: var(--accent); font-size: 1.1rem;">
                                    🔑 ${loginCount}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }
        } catch (err) {
            console.error("Error al obtener la lista de usuarios:", err);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 15px; color: red;">Error al conectar con la base de datos de usuarios.</td></tr>`;
            }
        }

        // 2. Cargar Fotos Pendientes de Moderación
        try {
            const res = await fetch('/api/admin/pending-photos');
            const pendingPhotos = await safeJson(res, []);

            if (photosCountSpan) photosCountSpan.textContent = pendingPhotos.length;

            if (photosContainer) {
                if (pendingPhotos.length === 0) {
                    photosContainer.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: rgba(0,0,0,0.02); border-radius: 8px; border: 1px dashed rgba(0,0,0,0.15); color: var(--text-muted);">
                            ✅ ¡No hay fotos pendientes de moderación!
                        </div>
                    `;
                } else {
                    photosContainer.innerHTML = pendingPhotos.map(photo => `
                        <div style="background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                            <div style="width: 100%; height: 140px; background: #eaeaea; overflow: hidden; position: relative;">
                                <img src="${photo.url}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <div style="padding: 12px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <h4 style="font-size: 0.9rem; margin-top: 0; margin-bottom: 5px; color: var(--primary);">${photo.poiName}</h4>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 5px 0;">Subido por: <b>${photo.username}</b></p>
                                    <p style="font-size: 0.7rem; color: #999; margin: 0 0 10px 0;">Fecha: ${photo.uploadedAt.split('T')[0]}</p>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.approvePhoto('${photo.id}')" style="flex: 1; background: #27ae60; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">Aprobar</button>
                                    <button onclick="window.rejectPhoto('${photo.id}')" style="flex: 1; background: #c4302b; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">Rechazar</button>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error("Error al obtener las fotos pendientes del backend:", err);
            if (photosContainer) {
                photosContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">Error de conexión con el moderador de imágenes.</div>`;
            }
        }

        // =========================================================================
        // 3. CONFIGURAR CONTROLES DEL AGENTE DE NOTICIAS
        // =========================================================================
        const btnTriggerNews = document.getElementById('btn-trigger-news-agent');
        const btnTriggerEvents = document.getElementById('btn-trigger-events-agent');
        const agentStatus = document.getElementById('admin-agent-status');

        if (btnTriggerNews && !btnTriggerNews.dataset.listenerSet) {
            btnTriggerNews.dataset.listenerSet = 'true';
            btnTriggerNews.addEventListener('click', async () => {
                btnTriggerNews.disabled = true;
                btnTriggerNews.textContent = "⚔️ Enviando cuervos...";
                if (agentStatus) {
                    agentStatus.style.display = 'block';
                    agentStatus.style.background = '#fbfaf2';
                    agentStatus.style.color = '#5a3c1c';
                    agentStatus.style.border = '2px solid #5a3c1c';
                    agentStatus.innerHTML = `📜 Iniciando la marcha del Agente de Noticias... Por favor, espera a que los sabios del reino completen el pergamino.`;
                }

                try {
                    const res = await fetch('/api/test/send-news-bulletin');
                    const data = await safeJson(res, { success: false });
                    if (data.success) {
                        agentStatus.style.background = '#d4edda';
                        agentStatus.style.color = '#155724';
                        agentStatus.style.border = '1px solid #c3e6cb';
                        const details = data.details || {};
                        agentStatus.innerHTML = `🛡️ <strong>¡Victoria!</strong> Boletín medieval enviado con éxito. <br>
                            👥 <b>Suscriptores notificados:</b> ${details.count || 0} <br>
                            📰 <b>Crónicas de prensa recopiladas:</b> ${details.newsCount || 0}`;
                    } else {
                        throw new Error(data.error || "Fallo en la comunicación con el reino.");
                    }
                } catch(err) {
                    console.error("Error al ejecutar el agente de noticias:", err);
                    agentStatus.style.background = '#f8d7da';
                    agentStatus.style.color = '#721c24';
                    agentStatus.style.border = '1px solid #f5c6cb';
                    agentStatus.innerHTML = `❌ El Agente reportó un fallo crítico: ${err.message}`;
                } finally {
                    btnTriggerNews.disabled = false;
                    btnTriggerNews.textContent = "📜 Ejecutar Agente de Noticias (Mensual)";
                }
            });
        }

        if (btnTriggerEvents && !btnTriggerEvents.dataset.listenerSet) {
            btnTriggerEvents.dataset.listenerSet = 'true';
            btnTriggerEvents.addEventListener('click', async () => {
                btnTriggerEvents.disabled = true;
                btnTriggerEvents.textContent = "🎺 Trompetas sonando...";
                if (agentStatus) {
                    agentStatus.style.display = 'block';
                    agentStatus.style.background = '#fbfaf2';
                    agentStatus.style.color = '#5a3c1c';
                    agentStatus.style.border = '2px solid #5a3c1c';
                    agentStatus.innerHTML = `🎺 Los juglares están preparando los chismes de la corte...`;
                }

                try {
                    const res = await fetch('/api/test/send-bulletin');
                    const data = await safeJson(res, { success: false });
                    if (data.success) {
                        agentStatus.style.background = '#d4edda';
                        agentStatus.style.color = '#155724';
                        agentStatus.style.border = '1px solid #c3e6cb';
                        agentStatus.innerHTML = `🛡️ <strong>¡Enviado!</strong> Boletín quincenal de novedades de la agenda disparado correctamente a los viajeros registrados.`;
                    } else {
                        throw new Error(data.error || "Fallo al silbar al cuervo mensajero.");
                    }
                } catch(err) {
                    console.error("Error al disparar boletín de novedades:", err);
                    agentStatus.style.background = '#f8d7da';
                    agentStatus.style.color = '#721c24';
                    agentStatus.style.border = '1px solid #f5c6cb';
                    agentStatus.innerHTML = `❌ Falló la algarada: ${err.message}`;
                } finally {
                    btnTriggerEvents.disabled = false;
                    btnTriggerEvents.textContent = "🎺 Ejecutar Boletín de Novedades (Quincenal)";
                }
            });
        }

    } else {
        adminPanelSection.style.display = 'none';
    }
}

window.approvePhoto = async (photoId) => {
    if (!confirm('🛡️ ¿Estás seguro de que deseas APROBAR esta foto? Aparecerá en la ficha del monumento y en la sección de Comunidad.')) return;
    try {
        const res = await fetch('/api/admin/approve-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId })
        });
        const data = await safeJson(res);
        if (data.success) {
            alert('✅ Foto aprobada con éxito.');
            renderAdminPanel();
            renderList();
            renderComments();
        } else {
            alert('❌ Error al aprobar: ' + data.error);
        }
    } catch (e) {
        alert('❌ Error de red al aprobar foto.');
    }
};

window.rejectPhoto = async (photoId) => {
    if (!confirm('🛡️ ¿Estás seguro de que deseas RECHAZAR y eliminar esta foto permanentemente?')) return;
    try {
        const res = await fetch('/api/admin/reject-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId })
        });
        const data = await safeJson(res);
        if (data.success) {
            alert('✅ Foto rechazada y eliminada.');
            renderAdminPanel();
        } else {
            alert('❌ Error al rechazar: ' + data.error);
        }
    } catch (e) {
        alert('❌ Error de red al rechazar foto.');
    }
};

function renderUserRanking() {
    const container = document.getElementById('user-ranking');
    if (!container) return;

    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    if (users.length === 0) {
        container.innerHTML = `
            <p style="text-align:center; color:var(--text-muted); padding:20px; font-size:0.9rem;">
                Registra tu cuenta y sé el primer viajero en el ranking.
            </p>
        `;
        return;
    }

    const sortedUsers = users
        .map(u => ({
            username: u.username,
            visitsCount: (u.visited || []).length
        }))
        .sort((a, b) => b.visitsCount - a.visitsCount);

    let html = '';
    sortedUsers.forEach((u, i) => {
        let medal = '';
        if (i === 0) medal = '🥇 ';
        else if (i === 1) medal = '🥈 ';
        else if (i === 2) medal = '🥉 ';
        
        const isSelf = currentUser && u.username === currentUser.username;
        html += `
            <div class="ranking-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0; background: ${isSelf ? '#fff9ed' : 'transparent'}; border-radius: 6px; margin-bottom: 5px; border: ${isSelf ? '1px solid var(--accent)' : 'none'};">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; font-size:0.9rem; color:var(--accent); width:25px;">${medal || `#${i+1}`}</span>
                    <span style="font-weight:${isSelf ? 'bold' : 'normal'}; font-size:0.9rem; color: ${isSelf ? 'var(--primary)' : 'inherit'};">${u.username} ${isSelf ? '(Tú)' : ''}</span>
                </div>
                <span class="tag" style="background:var(--primary); color:white; font-size:0.8rem; font-weight:bold; padding:4px 10px; border-radius:12px;">
                    ${u.visitsCount} ${u.visitsCount === 1 ? 'visita' : 'visitas'}
                </span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function markChurchAsVisitedForUser(poiId) {
    if (!currentUser) return;
    
    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const userIdx = users.findIndex(u => u.email === currentUser.email);
    if (userIdx !== -1) {
        if (!users[userIdx].visited) users[userIdx].visited = [];
        if (!users[userIdx].visited.includes(poiId)) {
            users[userIdx].visited.push(poiId);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            // Actualizar la sesión del usuario activo
            currentUser.visited = users[userIdx].visited;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }
    }
    
    renderList();
    renderMarkers();
    updateProgress();
    renderPendingChurches();
    renderUserRanking();
    
    // Cerrar modal de detalles
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('active');
}

function checkPasswordStrength() {
    const pass = document.getElementById('reg-pass').value;
    const meter = document.getElementById('pass-strength');
    if (!meter) return;
    
    if (pass.length === 0) {
        meter.innerHTML = '';
        return;
    }
    
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    let text = '';
    let color = '';
    
    if (score <= 1) {
        text = 'Débil 🔴';
        color = 'red';
    } else if (score <= 3) {
        text = 'Media 🟡';
        color = 'orange';
    } else {
        text = 'Fuerte 🟢';
        color = 'green';
    }
    
    meter.innerHTML = `<span style="color:${color}; font-size:0.8rem; font-weight:600;">Seguridad de la contraseña: ${text}</span>`;
}

// --- Funciones de Administración ---

document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('edit-poi-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditPoiSubmit);
    }
    
    // Cerrar modales al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
});

window.openEditPoiById = (id) => {
    const poi = poiData.find(p => p.id === id);
    if (!poi) return;

    // Cerrar modal de detalles
    const detailModal = document.getElementById('detail-modal');
    if (detailModal) detailModal.classList.remove('active');

    // Rellenar campos del modal
    document.getElementById('edit-poi-id').value = poi.id;
    document.getElementById('edit-poi-name').value = poi.name;
    document.getElementById('edit-poi-location').value = poi.location;
    document.getElementById('edit-poi-description').value = poi.description;
    document.getElementById('edit-poi-images').value = (poi.images || []).join('\n');

    // Abrir modal de edición
    const editModal = document.getElementById('edit-poi-modal');
    if (editModal) editModal.classList.add('active');
};

async function handleEditPoiSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-poi-id').value;
    const name = document.getElementById('edit-poi-name').value.trim();
    const location = document.getElementById('edit-poi-location').value.trim();
    const description = document.getElementById('edit-poi-description').value.trim();
    const imagesRaw = document.getElementById('edit-poi-images').value;
    const images = imagesRaw.split('\n').map(img => img.trim()).filter(img => img.length > 0);

    try {
        const res = await fetch('/api/admin/edit-poi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, location, description, images })
        });
        const data = await safeJson(res);
        if (data.success) {
            alert('✅ Iglesia actualizada con éxito.');
            // Actualizar datos locales en memoria
            const poi = poiData.find(p => p.id === id);
            if (poi) {
                poi.name = name;
                poi.location = location;
                poi.description = description;
                poi.images = images;
            }
            document.getElementById('edit-poi-modal').classList.remove('active');
            renderList();
            renderMarkers();
        } else {
            alert('❌ Error al actualizar: ' + data.error);
        }
    } catch (err) {
        alert('❌ Error de red al comunicarse con el servidor.');
    }
}

// --- Lógica de la Sección de Comunidad / Comentarios (Persistencia en Backend) ---

async function renderComments() {
    const formContainer = document.getElementById('comment-form-container');
    const commentsList = document.getElementById('comments-list');
    if (!formContainer || !commentsList) return;

    // 1. Renderizar formulario de comentarios
    if (currentUser) {
        // Crear select con todas las iglesias románicas
        const optionsHTML = poiData.map(poi => `<option value="${poi.id}">${poi.name}</option>`).join('');
        formContainer.innerHTML = `
            <form id="comment-form" onsubmit="handleCommentSubmit(event)">
                <h3 style="margin-bottom:15px; font-family:'Noto Serif', serif; color:var(--primary); font-size:1.2rem;">Escribe tu opinión</h3>
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-weight:600; display:block; margin-bottom:4px; font-size:0.85rem;">Selecciona la Iglesia</label>
                    <select id="comment-church-select" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
                        ${optionsHTML}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="font-weight:600; display:block; margin-bottom:4px; font-size:0.85rem;">Valoración</label>
                    <select id="comment-stars" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
                        <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                        <option value="4">⭐⭐⭐⭐ (Muy buena)</option>
                        <option value="3">⭐⭐⭐ (Buena)</option>
                        <option value="2">⭐⭐ (Regular)</option>
                        <option value="1">⭐ (Mala)</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:15px;">
                    <label style="font-weight:600; display:block; margin-bottom:4px; font-size:0.85rem;">Tu Comentario</label>
                    <textarea id="comment-text" required rows="4" placeholder="¿Qué te pareció la visita? Cuéntanos detalles sobre accesibilidad, guías o conservación..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit; resize:vertical;"></textarea>
                </div>
                <button type="submit" class="btn-primary" style="width:100%;">Publicar Comentario</button>
            </form>
        `;
    } else {
        formContainer.innerHTML = `
            <p style="text-align:center; color:var(--text-muted); margin:0;">
                🔒 Debes <a href="#" onclick="document.getElementById('auth-modal').classList.add('active'); return false;" style="color:var(--accent); font-weight:bold; text-decoration:none;">Iniciar Sesión</a> o registrarte para poder publicar comentarios.
            </p>
        `;
    }

    // 2. Renderizar lista de comentarios
    try {
        const res = await fetch('/api/comments');
        if (!res.ok) throw new Error("No se pudieron cargar los comentarios.");
        const comments = await safeJson(res, []);

        if (comments.length === 0) {
            commentsList.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Aún no hay opiniones en la comunidad. ¡Sé el primero en aportar!</p>`;
            return;
        }

        // Ordenar comentarios de más recientes a antiguos
        const sorted = [...comments].reverse();

        commentsList.innerHTML = sorted.map(c => {
            let starsStr = '⭐'.repeat(c.stars);
            let deleteBtn = '';
            if (currentUser && currentUser.role === 'admin') {
                deleteBtn = `<div style="text-align: right;"><button onclick="window.deleteComment('${c.id}')" style="background:#c4302b; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer; margin-top:10px;">🗑️ Eliminar Comentario</button></div>`;
            }
            return `
                <div class="comment-card">
                    <div class="comment-header">
                        <div class="comment-user">👤 ${c.username}</div>
                        <div class="comment-date">${c.date}</div>
                    </div>
                    <div class="comment-stars">${starsStr}</div>
                    <div class="comment-church">🏰 ${c.churchName}</div>
                    <p class="comment-text" style="margin-top:10px;">${c.text}</p>
                    ${deleteBtn}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        commentsList.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor de la comunidad.</p>`;
    }
}

window.handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const churchSelect = document.getElementById('comment-church-select');
    const starsSelect = document.getElementById('comment-stars');
    const textTextarea = document.getElementById('comment-text');

    const churchId = churchSelect.value;
    const churchName = churchSelect.options[churchSelect.selectedIndex].text;
    const stars = parseInt(starsSelect.value);
    const text = textTextarea.value.trim();

    try {
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                churchId,
                churchName,
                stars,
                text
            })
        });
        const data = await safeJson(res);
        if (data.success) {
            textTextarea.value = '';
            renderComments();
            alert('✅ Tu comentario ha sido publicado en la comunidad.');
        } else {
            alert('❌ Error al publicar: ' + data.error);
        }
    } catch (err) {
        alert('❌ Error de red al publicar el comentario.');
    }
};

window.deleteComment = async (id) => {
    if (!confirm('🛡️ ¿Estás seguro de que deseas eliminar permanentemente este comentario de la Comunidad?')) return;
    try {
        const res = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
        const data = await safeJson(res);
        if (data.success) {
            renderComments();
            alert('✅ Comentario eliminado con éxito.');
        } else {
            alert('❌ Error al eliminar comentario: ' + data.error);
        }
    } catch (err) {
        alert('❌ Error de red al intentar eliminar el comentario.');
    }
};

// --- Sistema del Clima Dinámico con Open-Meteo API ---

// Zonas y comarcas de Cantabria con coordenadas de referencia
const weatherZones = [
    { name: 'Santander (Costa Central)', lat: 43.4623, lon: -3.8099, comarca: 'Santander' },
    { name: 'Reinosa (Campoo-Los Valles)', lat: 42.9998, lon: -4.1372, comarca: 'Campoo-Los Valles' },
    { name: 'Potes (Liébana)', lat: 43.1536, lon: -4.6238, comarca: 'Liébana' },
    { name: 'San Vicente de la Barquera (Costa Occidental)', lat: 43.3844, lon: -4.3995, comarca: 'Costa Occidental' },
    { name: 'Torrelavega (Besaya)', lat: 43.3494, lon: -4.0479, comarca: 'Besaya' },
    { name: 'Laredo (Costa Oriental)', lat: 43.4144, lon: -3.4132, comarca: 'Costa Oriental' },
    { name: 'Solares (Trasmiera)', lat: 43.3822, lon: -3.7374, comarca: 'Trasmiera' },
    { name: 'Cabezón de la Sal (Saja-Nansa)', lat: 43.3074, lon: -4.2325, comarca: 'Saja-Nansa' },
    { name: 'Villacarriedo (Valles Pasiegos)', lat: 43.2294, lon: -3.8078, comarca: 'Valles Pasiegos' },
    { name: 'Ramales de la Victoria (Asón-Agüera)', lat: 43.2577, lon: -3.4646, comarca: 'Asón-Agüera' }
];

let weatherMap;
let weatherMarkers = [];

// Inicialización del Mapa del Tiempo si es necesario
function initWeatherMapIfNeeded() {
    if (weatherMap) return; // Ya está inicializado

    // Crear el mapa centrado en Cantabria
    weatherMap = L.map('weather-section-map').setView([43.25, -4.0], 9);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(weatherMap);

    // Cargar y pintar los marcadores del tiempo para cada zona
    loadWeatherMapMarkers();
}

async function loadWeatherMapMarkers() {
    for (const zone of weatherZones) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${zone.lat}&longitude=${zone.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await safeJson(response);
            
            const temp = Math.round(data.current.temperature_2m);
            const status = getWeatherStatusByCode(data.current.weather_code);

            // Crear marcador personalizado con Leaflet usando un icono que muestre el emoji y temperatura
            const customIcon = L.divIcon({
                className: 'custom-weather-marker',
                html: `<div style="background: white; border: 2px solid var(--primary); border-radius: 20px; padding: 4px 8px; display: flex; align-items: center; gap: 4px; box-shadow: var(--shadow); font-weight: bold; font-size: 0.85rem; white-space: nowrap;">
                            <span>${status.emoji}</span>
                            <span style="color: var(--primary);">${temp}°C</span>
                       </div>`,
                iconSize: [60, 30],
                iconAnchor: [30, 15]
            });

            const marker = L.marker([zone.lat, zone.lon], { icon: customIcon })
                .addTo(weatherMap)
                .bindTooltip(`<b>${zone.name}</b><br>${status.text}`, { direction: 'top', offset: [0, -10] });

            // Al hacer clic, cargar la información del clima detallada de esta zona
            marker.on('click', () => {
                showWeatherDetail(zone, data);
            });

            weatherMarkers.push(marker);

            // Por defecto, si es Santander, lo cargamos en la zona detallada inicialmente
            if (zone.comarca === 'Santander') {
                showWeatherDetail(zone, data);
            }

        } catch (e) {
            console.error('Error cargando marcador de clima para ' + zone.name, e);
        }
    }
}

// Mostrar clima detallado de la zona seleccionada
function showWeatherDetail(zone, data) {
    const detailContainer = document.getElementById('weather-detail-container');
    if (!detailContainer) return;

    const temp = Math.round(data.current.temperature_2m);
    const { emoji, text } = getWeatherStatusByCode(data.current.weather_code);
    const wind = Math.round(data.current.wind_speed_10m);
    const humidity = data.current.relative_humidity_2m;

    const getForecastListHTML = (daysLimit) => {
        let htmlList = '';
        if (data.daily && data.daily.time) {
            for (let i = 0; i < daysLimit; i++) {
                const dateStr = data.daily.time[i];
                const dayName = formatDate(dateStr);
                const minTemp = Math.round(data.daily.temperature_2m_min[i]);
                const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
                const dayCode = data.daily.weather_code[i];
                const dayStatus = getWeatherStatusByCode(dayCode);
                const precip = data.daily.precipitation_sum ? Math.round(data.daily.precipitation_sum[i]) : 0;

                htmlList += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid rgba(28, 58, 107, 0.05);">
                        <div style="flex: 1; font-weight: bold; color: var(--text);">${dayName}</div>
                        <div style="flex: 1; display: flex; align-items: center; gap: 8px; justify-content: center;">
                            <span style="font-size: 1.6rem;">${dayStatus.emoji}</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted); text-transform: capitalize; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dayStatus.text}</span>
                        </div>
                        <div style="flex: 1; text-align: right; font-weight: 600; color: var(--primary);">${minTemp}°C / ${maxTemp}°C</div>
                        <div style="font-size: 0.8rem; color: #3498db; margin-left: 15px; width: 45px; text-align: right;">💧 ${precip}mm</div>
                    </div>
                `;
            }
        }
        return htmlList;
    };

    const forecast3dHTML = getForecastListHTML(3);
    const forecast6dHTML = getForecastListHTML(6);

    detailContainer.innerHTML = `
        <div class="card weather-detail-card" style="padding: 25px; background: rgba(28, 58, 107, 0.03); border: 1px solid rgba(28, 58, 107, 0.08); border-radius: 16px; box-shadow: var(--shadow); max-width: 800px; margin: 0 auto; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; border-bottom: 1px solid rgba(28, 58, 107, 0.1); padding-bottom: 15px;">
                <div>
                    <h3 style="margin: 0; font-family: 'Playfair Display', serif; color: var(--primary); font-size: 1.8rem;">📍 Clima en ${zone.name}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 1rem; color: var(--text-muted); text-transform: capitalize;">${text}</p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 3.5rem; line-height: 1;">${emoji}</span>
                </div>
            </div>

            <!-- Info Actual Detallada -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; text-align: center;">
                <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid rgba(28, 58, 107, 0.05); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Temperatura</div>
                    <div style="font-size: 1.6rem; font-weight: bold; color: var(--primary); margin-top: 4px;">${temp}°C</div>
                </div>
                <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid rgba(28, 58, 107, 0.05); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Viento</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--primary); margin-top: 4px;">💨 ${wind} km/h</div>
                </div>
                <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid rgba(28, 58, 107, 0.05); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Humedad</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--primary); margin-top: 4px;">💧 ${humidity}%</div>
                </div>
            </div>

            <!-- Pestañas internas para cambiar entre previsión de 3 y 6 días -->
            <div style="margin-top: 20px;">
                <div style="display: flex; gap: 10px; border-bottom: 2px solid rgba(28, 58, 107, 0.1); padding-bottom: 10px; margin-bottom: 15px;">
                    <button id="btn-forecast-3d" class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 0.85rem; background: var(--primary); color: white;">Previsión 3 Días</button>
                    <button id="btn-forecast-6d" class="btn-auth" style="width: auto; padding: 8px 16px; font-size: 0.85rem; background: transparent; color: var(--primary); border: 1px solid var(--primary);">Previsión 6 Días</button>
                </div>
                
                <div id="forecast-3d-panel" style="display: flex; flex-direction: column; gap: 10px;">
                    ${forecast3dHTML}
                </div>
                
                <div id="forecast-6d-panel" style="display: none; flex-direction: column; gap: 10px;">
                    ${forecast6dHTML}
                </div>
            </div>
        </div>
    `;

    const btn3d = document.getElementById('btn-forecast-3d');
    const btn6d = document.getElementById('btn-forecast-6d');
    const panel3d = document.getElementById('forecast-3d-panel');
    const panel6d = document.getElementById('forecast-6d-panel');

    if (btn3d && btn6d && panel3d && panel6d) {
        btn3d.addEventListener('click', () => {
            panel3d.style.display = 'flex';
            panel6d.style.display = 'none';
            btn3d.style.background = 'var(--primary)';
            btn3d.style.color = 'white';
            btn6d.style.background = 'transparent';
            btn6d.style.color = 'var(--primary)';
        });

        btn6d.addEventListener('click', () => {
            panel3d.style.display = 'none';
            panel6d.style.display = 'flex';
            btn6d.style.background = 'var(--primary)';
            btn6d.style.color = 'white';
            btn3d.style.background = 'transparent';
            btn3d.style.color = 'var(--primary)';
        });
    }
}

// Cargar el clima actual interactivo con mapa de Cantabria para la Portada / Dashboard
async function loadWeather() {
    const dashboardContainer = document.getElementById('weather-dashboard-container');
    const weatherMapEl = document.getElementById('weather-map');
    if (!dashboardContainer || !weatherMapEl) return;

    try {
        // Inicializar el mapa de Leaflet directamente sobre el contenedor de portada centrado en Cantabria
        const mapInstance = L.map('weather-map').setView([43.25, -4.0], 9);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(mapInstance);

        // Cargar los marcadores climáticos dinámicos
        for (const zone of weatherZones) {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${zone.lat}&longitude=${zone.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
                const response = await fetch(url);
                if (!response.ok) continue;
                const data = await safeJson(response);
                
                const temp = Math.round(data.current.temperature_2m);
                const status = getWeatherStatusByCode(data.current.weather_code);

                // Crear marcador personalizado con Leaflet
                const customIcon = L.divIcon({
                    className: 'custom-weather-marker',
                    html: `<div style="background: white; border: 2px solid var(--primary); border-radius: 20px; padding: 4px 8px; display: flex; align-items: center; gap: 4px; box-shadow: var(--shadow); font-weight: bold; font-size: 0.82rem; white-space: nowrap;">
                                <span>${status.emoji}</span>
                                <span style="color: var(--primary);">${temp}°C</span>
                           </div>`,
                    iconSize: [55, 28],
                    iconAnchor: [27, 14]
                });

                const marker = L.marker([zone.lat, zone.lon], { icon: customIcon })
                    .addTo(mapInstance)
                    .bindTooltip(`<b>${zone.name}</b><br>${status.text}`, { direction: 'top', offset: [0, -10] });

                // Al hacer clic, cargar la información del clima detallada de esa zona a la derecha del mapa
                marker.on('click', () => {
                    showWeatherDetailInDashboard(zone, data);
                });

                // Cargar por defecto la información de Santander
                if (zone.comarca === 'Santander') {
                    showWeatherDetailInDashboard(zone, data);
                }

            } catch (innerErr) {
                console.error('Error cargando marcador de clima en portada para ' + zone.name, innerErr);
            }
        }

        // Programar una invalidación del mapa en caso de que tarde un poco en cargar el viewport
        setTimeout(() => mapInstance.invalidateSize(), 500);

    } catch (error) {
        console.error('Error al inicializar el mapa del clima en portada:', error);
        dashboardContainer.innerHTML = `<p style="text-align: center; color: #e74c3c;">⚠️ No se pudo obtener la predicción del clima actual.</p>`;
    }
}

// Renderizar la previsión detallada de 3 y 6 días en el panel derecho de la portada
function showWeatherDetailInDashboard(zone, data) {
    const dashboardContainer = document.getElementById('weather-dashboard-container');
    if (!dashboardContainer) return;

    const temp = Math.round(data.current.temperature_2m);
    const { emoji, text } = getWeatherStatusByCode(data.current.weather_code);
    const wind = Math.round(data.current.wind_speed_10m);
    const humidity = data.current.relative_humidity_2m;

    const getForecastListHTML = (daysLimit) => {
        let htmlList = '';
        if (data.daily && data.daily.time) {
            for (let i = 0; i < daysLimit; i++) {
                const dateStr = data.daily.time[i];
                const dayName = formatDate(dateStr);
                const minTemp = Math.round(data.daily.temperature_2m_min[i]);
                const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
                const dayCode = data.daily.weather_code[i];
                const dayStatus = getWeatherStatusByCode(dayCode);
                const precip = data.daily.precipitation_sum ? Math.round(data.daily.precipitation_sum[i]) : 0;

                htmlList += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid rgba(28, 58, 107, 0.05); margin-bottom: 5px;">
                        <div style="font-weight: bold; font-size: 0.8rem; color: var(--text); min-width: 70px;">${dayName}</div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 1.3rem;">${dayStatus.emoji}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dayStatus.text}</span>
                        </div>
                        <div style="text-align: right; font-weight: 600; font-size: 0.8rem; color: var(--primary); min-width: 70px;">${minTemp}° / ${maxTemp}°</div>
                        <div style="font-size: 0.75rem; color: #3498db; width: 40px; text-align: right;">💧 ${precip}mm</div>
                    </div>
                `;
            }
        }
        return htmlList;
    };

    const forecast3dHTML = getForecastListHTML(3);
    const forecast6dHTML = getForecastListHTML(6);

    dashboardContainer.innerHTML = `
        <div style="background: rgba(28, 58, 107, 0.02); border: 1px solid rgba(28, 58, 107, 0.06); border-radius: 12px; padding: 15px; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; font-size: 1.15rem; font-family: 'Noto Serif', serif; color: var(--primary);">📍 ${zone.name}</h4>
                    <span style="font-size: 2.2rem;">${emoji}</span>
                </div>
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary); margin-bottom: 2px;">${temp}°C</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); text-transform: capitalize; margin-bottom: 12px;">${text} | Humedad: ${humidity}% | Viento: ${wind} km/h</div>
            </div>

            <div>
                <div style="display: flex; gap: 10px; border-bottom: 1.5px solid rgba(28, 58, 107, 0.08); padding-bottom: 5px; margin-bottom: 10px;">
                    <button id="btn-dash-forecast-3d" class="btn-primary" style="width: auto; padding: 5px 10px; font-size: 0.75rem; background: var(--primary); color: white;">3 Días</button>
                    <button id="btn-dash-forecast-6d" class="btn-auth" style="width: auto; padding: 5px 10px; font-size: 0.75rem; background: transparent; color: var(--primary); border: 1px solid var(--primary);">6 Días</button>
                </div>
                
                <div id="dash-forecast-3d-panel" style="display: flex; flex-direction: column;">
                    ${forecast3dHTML}
                </div>
                
                <div id="dash-forecast-6d-panel" style="display: none; flex-direction: column;">
                    ${forecast6dHTML}
                </div>
            </div>
        </div>
    `;

    const btn3d = document.getElementById('btn-dash-forecast-3d');
    const btn6d = document.getElementById('btn-dash-forecast-6d');
    const panel3d = document.getElementById('dash-forecast-3d-panel');
    const panel6d = document.getElementById('dash-forecast-6d-panel');

    if (btn3d && btn6d && panel3d && panel6d) {
        btn3d.addEventListener('click', () => {
            panel3d.style.display = 'flex';
            panel6d.style.display = 'none';
            btn3d.style.background = 'var(--primary)';
            btn3d.style.color = 'white';
            btn6d.style.background = 'transparent';
            btn6d.style.color = 'var(--primary)';
        });

        btn6d.addEventListener('click', () => {
            panel3d.style.display = 'none';
            panel6d.style.display = 'flex';
            btn6d.style.background = 'var(--primary)';
            btn6d.style.color = 'white';
            btn3d.style.background = 'transparent';
            btn3d.style.color = 'var(--primary)';
        });
    }
}

// Mapear los códigos WMO de Open-Meteo a Emojis y Textos legibles en español
function getWeatherStatusByCode(code) {
    if (code === 0) return { emoji: '☀️', text: 'Despejado' };
    if (code === 1 || code === 2 || code === 3) return { emoji: '🌤️', text: 'Parcialmente nublado' };
    if (code === 45 || code === 48) return { emoji: '🌫️', text: 'Niebla' };
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return { emoji: '🌧️', text: 'Llovizna' };
    if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { emoji: '🌧️', text: 'Lluvia' };
    if (code === 71 || code === 73 || code === 75 || code === 77) return { emoji: '❄️', text: 'Nieve' };
    if (code === 80 || code === 81 || code === 82) return { emoji: '🌧️', text: 'Chubascos' };
    if (code === 85 || code === 86) return { emoji: '❄️', text: 'Nieve' };
    if (code === 95 || code === 96 || code === 99) return { emoji: '⛈️', text: 'Tormenta' };
    return { emoji: '⛅', text: 'Nublado' };
}

// Formatear fecha (YYYY-MM-DD) a nombre de día de la semana o fecha legible
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const formatted = date.toLocaleDateString('es-ES', options);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        return dateStr;
    }
}




// =========================================================================
// FUNCIONES AUXILIARES PARA ENLAZADO PROFUNDO (HASH ROUTING) Y METADATOS SEO
// =========================================================================

function handleHashRouting() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
        const targetId = hash.substring(1);
        
        // Excluir hashes de vistas generales
        const mainViews = ['list-view', 'map-view', 'itinerary-view', 'agenda-view', 'ranking-view', 'restaurants-view', 'community-view', '3d-view', 'learn-view', 'profile-view'];
        if (mainViews.includes(targetId)) return;
        
        const poi = window.poiData.find(p => p.id === targetId);
        if (poi) {
            // Esperar a que la UI esté lista
            setTimeout(() => {
                openDetail(poi);
            }, 250);
        }
    }
}

function closeDetail() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('active');
    
    // Restaurar metadatos SEO originales
    if (window.originalTitle) {
        document.title = window.originalTitle;
    }
    if (window.originalDescription) {
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', window.originalDescription);
    }
    
    // Eliminar estructurado JSON-LD dinámico
    const jsonLdEl = document.getElementById('dynamic-jsonld');
    if (jsonLdEl) jsonLdEl.remove();
    
    // Limpiar hash de URL de forma elegante
    if (window.location.hash) {
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
}

// Exponer funciones globalmente
window.closeDetail = closeDetail;
window.handleHashRouting = handleHashRouting;

/* =========================================================================
   FUNCIONES DE COMPORTAMIENTO PARA MENÚ RESPONSIVE Y FLUIDEZ EN MÓVIL
   ========================================================================= */

// Gestión dinámica de los elementos del menú según la resolución de pantalla
function handleResponsiveMenuLayout() {
    const userStats = document.querySelector('.header-top .user-stats') || document.querySelector('.magical-nav .user-stats');
    const headerTop = document.querySelector('.header-top');
    const magicalNav = document.querySelector('.magical-nav');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // En móviles, movemos la sección de estadísticas de usuario al final del menú de navegación vertical
        if (userStats && magicalNav && userStats.parentNode !== magicalNav) {
            magicalNav.appendChild(userStats);
        }
    } else {
        // En escritorio, devolvemos las estadísticas de usuario a la cabecera antes del botón de hamburguesa
        if (userStats && headerTop && userStats.parentNode !== headerTop) {
            if (hamburgerBtn) {
                headerTop.insertBefore(userStats, hamburgerBtn);
            } else {
                headerTop.appendChild(userStats);
            }
        }
    }
}

// Inicialización y registro de eventos del Menú de Hamburguesa para móviles
function initMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const magicalNav = document.querySelector('.magical-nav');
    const menuOverlay = document.getElementById('menu-overlay');

    if (hamburgerBtn && magicalNav && menuOverlay) {
        const toggleMenu = () => {
            const isOpen = hamburgerBtn.classList.contains('open');
            if (isOpen) {
                hamburgerBtn.classList.remove('open');
                magicalNav.classList.remove('open');
                menuOverlay.classList.remove('active');
                document.body.style.overflow = '';
            } else {
                hamburgerBtn.classList.add('open');
                magicalNav.classList.add('open');
                menuOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // Bloquear scroll de la página
            }
        };

        // Evento de clic en el botón de hamburguesa
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        // Evento de clic en el overlay exterior para cerrar el menú
        menuOverlay.addEventListener('click', () => {
            if (hamburgerBtn.classList.contains('open')) {
                toggleMenu();
            }
        });
    }

    // Gestionar distribución responsive del layout al iniciar y al redimensionar
    handleResponsiveMenuLayout();
    window.addEventListener('resize', handleResponsiveMenuLayout);
}

// Envoltura programática de mapas incrustados para activar el overlay de scroll en smartphones
function setupMapMobileScrollOverlay(mapId, labelText = "mapa") {
    const mapEl = document.getElementById(mapId);
    if (!mapEl) return;

    // Solo aplicar en dispositivos móviles / táctiles (ancho <= 768px)
    if (window.innerWidth > 768) return;

    // Evitar aplicar el wrapper si ya existe
    if (mapEl.parentNode.classList.contains('map-mobile-wrapper')) return;

    const originalHeight = mapEl.style.height || '350px';

    // Crear contenedor wrapper para el mapa y su overlay
    const wrapper = document.createElement('div');
    wrapper.className = 'map-mobile-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = originalHeight;
    wrapper.style.borderRadius = mapEl.style.borderRadius || '12px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.boxShadow = mapEl.style.boxShadow || 'var(--shadow)';

    // Reemplazar mapa por el wrapper e insertar mapa dentro
    mapEl.parentNode.insertBefore(wrapper, mapEl);
    wrapper.appendChild(mapEl);

    // Ajustar mapa para que llene el wrapper
    mapEl.style.height = '100%';
    mapEl.style.marginTop = '0px';

    // Crear y añadir el overlay táctil
    const overlay = document.createElement('div');
    overlay.className = 'map-interaction-overlay';
    overlay.innerHTML = `
        <span style="font-size: 1.6rem; margin-bottom: 8px;">🗺️</span>
        <span style="font-size: 0.85rem; font-weight: 700; line-height: 1.4;">Toca el ${labelText} para interactuar</span>
        <button class="map-interaction-btn">Activar interacción</button>
    `;

    // Crear y añadir el botón flotante de bloqueo
    const disableBtn = document.createElement('button');
    disableBtn.className = 'map-disable-btn';
    disableBtn.style.display = 'none';
    disableBtn.textContent = '🔒 Bloquear Mapa';

    wrapper.appendChild(overlay);
    wrapper.appendChild(disableBtn);

    // Registrar eventos para ocultar/mostrar el overlay y activar el mapa
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.classList.add('hidden');
        disableBtn.style.display = 'block';
    });

    disableBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.classList.remove('hidden');
        disableBtn.style.display = 'none';
    });
}

// Inicialización de overlays en todos los mapas del sitio en móviles
function initMapMobileScrollOverlays() {
    // Retrasar ligeramente para asegurar que los elementos estén renderizados
    setTimeout(() => {
        setupMapMobileScrollOverlay('weather-map', 'mapa climatológico');
        setupMapMobileScrollOverlay('weather-section-map', 'mapa del tiempo');
        setupMapMobileScrollOverlay('itinerary-map', 'mapa de itinerarios');
        setupMapMobileScrollOverlay('relations-network-map', 'mapa de relaciones');
    }, 500);
}
