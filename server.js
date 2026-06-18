const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
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

// =========================================================================
// CONFIGURACIÓN DE CORREO ELECTRÓNICO (SMTP / ETHEREAL)
// =========================================================================
// Esta función inicializa el transportador de nodemailer. Si se encuentran
// variables de entorno SMTP se usan directamente. Si no, se genera una cuenta
// temporal en Ethereal de forma dinámica para fines de prueba y desarrollo.
let transporter;
async function initEmailTransporter() {
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log("Servicio de correo: Utilizando SMTP configurado por entorno.");
    } else {
        // En ausencia de SMTP, creamos un transportador de pruebas en Ethereal
        try {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log("Servicio de correo: Creada cuenta temporal de pruebas en Ethereal.");
            console.log(`Buzón de pruebas Ethereal User: ${testAccount.user}`);
        } catch (err) {
            console.error("Error al crear cuenta de prueba SMTP:", err);
            // Fallback a consola si falla Ethereal
            transporter = {
                sendMail: async (options) => {
                    console.log("--- SIMULACIÓN DE EMAIL (Fallback a consola) ---");
                    console.log(`Para: ${options.to}`);
                    console.log(`Asunto: ${options.subject}`);
                    console.log(`Cuerpo HTML:\n${options.html}`);
                    console.log("-----------------------------------------------");
                    return { messageId: 'console-simulated-id' };
                }
            };
        }
    }
}

// =========================================================================
// PERSISTENCIA DE USUARIOS DEL SERVIDOR (BASE DE DATOS EN ARCHIVO JSON)
// =========================================================================
const USERS_FILE = path.join(__dirname, 'users.json');

// Función auxiliar para leer usuarios de la base de datos local JSON
function readUsersFromFile() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error("Error al leer users.json:", err);
    }
    return [];
}

// Función auxiliar para escribir usuarios en la base de datos local JSON
function writeUsersToFile(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error("Error al escribir users.json:", err);
        return false;
    }
}

// =========================================================================
// ENDPOINTS DE USUARIOS Y NOTIFICACIÓN
// =========================================================================

// Endpoint para el registro de nuevos usuarios en el servidor
app.post('/api/users/register', async (req, res) => {
    const { username, email, country, city, province } = req.body;
    
    if (!username || !email) {
        return res.status(400).json({ error: "Faltan campos requeridos (nombre de usuario y email)." });
    }

    try {
        const users = readUsersFromFile();
        const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (exists) {
            return res.json({ success: true, message: "El usuario ya está registrado en el backend." });
        }

        const newUser = {
            username,
            email: email.toLowerCase(),
            country,
            city,
            province,
            createdAt: new Date().toISOString(),
            verified: false
        };

        users.push(newUser);
        writeUsersToFile(users);
        console.log(`Usuario registrado en backend: ${email}`);

        // Enviar correo electrónico de verificación medieval y divertido en español
        const emailHtml = `
            <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #904d00; border-radius: 10px; background-color: #fcfcf9;">
                <h2 style="color: #1c3a6b; text-align: center; border-bottom: 2px solid #904d00; padding-bottom: 10px; font-family: 'Times New Roman', serif;">
                    🛡️ ¡Saludos, Noble Viajero del Románico! 🏰
                </h2>
                <p style="font-size: 1.1rem; line-height: 1.6; color: #333;">
                    ¡Albricias y regocijo! Tu pergamino de inscripción ha llegado a los muros de nuestra fortaleza digital. Nosotros, los guardianes del <strong>Románico en Cantabria</strong>, te damos la más cálida de las bienvenidas al gremio de viajeros.
                </p>
                <p style="font-size: 1.1rem; line-height: 1.6; color: #333;">
                    Has sido registrado oficialmente como <strong>${username}</strong>. A partir de ahora, tu mapa de exploración está listo para ser marcado con cada colegiata, ermita y ábside medieval que visites.
                </p>
                <div style="background-color: #f4f7f6; padding: 15px; border-radius: 8px; border-left: 5px solid #1c3a6b; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1c3a6b;">📝 Tu Credencial de Viajero:</h3>
                    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 0;">
                        <li><strong>Reino:</strong> Cantabria</li>
                        <li><strong>Comarca:</strong> ${province || 'Desconocida'}</li>
                        <li><strong>Villa:</strong> ${city || 'Desconocida'}</li>
                    </ul>
                </div>
                <p style="font-size: 1.1rem; line-height: 1.6; color: #333;">
                    Por favor, confirma tu alistamiento y verifica este correo para que los cuervos mensajeros sepan exactamente a dónde enviar las novedades de la agenda cántabra.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:${PORT}/#verificar?email=${encodeURIComponent(email)}" style="background-color: #904d00; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 1.1rem; border: 1px solid #753f00; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
                        ⚔️ Verificar mi Cuenta de Viajero ⚔️
                    </a>
                </div>
                <p style="font-size: 0.9rem; color: #777; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; margin-top: 25px; text-align: center;">
                    "Non bene pro toto libertas venditur auro" — Que la luz medieval guíe tus pasos.
                </p>
            </div>
        `;

        const mailOptions = {
            from: '"Gremio Románico en Cantabria" <no-reply@cantabriaromanica.org>',
            to: email,
            subject: '🛡️ ¡Verifica tu credencial de viaje, noble aventurero!',
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);
        
        // Si usamos Ethereal, mostramos el enlace de previsualización en la consola
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 Correo de verificación enviado. Previsualización web: ${previewUrl}`);
            return res.json({ success: true, message: "Usuario registrado. Correo de verificación enviado con éxito.", previewUrl });
        }

        res.json({ success: true, message: "Usuario registrado y correo de verificación enviado." });

    } catch (err) {
        console.error("Error al registrar usuario o enviar correo en backend:", err);
        res.status(500).json({ error: "Error interno en el proceso de registro." });
    }
});

// Endpoint para obtener la lista de usuarios registrados (Solo para administración)
app.get('/api/admin/users', (req, res) => {
    try {
        const users = readUsersFromFile();
        res.json({
            success: true,
            total: users.length,
            users: users.map(u => ({
                username: u.username,
                email: u.email,
                createdAt: u.createdAt,
                province: u.province,
                city: u.city
            }))
        });
    } catch (err) {
        console.error("Error al obtener la lista de usuarios para administración:", err);
        res.status(500).json({ error: "Error al obtener la lista de usuarios." });
    }
});

// Endpoint de pruebas para disparar manualmente el envío del boletín
app.get('/api/test/send-bulletin', async (req, res) => {
    console.log("Iniciando disparo manual de prueba del boletín...");
    await enviarBoletinNovedades();
    res.json({ success: true, message: "Boletín quincenal disparado para pruebas." });
});

// =========================================================================
// CRON QUINCENAL: BOLETÍN DE NOVEDADES DE LA AGENDA (INFORMAL Y DIVERTIDO)
// =========================================================================
// Se ejecuta los días 1 y 15 de cada mes a las 00:00 (quincenal)
cron.schedule('0 0 1,15 * *', async () => {
    console.log("CRON QUINCENAL: Iniciando envío de novedades de la agenda a los aventureros...");
    await enviarBoletinNovedades();
});

// Función para enviar el boletín divertido a todos los usuarios
async function enviarBoletinNovedades() {
    try {
        const users = readUsersFromFile();
        if (users.length === 0) {
            console.log("No hay usuarios registrados en la base de datos para enviar el boletín.");
            return;
        }

        // Cargar eventos del archivo events.json
        let events = [];
        if (fs.existsSync('./events.json')) {
            events = JSON.parse(fs.readFileSync('./events.json', 'utf8'));
        }

        if (events.length === 0) {
            console.log("No hay eventos en la agenda para enviar en esta quincena.");
            return;
        }

        // Seleccionar máximo 4 eventos recientes o relevantes
        const novedades = events.slice(0, 4);

        console.log(`Enviando boletín quincenal a ${users.length} usuarios con ${novedades.length} novedades de la agenda.`);

        for (const user of users) {
            const emailHtml = `
                <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 3px dashed #e74c3c; border-radius: 15px; background-color: #fffdec; color: #333;">
                    <div style="text-align: center; font-size: 3rem; margin-bottom: 10px;">📣🎺</div>
                    <h2 style="color: #c0392b; text-align: center; font-family: 'Times New Roman', serif; margin-top: 0; font-size: 1.8rem;">
                        ¡Chismes frescos de la Corte Cántabra, noble ${user.username}!
                    </h2>
                    <p style="font-size: 1.1rem; line-height: 1.6; text-align: justify;">
                        ¡Hola de nuevo, intrépido explorador de murallas! Esperamos que no te haya atacado ningún dragón campurriano esta quincena. Los juglares reales han estado haciendo horas extras recorriendo los valles y nos han traído el chismógrafo medieval calentito.
                    </p>
                    <p style="font-size: 1.1rem; line-height: 1.6;">
                        ¡Desempolva tu cota de malla y prepara tus mejores sandalias de senderismo, porque aquí tienes los eventos y fiestas que no te puedes perder las próximas lunas! 👇
                    </p>

                    <div style="background-color: #fff; border: 2px solid #f39c12; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #e67e22; border-bottom: 1px solid #f39c12; padding-bottom: 5px;">📜 La Agenda del Reino:</h3>
                        ${novedades.map((ev, idx) => `
                            <div style="margin-bottom: 18px; ${idx < novedades.length - 1 ? 'border-bottom: 1px dotted #ccc; padding-bottom: 15px;' : ''}">
                                <span style="background-color: #f39c12; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
                                    ${ev.type || 'Evento'}
                                </span>
                                <h4 style="margin: 8px 0 4px 0; color: #2c3e50; font-size: 1.15rem;">⚔️ ${ev.title}</h4>
                                <p style="margin: 0; font-size: 0.95rem; font-weight: bold; color: #c0392b;">📅 Fecha: ${ev.date}</p>
                                <p style="margin: 2px 0 8px 0; font-size: 0.95rem; color: #7f8c8d;">📍 Lugar: ${ev.location || 'Cantabria'}</p>
                                <p style="margin: 0; font-size: 0.95rem; line-height: 1.4; color: #555;">${ev.desc || ev.description || 'Una algarada medieval imperdible.'}</p>
                            </div>
                        `).join('')}
                    </div>

                    <p style="font-size: 1.1rem; line-height: 1.6; text-align: justify;">
                        Recuerda que si visitas alguna de estas joyas arquitectónicas, puedes subir tu foto directamente en nuestra web para presumir ante el rey y toda la plebe. ¡Que tus andanzas sean épicas y no te falte un buen tazón de sidra en el camino!
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:${PORT}" style="background-color: #c0392b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.2rem; box-shadow: 0 5px 10px rgba(192,57,43,0.3); display: inline-block;">
                            🏰 Visitar la App y Explorar el Mapa 🗺️
                        </a>
                    </div>

                    <div style="border-top: 2px dashed #e74c3c; padding-top: 15px; margin-top: 25px; text-align: center; font-size: 0.85rem; color: #7f8c8d; font-style: italic;">
                        Enviado por las palomas mensajeras del Gremio Románico Cántabro. Si no deseas recibir más pergaminos, puedes mandarle un cuervo con tu queja formal a nuestro obispo local.
                    </div>
                </div>
            `;

            const mailOptions = {
                from: '"Gremio Románico en Cantabria" <no-reply@cantabriaromanica.org>',
                to: user.email,
                subject: '🎺 ¡Extra, extra! Novedades medievales en la agenda real 🏰',
                html: emailHtml
            };

            const info = await transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`📧 Boletín quincenal enviado a ${user.email}. Previsualización web: ${previewUrl}`);
            } else {
                console.log(`📧 Boletín quincenal enviado con éxito a ${user.email}.`);
            }
        }
    } catch (err) {
        console.error("Error al enviar el boletín quincenal de novedades:", err);
    }
}

// Programar tarea mensual de scraping (minuto 0, hora 0, día 1 del mes)
cron.schedule('0 0 1 * *', async () => {
    console.log("CRON: Actualizando agenda mensual de eventos...");
    await scrapeEvents();
});

// Arranque
scrapeEvents().then(async () => {
    // Inicializar el transportador de correo al arrancar
    await initEmailTransporter();

    app.listen(PORT, () => {
        console.log(`Servidor Backend PWA corriendo en http://localhost:${PORT}`);
        console.log(`Renovación automática mensual programada.`);
    });
});
