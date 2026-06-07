import urllib.request
import urllib.parse
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def search_files(query):
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&srnamespace=6&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    res = json.loads(urllib.request.urlopen(req, context=ctx).read().decode('utf-8'))
    results = res.get("query", {}).get("search", [])
    for r in results:
        title = r.get("title")
        file_title = title[5:]
        info_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles=File:{urllib.parse.quote(file_title)}&prop=imageinfo&iiprop=url&format=json"
        req_info = urllib.request.Request(info_url, headers={'User-Agent': 'Mozilla/5.0'})
        res_info = json.loads(urllib.request.urlopen(req_info, context=ctx).read().decode('utf-8'))
        pages = res_info.get("query", {}).get("pages", {})
        for page in pages.values():
            imageinfo = page.get("imageinfo", [])
            if imageinfo:
                print(f"{query} -> {imageinfo[0].get('url')}")
    return None

print("--- Retortillo ---")
search_files("Iglesia de Retortillo")
print("--- Villacantid ---")
search_files("Iglesia de Villacantid")
print("--- Silió ---")
search_files("Iglesia de Silió")
print("--- Bolmir ---")
search_files("Iglesia de Bolmir")
