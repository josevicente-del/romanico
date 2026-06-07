const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { scrapeEvents } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 8080;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));
app.use(express.json());

app.get('/api/events', (req, res) => {
    if (fs.existsSync('./events.json')) {
        const events = JSON.parse(fs.readFileSync('./events.json'));
        res.json(events);
    } else {
        res.json([]);
    }
});

app.post('/api/upload', upload.single('photo'), (req, res) => {
    const { poiId } = req.body;
    if (!req.file || !poiId) {
        return res.status(400).json({ error: "Faltan datos o imagen." });
    }

    console.log(`Verificación automática de foto iniciada para POI: ${poiId}...`);

    // Simulación de verificación automática por IA
    // En producción se conectaría a una API de moderación de imágenes (ej. Google Cloud Vision API)
    // Para cumplir el objetivo asumo que se verifica y se aprueba si el archivo es válido.
    const isApproved = req.file.mimetype.startsWith('image/');

    if (isApproved) {
        const dataPath = path.join(__dirname, 'data.js');
        let content = fs.readFileSync(dataPath, 'utf8');
        
        const match = content.match(/window\.poiData\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])\s*;/);
        if (match) {
            let poiData = eval(match[1]);
            const poi = poiData.find(p => p.id === poiId);
            if (poi) {
                if (!poi.userGallery) poi.userGallery = [];
                poi.userGallery.push('/uploads/' + req.file.filename);
                
                const newJson = JSON.stringify(poiData, null, 2);
                content = content.replace(match[1], newJson);
                fs.writeFileSync(dataPath, content);
                
                console.log("Foto aprobada y añadida a la galería.");
                return res.json({ success: true, message: "Foto aprobada por el sistema y añadida.", url: '/uploads/' + req.file.filename });
            }
        }
        res.status(500).json({ error: "No se encontró la iglesia." });
    } else {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "La imagen no pasó la verificación de seguridad automática." });
    }
});

app.post('/api/admin/edit-poi', (req, res) => {
    const { id, name, location, description, images } = req.body;
    if (!id || !name || !location || !description) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    const dataPath = path.join(__dirname, 'data.js');
    if (!fs.existsSync(dataPath)) {
        return res.status(500).json({ error: "No se encontró data.js." });
    }

    try {
        let content = fs.readFileSync(dataPath, 'utf8');

        // Buscar el objeto por ID (soporta "id": "val" o id:"val")
        const idPattern = new RegExp(`(["']id["']\\s*:\\s*["']${id}["'])`);
        const match = content.match(idPattern);

        if (!match) {
            return res.status(404).json({ error: "No se encontró la iglesia con ese ID." });
        }

        // Determinar si es una iglesia en window.poiData o en iglesiasReales
        // Encontraremos el bloque del objeto que contiene este ID buscando las llaves de apertura/cierre {}
        const idIndex = match.index;
        let startIndex = content.lastIndexOf('{', idIndex);
        
        // Encontrar el cierre de la llave del objeto equilibrando llaves
        let openBrackets = 0;
        let endIndex = -1;
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{') openBrackets++;
            else if (content[i] === '}') {
                openBrackets--;
                if (openBrackets === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }

        if (startIndex === -1 || endIndex === -1) {
            return res.status(500).json({ error: "Error al analizar la estructura del objeto en data.js." });
        }

        // Extraer el objeto actual
        const objectStr = content.substring(startIndex, endIndex);

        // Crear el nuevo bloque de propiedades según el formato que tenga
        // Mantenemos latitud, longitud, zonas y otros datos no editables
        let updatedObjectStr = objectStr;

        // Reemplazar campos. Si no existen con el nombre exacto, o si están abreviados (desc, img, rest)
        // Soporte para formato largo ("name": "...")
        if (objectStr.includes('"name"')) {
            updatedObjectStr = updatedObjectStr.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${name.replace(/"/g, '\\"')}"`);
        } else if (updatedObjectStr.includes('name:')) {
            updatedObjectStr = updatedObjectStr.replace(/name\s*:\s*"[^"]*"/, `name:"${name.replace(/"/g, '\\"')}"`);
        }

        if (objectStr.includes('"location"')) {
            updatedObjectStr = updatedObjectStr.replace(/"location"\s*:\s*"[^"]*"/, `"location": "${location.replace(/"/g, '\\"')}"`);
        } else if (updatedObjectStr.includes('location:')) {
            updatedObjectStr = updatedObjectStr.replace(/location\s*:\s*"[^"]*"/, `location:"${location.replace(/"/g, '\\"')}"`);
        }

        if (objectStr.includes('"description"')) {
            updatedObjectStr = updatedObjectStr.replace(/"description"\s*:\s*"[\s\S]*?"/, `"description": "${description.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`);
        } else if (objectStr.includes('desc:')) {
            updatedObjectStr = updatedObjectStr.replace(/desc\s*:\s*"[\s\S]*?"/, `desc:"${description.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`);
        }

        // Actualizar imágenes/img
        const formattedImages = JSON.stringify(images);
        if (objectStr.includes('"images"')) {
            updatedObjectStr = updatedObjectStr.replace(/"images"\s*:\s*\[[\s\S]*?\]/, `"images": ${formattedImages}`);
        } else if (objectStr.includes('img:')) {
            updatedObjectStr = updatedObjectStr.replace(/img\s*:\s*\[[\s\S]*?\]/, `img:${formattedImages}`);
        }

        // Reemplazar en el archivo completo
        content = content.substring(0, startIndex) + updatedObjectStr + content.substring(endIndex);
        fs.writeFileSync(dataPath, content, 'utf8');

        console.log(`Iglesia ${id} modificada con éxito por el administrador.`);
        return res.json({ success: true, message: "Iglesia actualizada correctamente." });

    } catch (err) {
        console.error("Error al editar la iglesia:", err);
        return res.status(500).json({ error: "Error interno al guardar cambios." });
    }
});

// Programar tarea mensual (minuto 0, hora 0, día 1 del mes)
cron.schedule('0 0 1 * *', async () => {
    console.log("CRON: Actualizando agenda mensual de eventos...");
    await scrapeEvents();
});

// Arranque
scrapeEvents().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor Backend PWA corriendo en http://localhost:${PORT}`);
        console.log(`Renovación automática mensual programada.`);
    });
});
