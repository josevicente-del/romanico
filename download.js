const fs = require('fs');
const https = require('https');
const path = require('path');

const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir);
}

let dataJs = fs.readFileSync('data.js', 'utf8');

// Regex to find all wikipedia/wikimedia images inside data.js
const regex = /(https:\/\/[^"']+\.(?:jpg|png|JPG|PNG)[^"']*)/g;
let match;
let downloads = [];
let imgCounter = 1;

while ((match = regex.exec(dataJs)) !== null) {
    const url = match[1];
    // Evitar descargar Picsum si ya se cambió
    if (url.includes('picsum')) continue;
    
    // Convertir URLs de thumb.php si quedasen
    let cleanUrl = url;
    if (cleanUrl.includes('thumb.php?f=')) {
        const file = cleanUrl.split('f=')[1].split('&')[0];
        cleanUrl = `https://upload.wikimedia.org/wikipedia/commons/${file}`; // aproximación, puede fallar si no tiene MD5 path, mejor evitar descargar las de thumb o limpiarlas si es posible.
    }
    
    // Check if we already scheduled this URL
    let existing = downloads.find(d => d.original === url);
    if (!existing) {
        const ext = url.toLowerCase().includes('.png') ? '.png' : '.jpg';
        const filename = `iglesia_${imgCounter}${ext}`;
        imgCounter++;
        
        downloads.push({
            original: url,
            cleanUrl: cleanUrl,
            localFile: filename,
            localPath: `./images/${filename}`
        });
    }
}

// Para descargar asíncronamente
const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // follow redirect
                https.get(res.headers.location, (res2) => {
                    res2.pipe(file);
                    file.on('finish', () => { file.close(resolve); });
                }).on('error', reject);
            } else if (res.statusCode === 200) {
                res.pipe(file);
                file.on('finish', () => { file.close(resolve); });
            } else {
                reject(`Status ${res.statusCode} for ${url}`);
            }
        }).on('error', reject);
    });
};

async function processAll() {
    console.log(`Encontradas ${downloads.length} imágenes para descargar...`);
    for (let d of downloads) {
        try {
            console.log(`Descargando ${d.cleanUrl}...`);
            await downloadImage(d.cleanUrl, path.join(imgDir, d.localFile));
            console.log(`Guardado como ${d.localFile}`);
            // Reemplazar globalmente en data.js
            dataJs = dataJs.split(d.original).join(d.localPath);
        } catch (e) {
            console.error(`Error descargando ${d.original}:`, e);
        }
    }
    
    fs.writeFileSync('data.js', dataJs, 'utf8');
    console.log("data.js actualizado con rutas locales.");
}

processAll();
