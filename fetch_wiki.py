import urllib.request
import urllib.parse
import json
import time

def fetch_category_members(category):
    url = f"https://es.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle={urllib.parse.quote(category)}&cmlimit=50&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RomanicoApp/1.0'})
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    return [member['title'] for member in data.get('query', {}).get('categorymembers', []) if not member['title'].startswith('Categor')]

categories = ["Categoría:Iglesias_románicas_de_Cantabria", "Categoría:Colegiatas_de_Cantabria"]
titles = []
for c in categories:
    titles.extend(fetch_category_members(c))

titles = list(set(titles))

print(f"Encontradas {len(titles)} iglesias.")

results = []

def chunker(seq, size):
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))

for chunk in chunker(titles, 10):
    titles_str = "|".join(urllib.parse.quote(t) for t in chunk)
    # Get extract, coordinates, and images
    url = f"https://es.wikipedia.org/w/api.php?action=query&prop=extracts|coordinates|pageimages|images&exintro=1&explaintext=1&piprop=original&titles={titles_str}&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    pages = data.get('query', {}).get('pages', {})
    
    for page_id, page in pages.items():
        if page_id == "-1": continue
        title = page.get('title', '')
        extract = page.get('extract', 'Descripción no disponible.').split('\n')[0]
        if len(extract) > 200:
            extract = extract[:197] + "..."
            
        coords = page.get('coordinates', [{}])[0]
        lat = coords.get('lat', 43.3)
        lon = coords.get('lon', -4.0)
        
        main_img = ""
        if 'original' in page:
            main_img = page['original']['source']
            
        images_list = []
        if 'images' in page:
            for img in page['images']:
                img_title = img['title']
                if img_title.lower().endswith(('.jpg', '.png', '.jpeg')) and 'map' not in img_title.lower() and 'logo' not in img_title.lower():
                    images_list.append(img_title)
                    
        # fetch image urls for secondary images
        image_urls = []
        if main_img:
            image_urls.append(main_img)
            
        images_list = [img for img in images_list if img != title]
        if len(images_list) > 0:
            images_str = "|".join(urllib.parse.quote(i) for i in images_list[:4])
            img_url = f"https://es.wikipedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&titles={images_str}&format=json"
            try:
                img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                img_resp = urllib.request.urlopen(img_req)
                img_data = json.loads(img_resp.read())
                for p_id, p_info in img_data.get('query', {}).get('pages', {}).items():
                    if 'imageinfo' in p_info:
                        u = p_info['imageinfo'][0]['url']
                        if u not in image_urls:
                            image_urls.append(u)
            except Exception as e:
                pass
                
        if not image_urls:
            # Fallback for pages without image
            image_urls = ["https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Santa_Mar%C3%ADa_de_Lebe%C3%B1a_01.jpg/800px-Santa_Mar%C3%ADa_de_Lebe%C3%B1a_01.jpg"]
            
        res = {
            "id": title.lower().replace(' ', '-').replace(',', '').replace('(', '').replace(')', '').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u'),
            "name": title,
            "location": title.split('(')[-1].replace(')','') if '(' in title else title.split(' de ')[-1],
            "lat": lat,
            "lon": lon,
            "order": "Colegiata" if "Colegiata" in title else "Parroquial",
            "culture": "Románico pleno",
            "zone": "Cantabria",
            "pop": 1000,
            "images": image_urls[:4],
            "description": extract,
            "restaurants": [
                {
                    "name": "Mesón Local",
                    "foodType": "Tradicional",
                    "avgPrice": "20€",
                    "contact": "942 00 00 00",
                    "tripadvisor": ""
                }
            ]
        }
        results.append(res)
        print(f"Procesado: {title}")

# Guardar como JSON array
with open('extracted_churches.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Completado.")
