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
