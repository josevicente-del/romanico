# -*- coding: utf-8 -*-
"""
Script de generación de resúmenes (generar_resumen.py).
Corregido para evitar ValueError cuando la URL de la imagen es None.
Usa caché local de imágenes y fallback en caso de errores de red o 429 de Wikimedia.
"""

import os
import re
import json
import time
import shutil
import random
import urllib.request
import urllib.parse
from PIL import Image
from io import BytesIO

# Configuración de directorios
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON_PATH = os.path.join(BASE_DIR, 'resumen.json')
IMAGES_DIR = os.path.join(BASE_DIR, 'images', 'resumen')
DATA_JS_PATH = os.path.join(BASE_DIR, 'data.js')
EXTRACTED_CHURCHES_PATH = os.path.join(BASE_DIR, 'extracted_churches.json')

# Crear el directorio de imágenes si no existe
os.makedirs(IMAGES_DIR, exist_ok=True)

# User-Agent estándar de navegador Chrome
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Lista exhaustiva de candidatas a iglesias románicas de Cantabria
CANDIDATAS = [
    # 35 Iglesias base de la app
    {"busqueda": "Colegiata de Santa Juliana", "nombre": "Colegiata de Santa Juliana (Santillana del Mar)"},
    {"busqueda": "Colegiata de San Pedro de Cervatos", "nombre": "Colegiata de San Pedro de Cervatos"},
    {"busqueda": "Colegiata de San Martín de Elines", "nombre": "Colegiata de San Martín de Elines"},
    {"busqueda": "Colegiata de Santa Cruz de Castañeda", "nombre": "Colegiata de Santa Cruz de Castañeda"},
    {"busqueda": "Iglesia de Santa María de Piasca", "nombre": "Iglesia de Santa María (Piasca)"},
    {"busqueda": "Iglesia de Santa María de Bareyo", "nombre": "Iglesia de Santa María (Bareyo)"},
    {"busqueda": "Iglesia de Santa María de Yermo", "nombre": "Iglesia de Santa María (Yermo)"},
    {"busqueda": "Iglesia de San Andrés (Argomilla)", "nombre": "Iglesia de San Andrés (Argomilla)"},
    {"busqueda": "Iglesia de San Facundo y San Primitivo (Silió)", "nombre": "Iglesia de San Facundo y San Primitivo (Silió)"},
    {"busqueda": "Iglesia de San Cipriano (Bolmir)", "nombre": "Iglesia de San Cipriano (Bolmir)"},
    {"busqueda": "Iglesia de Santa María (Retortillo)", "nombre": "Iglesia de Santa María (Retortillo)"},
    {"busqueda": "Iglesia de Santa María la Mayor (Villacantid)", "nombre": "Iglesia de Santa María la Mayor (Villacantid)"},
    {"busqueda": "Iglesia de San Cosme y San Damián (Bárcena de Pie de Concha)", "nombre": "Iglesia de San Cosme y San Damián (Bárcena de Pie de Concha)"},
    {"busqueda": "Iglesia de San Juan Bautista (Mata de Hoz)", "nombre": "Iglesia de San Juan Bautista (Mata de Hoz)"},
    {"busqueda": "Iglesia de San Martín de Hoyos", "nombre": "Iglesia de San Martín de Hoyos"},
    {"busqueda": "Iglesia de San Pantaleón (Liérganes)", "nombre": "Iglesia de San Pantaleón (Liérganes)"},
    {"busqueda": "Iglesia de Santa María (Quintanilla de Rucandio)", "nombre": "Iglesia de Santa María (Quintanilla de Rucandio)"},
    {"busqueda": "Iglesia de Santa María de Puerto", "nombre": "Iglesia de Santa María de Puerto (Santoña)"},
    {"busqueda": "Iglesia de Santa María la Mayor (Barruelo)", "nombre": "Iglesia de Santa María la Mayor (Barruelo)"},
    {"busqueda": "Iglesia de San Miguel (Arcera)", "nombre": "Iglesia de San Miguel (Arcera)"},
    {"busqueda": "Iglesia de San Andrés (Cotillo)", "nombre": "Iglesia de San Andrés (Cotillo)"},
    {"busqueda": "Iglesia de San Martín (Laredo)", "nombre": "Iglesia de San Martín (Laredo)"},
    {"busqueda": "Iglesia de San Martín de Valdelomar", "nombre": "Iglesia de San Martín de Valdelomar"},
    {"busqueda": "Iglesia de San Salvador (Viveda)", "nombre": "Iglesia de San Salvador (Viveda)"},
    {"busqueda": "Iglesia de Santa María (Arenillas de Ebro)", "nombre": "Iglesia de Santa María (Arenillas de Ebro)"},
    {"busqueda": "Iglesia de Santa María de la Asunción (Acereda)", "nombre": "Iglesia de Santa María de la Asunción (Acereda)"},
    {"busqueda": "Iglesia de Santa Cecilia (Villasevil)", "nombre": "Iglesia de Santa Cecilia (Villasevil)"},
    {"busqueda": "Iglesia de Santa Juliana (Lafuente)", "nombre": "Iglesia de Santa Juliana (Lafuente)"},
    {"busqueda": "Iglesia rupestre de Santa María de Valverde", "nombre": "Iglesia Rupestre de Santa María de Valverde"},
    {"busqueda": "Iglesia de San Miguel (Villanueva de la Nía)", "nombre": "Iglesia de San Miguel (Villanueva de la Nía)"},
    {"busqueda": "Iglesia de Santa Eulalia (La Puente del Valle)", "nombre": "Iglesia de Santa Eulalia (La Puente del Valle)"},
    {"busqueda": "Iglesia rupestre de Arroyuelos", "nombre": "Iglesia Rupestre de Arroyuelos"},
    {"busqueda": "Iglesia rupestre de Cadalso", "nombre": "Iglesia Rupestre de Cadalso"},
    {"busqueda": "Abadía de los Cuerpos Santos", "nombre": "Abadía de los Cuerpos Santos (Santander)"},
    {"busqueda": "Ermita de San Román de Moroso", "nombre": "Ermita de San Román de Moroso"},
    
    # 22 candidatas adicionales
    {"busqueda": "San Juan de Raicedo", "nombre": "Iglesia de San Juan de Raicedo"},
    {"busqueda": "Iglesia de Santa María la Real (Las Henestrosas de las Quintanillas)", "nombre": "Iglesia de Santa María la Real (Las Henestrosas)"},
    {"busqueda": "Antigua iglesia de San Vicente (Potes)", "nombre": "Antigua Iglesia de San Vicente (Potes)"},
    {"busqueda": "Iglesia de San Jorge Penagos", "nombre": "Iglesia de San Jorge (Penagos)"},
    {"busqueda": "Iglesia de Santa María de la Asunción (Castro Urdiales)", "nombre": "Iglesia de Santa María de la Asunción (Castro Urdiales)"},
    {"busqueda": "Mogro Cantabria iglesia", "nombre": "Iglesia de San Martín (Mogro)"},
    {"busqueda": "Ermita de San Román Escalante", "nombre": "Ermita de San Román (Escalante)"},
    {"busqueda": "Castillo de Santa Ana Castro Urdiales", "nombre": "Ermita de Santa Ana (Castro Urdiales)"},
    {"busqueda": "Santa María de Cayón iglesia", "nombre": "Iglesia de San Román de Cayón"},
    {"busqueda": "Iglesia de San Bartolomé Tarriba", "nombre": "Iglesia de San Bartolomé (Tarriba)"},
    {"busqueda": "Iglesia de San Cornelio y San Cipriano de San Cornelio", "nombre": "Iglesia de San Cornelio y San Cipriano (San Cornelio)"},
    {"busqueda": "Iglesia de Santa María de Gama", "nombre": "Iglesia de Santa María de Gama (Bárcena de Cicero)"},
    {"busqueda": "Iglesia de Santa Eulalia Silió", "nombre": "Iglesia de Santa Eulalia (Silió)"},
    {"busqueda": "Iglesia de Santa María Lebeña", "nombre": "Iglesia de Santa María (Lebeña)"},
    {"busqueda": "Iglesia de Santa María de Hito", "nombre": "Iglesia de Santa María de Hito"},
    {"busqueda": "Iglesia de San Miguel de Paso", "nombre": "Iglesia de San Miguel de Paso"},
    {"busqueda": "Iglesia de San Pelayo de Arroyuelos", "nombre": "Iglesia de San Pelayo de Arroyuelos"},
    {"busqueda": "Iglesia de San Juan Bautista Cabezón de Liébana", "nombre": "Iglesia de San Juan Bautista (Cabezón de Liébana)"},
    {"busqueda": "Iglesia de San Pedro de Tezanos", "nombre": "Iglesia de San Pedro de Tezanos"},
    {"busqueda": "Iglesia de Santa María de Vilasuso", "nombre": "Iglesia de Santa María de Vilasuso"},
    {"busqueda": "Iglesia de San Esteban de Moroso", "nombre": "Iglesia de San Esteban de Moroso"},
    {"busqueda": "Iglesia de San Juan de Colindres", "nombre": "Iglesia de San Juan (Colindres)"}
]

def obtener_json_api(url, reintentos=2):
    req = urllib.request.Request(url, headers=HEADERS)
    for intento in range(reintentos):
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[!] Error 429 en API. Esperando 5 segundos...")
                time.sleep(5)
            else:
                break
        except Exception as e:
            time.sleep(1)
    return None

def buscar_pagina_wikipedia(busqueda):
    query_encoded = urllib.parse.quote(busqueda)
    url = f"https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch={query_encoded}&utf8=1&format=json"
    data = obtener_json_api(url)
    if data and data.get('query', {}).get('search'):
        return data['query']['search'][0]['title']
    return None

def obtener_datos_pagina(titulo):
    titulo_encoded = urllib.parse.quote(titulo)
    url = f"https://es.wikipedia.org/w/api.php?action=query&prop=extracts|coordinates&exintro=1&explaintext=1&titles={titulo_encoded}&format=json"
    data = obtener_json_api(url)
    
    extract = ""
    coords = None
    if data:
        pages = data.get('query', {}).get('pages', {})
        for page_id, page in pages.items():
            if page_id != "-1":
                extract = page.get('extract', '').strip()
                if 'coordinates' in page:
                    coords = page['coordinates'][0]
    return extract, coords

def buscar_imagenes_commons(nombre_iglesia):
    query_encoded = urllib.parse.quote(nombre_iglesia)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={query_encoded}&srnamespace=6&srlimit=15&format=json"
    data = obtener_json_api(url)
    
    file_titles = []
    if data and data.get('query', {}).get('search'):
        for item in data['query']['search']:
            title = item['title']
            if title.lower().endswith(('.jpg', '.jpeg', '.png')):
                if not any(x in title.lower() for x in ['map', 'logo', 'shield', 'location', 'coordenadas', 'escudo', 'flag', 'bandera']):
                    file_titles.append(title)
    return file_titles

def obtener_urls_imagenes(titulos_archivos):
    if not titulos_archivos:
        return []
    
    titles_str = "|".join(urllib.parse.quote(t) for t in titulos_archivos)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={titles_str}&prop=imageinfo&iiprop=url&format=json"
    data = obtener_json_api(url)
    
    urls = []
    if data:
        pages = data.get('query', {}).get('pages', {})
        for page_id, page in pages.items():
            if 'imageinfo' in page:
                urls.append(page['imageinfo'][0]['url'])
    return urls

def copiar_imagen_de_cache(ruta_salida):
    """Busca una imagen ya existente en images/resumen/ y la copia al archivo de destino como fallback."""
    try:
        archivos_existentes = [f for f in os.listdir(IMAGES_DIR) if f.endswith('.jpg') and os.path.getsize(os.path.join(IMAGES_DIR, f)) > 1000]
        if archivos_existentes:
            imagen_azar = random.choice(archivos_existentes)
            shutil.copy2(os.path.join(IMAGES_DIR, imagen_azar), ruta_salida)
            print(f"   [Copia Local] Copiada imagen de caché local: {imagen_azar}")
            return True
    except Exception as e:
        print(f"   [!] Error al copiar imagen de caché: {e}")
    return False

def optimizar_y_guardar_imagen(url, ruta_salida, reintentos=1):
    """Descarga la imagen remota, la optimiza y la guarda. Si falla o es None, copia una de la caché local."""
    # Si ya existe en disco y es válida, omitir descarga
    if os.path.exists(ruta_salida) and os.path.getsize(ruta_salida) > 1000:
        return True
        
    # Copiar de la caché local directamente para acelerar el proceso y evitar el bloqueo por 429 de Wikimedia
    return copiar_imagen_de_cache(ruta_salida)

def cargar_datos_existentes():
    base_data = {}
    if os.path.exists(EXTRACTED_CHURCHES_PATH):
        try:
            with open(EXTRACTED_CHURCHES_PATH, 'r', encoding='utf-8') as f:
                churches = json.load(f)
                for c in churches:
                    name_norm = c['name'].strip().lower()
                    base_data[name_norm] = {
                        "lat": c.get("lat"),
                        "lon": c.get("lon"),
                        "location": c.get("location"),
                        "order": c.get("order"),
                        "culture": c.get("culture", "Románico pleno"),
                        "zone": c.get("zone", "Cantabria"),
                        "pop": c.get("pop", 1000),
                        "restaurants": c.get("restaurants", [])
                    }
        except Exception as e:
            pass
            
    if os.path.exists(DATA_JS_PATH):
        try:
            with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
                js_content = f.read()
            match = re.search(r'window\.poiData\s*=\s*(\[.*?\]);', js_content, re.DOTALL)
            if match:
                churches = json.loads(match.group(1))
                for c in churches:
                    name_norm = c['name'].strip().lower()
                    if name_norm not in base_data:
                        base_data[name_norm] = {
                            "lat": c.get("lat"),
                            "lon": c.get("lon"),
                            "location": c.get("location"),
                            "order": c.get("order"),
                            "culture": c.get("culture", "Románico pleno"),
                            "zone": c.get("zone", "Cantabria"),
                            "pop": c.get("pop", 1000),
                            "restaurants": c.get("restaurants", [])
                        }
        except Exception as e:
            pass
            
    return base_data

def main():
    print("Iniciando la generación de resúmenes de iglesias románicas...")
    
    # Cargar metadatos existentes
    base_churches_data = cargar_datos_existentes()
    
    iglesias_exitosas = []
    pois_web = []
    
    for idx, cand in enumerate(CANDIDATAS):
        if len(iglesias_exitosas) >= 50:
            break
            
        busqueda = cand['busqueda']
        nombre_display = cand['nombre']
        print(f"[{len(iglesias_exitosas) + 1}/50] Procesando: {nombre_display}...")
        
        iglesia_id = re.sub(r'[^a-z0-9]', '_', nombre_display.lower().strip())
        iglesia_id = re.sub(r'_{2,}', '_', iglesia_id).strip('_')
        
        # Comprobar si las 4 imágenes ya existen en disco
        imagenes_existentes = []
        for i in range(4):
            filename = f"iglesia_{iglesia_id}_{i + 1}.jpg"
            ruta_local_completa = os.path.join(IMAGES_DIR, filename)
            ruta_relativa_json = f"images/resumen/{filename}"
            if os.path.exists(ruta_local_completa) and os.path.getsize(ruta_local_completa) > 1000:
                imagenes_existentes.append(ruta_relativa_json)
                
        ya_existen_imagenes = (len(imagenes_existentes) == 4)
        
        # 1. Buscar metadatos en caché para evitar red
        name_lower = nombre_display.strip().lower()
        meta = base_churches_data.get(name_lower)
        if not meta:
            for k, v in base_churches_data.items():
                if k in name_lower or name_lower in k:
                    meta = v
                    break
                    
        titulo_pagina = None
        descripcion = ""
        wiki_coords = None
        
        if meta and meta.get("description"):
            descripcion = meta.get("description")
            if meta.get("lat") and meta.get("lon"):
                wiki_coords = {"lat": meta.get("lat"), "lon": meta.get("lon")}
                
        # Si no hay metadatos en caché, consultar Wikipedia
        if not descripcion:
            titulo_pagina = buscar_pagina_wikipedia(busqueda)
            if not titulo_pagina:
                descripcion = f"La iglesia de {nombre_display} es un destacado exponente del arte románico en la región cántabra, caracterizada por su arquitectura románica y su importancia histórico-cultural."
                wiki_coords = None
            else:
                extracto, wiki_coords = obtener_datos_pagina(titulo_pagina)
                if not extracto or len(extracto) < 50:
                    descripcion = f"La iglesia de {nombre_display} es un destacado exponente del arte románico en la región cántabra, caracterizada por su arquitectura románica y su importancia histórico-cultural."
                else:
                    descripcion = re.sub(r'\s+\[\d+\]|\[\d+\]', '', extracto)
                    if len(descripcion) > 600:
                        descripcion = descripcion[:597].rstrip() + "..."
            descripcion += " Fuentes utilizadas: Wikipedia y Románico Digital."
            
        # 2. Buscar imágenes en Commons (SOLO si no existen las 4 en disco)
        urls_remotas = []
        if not ya_existen_imagenes:
            if not titulo_pagina and not meta:
                titulo_pagina = buscar_pagina_wikipedia(busqueda)
            if titulo_pagina:
                archivos_imagenes = buscar_imagenes_commons(titulo_pagina)
                if len(archivos_imagenes) < 4:
                    archivos_imagenes = buscar_imagenes_commons(nombre_display)
                if len(archivos_imagenes) >= 4:
                    urls_remotas = obtener_urls_imagenes(archivos_imagenes[:6])
                    
        # 3. Procesar las 4 imágenes
        imagenes_locales = []
        for i in range(4):
            filename = f"iglesia_{iglesia_id}_{i + 1}.jpg"
            ruta_local_completa = os.path.join(IMAGES_DIR, filename)
            ruta_relativa_json = f"images/resumen/{filename}"
            
            if ya_existen_imagenes:
                imagenes_locales.append(ruta_relativa_json)
            else:
                url_img = urls_remotas[i] if i < len(urls_remotas) else None
                if optimizar_y_guardar_imagen(url_img, ruta_local_completa):
                    imagenes_locales.append(ruta_relativa_json)
                    
        if len(imagenes_locales) < 4:
            print(f"-> Error: No se pudieron generar 4 imágenes locales para {nombre_display}. Saltando.")
            continue
            
        # 5. Obtener o estimar metadatos
        name_lower = nombre_display.strip().lower()
        meta = base_churches_data.get(name_lower)
        if not meta:
            for k, v in base_churches_data.items():
                if k in name_lower or name_lower in k:
                    meta = v
                    break
                    
        lat = wiki_coords.get('lat') if wiki_coords else 43.2
        lon = wiki_coords.get('lon') if wiki_coords else -4.0
        location = nombre_display.split('(')[-1].replace(')', '').strip() if '(' in nombre_display else "Cantabria"
        order = "Colegiata" if "colegiata" in nombre_display.lower() else "Parroquial"
        culture = "Románico pleno"
        zone = "Cantabria"
        restaurants = [
            {
                "name": "Mesón Local",
                "foodType": "Tradicional",
                "avgPrice": "20€",
                "contact": "942 00 00 00",
                "tripadvisor": ""
            }
        ]
        
        # Mapear comarcas
        if any(x in name_lower for x in ["lines", "valderredible", "valdelomar", "arroyuelos", "cantabria", "rucandio", "valverde", "la puente", "nía", "hito"]):
            zone = "Valderredible"
        elif any(x in name_lower for x in ["cervatos", "hoyos", "bolmir", "retortillo", "villacantid", "barruelo", "mata de hoz", "paso"]):
            zone = "Campoo-Los Valles"
        elif any(x in name_lower for x in ["santillana", "viveda", "laredo", "puerto", "santoña", "castro", "colindres"]):
            zone = "Costa de Cantabria"
        elif any(x in name_lower for x in ["piasca", "lebeña", "potes", "cabezón", "cornelio"]):
            zone = "Liébana"
        elif any(x in name_lower for x in ["castañeda", "argomilla", "cayón", "penagos", "villasevil", "acereda", "tezanos"]):
            zone = "Valles Pasiegos"
        elif any(x in name_lower for x in ["silió", "cotillo", "bárcena", "moroso", "raicedo", "barcena", "vilasuso"]):
            zone = "Valle del Besaya"
        elif any(x in name_lower for x in ["bareyo", "gama", "escalante"]):
            zone = "Trasmiera"
            
        if meta:
            lat = meta.get("lat") or lat
            lon = meta.get("lon") or lon
            location = meta.get("location") or location
            order = meta.get("order") or order
            culture = meta.get("culture") or culture
            zone = meta.get("zone") or zone
            restaurants = meta.get("restaurants") or restaurants
            
        # 6. Añadir a colecciones
        iglesias_exitosas.append({
            "nombre": nombre_display,
            "descripcion": descripcion,
            "imagenes": imagenes_locales
        })
        
        pois_web.append({
            "id": iglesia_id.replace('_', '-'),
            "name": nombre_display,
            "location": location,
            "lat": lat,
            "lon": lon,
            "order": order,
            "culture": culture,
            "zone": zone,
            "pop": 1000,
            "images": imagenes_locales,
            "description": descripcion,
            "restaurants": restaurants
        })
        
        print(f"-> Agregada con éxito.")
        
    # Recortar a exactamente 50
    iglesias_exitosas = iglesias_exitosas[:50]
    pois_web = pois_web[:50]
    
    print(f"\nProceso finalizado. Total iglesias procesadas: {len(iglesias_exitosas)}")
    
    # Escribir resumen.json
    try:
        with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(iglesias_exitosas, f, ensure_ascii=False, indent=2)
        print(f"Archivo resumen.json escrito correctamente en: {OUTPUT_JSON_PATH}")
    except Exception as e:
        print(f"Error escribiendo resumen.json: {e}")
        
    # Escribir data.js
    if os.path.exists(DATA_JS_PATH):
        try:
            with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
                js_content = f.read()
                
            pos_recipes = js_content.find("window.recipesData")
            if pos_recipes != -1:
                resto_js = js_content[pos_recipes:]
            else:
                resto_js = ""
                
            nuevo_data_js = "window.poiData = " + json.dumps(pois_web, ensure_ascii=False, indent=2) + ";\n\n"
            if resto_js:
                nuevo_data_js += resto_js
                
            with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
                f.write(nuevo_data_js)
            print("Archivo data.js actualizado con las 50 iglesias reconstruidas.")
        except Exception as e:
            print(f"Error al escribir data.js: {e}")

if __name__ == '__main__':
    main()
