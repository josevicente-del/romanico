/**
 * AGENTE_NOTICIAS.JS
 * 
 * Agente autónomo de búsqueda y difusión del arte románico en Cantabria.
 * 
 * Funcionalidad:
 * 1. Busca noticias recientes en Google News RSS sobre el románico en Cantabria.
 * 2. Filtra las noticias para que no se repitan (mediante sent_news.json) y tengan antigüedad menor a 30 días.
 * 3. Incorpora la agenda de eventos relevantes desde events.json.
 * 4. Envía un pergamino/correo mensual redactado con estética medieval a todos los viajeros verificados.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// URL del feed RSS de Google News en español enfocado en "romanico cantabria"
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=romanico+cantabria&hl=es&gl=ES&ceid=ES:es';

/**
 * Función auxiliar para leer un archivo JSON de forma segura.
 */
function readJsonFile(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error(`Error al leer archivo JSON en ${filePath}:`, err);
    }
    return defaultValue;
}

/**
 * Función auxiliar para escribir en un archivo JSON de forma segura.
 */
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Error al escribir archivo JSON en ${filePath}:`, err);
        return false;
    }
}

/**
 * Ejecuta el agente buscador y envía el boletín mensual.
 * 
 * @param {object} transporter - Transportador de nodemailer configurado.
 * @param {string} usersFile - Ruta al archivo de usuarios.
 * @param {string} eventsFile - Ruta al archivo de eventos.
 * @param {string} sentNewsFile - Ruta al archivo histórico de noticias enviadas.
 * @param {number} port - Puerto para las URLs del servidor.
 */
async function ejecutarAgenteNoticias(transporter, usersFile, eventsFile, sentNewsFile, port = 8080) {
    console.log("AGENTE: Iniciando ejecución mensual del Agente de Noticias del Románico...");

    try {
        // --- 1. BUSCAR NOTICIAS EN GOOGLE NEWS RSS ---
        console.log(`AGENTE: Buscando noticias mediante RSS: ${GOOGLE_NEWS_RSS}`);
        const response = await axios.get(GOOGLE_NEWS_RSS);
        const $ = cheerio.load(response.data, { xmlMode: true });

        const noticiasEncontradas = [];
        $('item').each((idx, el) => {
            const title = $(el).find('title').text();
            const link = $(el).find('link').text();
            const pubDateStr = $(el).find('pubDate').text();
            const desc = $(el).find('description').text();

            noticiasEncontradas.push({
                title,
                link,
                pubDate: new Date(pubDateStr),
                desc
            });
        });

        console.log(`AGENTE: Se extrajeron ${noticiasEncontradas.length} noticias potenciales.`);

        // --- 2. FILTRAR POR ANTIGÜEDAD (MÁXIMO 1 MES) ---
        const unMesAtras = new Date();
        unMesAtras.setMonth(unMesAtras.getMonth() - 1);

        const noticiasNuevas = noticiasEncontradas.filter(n => n.pubDate >= unMesAtras);
        console.log(`AGENTE: ${noticiasNuevas.length} noticias cumplen el criterio de antigüedad (máximo 1 mes).`);

        // --- 3. FILTRAR DUPLICADOS (NOTICIAS ENVIADAS ANTERIORMENTE) ---
        const historicoEnviadas = readJsonFile(sentNewsFile, []);
        const noticiasParaEnviar = noticiasNuevas.filter(n => !historicoEnviadas.includes(n.link));

        console.log(`AGENTE: ${noticiasParaEnviar.length} noticias son totalmente nuevas e inéditas.`);

        // --- 4. COMPILAR LA AGENDA DE EVENTOS ---
        const agenda = readJsonFile(eventsFile, []);
        // Seleccionamos los primeros 4 eventos destacados
        const eventosDestacados = agenda.slice(0, 4);

        // Si no hay noticias nuevas y tampoco hay eventos, evitamos enviar un correo vacío
        if (noticiasParaEnviar.length === 0 && eventosDestacados.length === 0) {
            console.log("AGENTE: No hay noticias nuevas ni eventos vigentes para reportar esta luna. Suspendiendo envío.");
            return { success: true, count: 0, reason: "No hay novedades" };
        }

        // --- 5. CARGAR SUSCRIPTORES ---
        const users = readJsonFile(usersFile, []);
        const suscriptores = users.filter(u => u.verified === true);

        if (suscriptores.length === 0) {
            console.log("AGENTE: No hay suscriptores verificados en el sistema.");
            return { success: true, count: 0, reason: "Sin suscriptores" };
        }

        // Limitar la cantidad de noticias del boletín a las 5 más recientes para legibilidad
        const noticiasSeleccionadas = noticiasParaEnviar.slice(0, 5);

        console.log(`AGENTE: Preparando envío de Boletín Mensual a ${suscriptores.length} suscriptores.`);

        // --- 6. ENVIAR BOLETÍN MEDIEVAL POR CORREO ---
        for (const user of suscriptores) {
            const emailHtml = `
                <div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 2px solid #5a3c1c; border-radius: 12px; background-color: #fdfaf2; color: #2c1a04; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <!-- Cabecera Real -->
                    <div style="text-align: center; border-bottom: 2px double #5a3c1c; padding-bottom: 15px; margin-bottom: 20px;">
                        <span style="font-size: 2.5rem;">📜</span>
                        <h2 style="color: #6d1c0c; font-family: 'Times New Roman', serif; margin: 5px 0 0 0; font-size: 1.8rem; letter-spacing: 1px;">
                            CRÓNICAS DEL ROMÁNICO EN CANTABRIA
                        </h2>
                        <p style="font-style: italic; font-size: 0.95rem; color: #7a5c3c; margin: 5px 0 0 0;">
                            — Edición Mensual de la Corte del Gremio de Viajeros —
                        </p>
                    </div>

                    <!-- Saludo Medieval -->
                    <p style="font-size: 1.1rem; line-height: 1.6; text-align: justify;">
                        ¡Saludos, noble viajero <strong>${user.username}</strong>! Que el viento de los valles cántabros guíe tus pasos. Nuestros exploradores y sabios del reino han recopilado las más frescas noticias sobre nuestro patrimonio de piedra y la agenda cultural para las próximas lunas.
                    </p>

                    <!-- Sección de Noticias de Prensa Recientes (Si hay) -->
                    ${noticiasSeleccionadas.length > 0 ? `
                        <div style="margin-top: 25px;">
                            <h3 style="color: #6d1c0c; border-left: 4px solid #6d1c0c; padding-left: 10px; font-family: 'Times New Roman', serif; font-size: 1.35rem; margin-bottom: 12px;">
                                📰 Crónicas y Novedades del Gremio:
                            </h3>
                            ${noticiasSeleccionadas.map(n => `
                                <div style="background-color: #fffaf0; border: 1px solid #e8dfcc; padding: 15px; border-radius: 8px; margin-bottom: 12px;">
                                    <h4 style="margin: 0 0 5px 0; font-size: 1.1rem; color: #2c1a04;">
                                        <a href="${n.link}" target="_blank" style="color: #8c2512; text-decoration: none; font-weight: bold;">
                                            ⚔️ ${n.title}
                                        </a>
                                    </h4>
                                    <p style="margin: 0; font-size: 0.85rem; color: #7f8c8d; font-style: italic; margin-bottom: 8px;">
                                        📅 Publicado el ${n.pubDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                    <p style="margin: 0; font-size: 0.95rem; line-height: 1.4; color: #4e3518;">
                                        ${n.desc.replace(/<[^>]*>?/gm, '').substring(0, 160)}...
                                    </p>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="margin-top: 25px; background-color: #f7eed7; padding: 15px; border-radius: 8px; border-left: 4px solid #7a5c3c;">
                            <p style="margin: 0; font-size: 1rem; font-style: italic; color: #5a3c1c;">
                                🛡️ No se han publicado nuevas crónicas en la prensa sobre el románico cántabro esta luna. ¡Una excelente oportunidad para que explores por ti mismo y nos traigas noticias!
                            </p>
                        </div>
                    `}

                    <!-- Sección de Agenda Cultural del Mes -->
                    ${eventosDestacados.length > 0 ? `
                        <div style="margin-top: 30px; border-top: 1px dashed #dcd3be; padding-top: 20px;">
                            <h3 style="color: #6d1c0c; border-left: 4px solid #6d1c0c; padding-left: 10px; font-family: 'Times New Roman', serif; font-size: 1.35rem; margin-bottom: 12px;">
                                📅 Eventos y Algaradas Medievales Recomendadas:
                            </h3>
                            ${eventosDestacados.map(ev => `
                                <div style="margin-bottom: 15px; border-bottom: 1px dotted #e8dfcc; padding-bottom: 12px;">
                                    <span style="background-color: #d4a373; color: #2c1a04; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
                                        ${ev.type || 'Evento'}
                                    </span>
                                    <h4 style="margin: 6px 0 3px 0; color: #4e3518; font-size: 1.05rem;">⚔️ ${ev.title}</h4>
                                    <p style="margin: 0 0 3px 0; font-size: 0.9rem; font-weight: bold; color: #8c2512;">📅 Fecha: ${ev.date}</p>
                                    <p style="margin: 0 0 5px 0; font-size: 0.9rem; color: #7a5c3c;">📍 Lugar: ${ev.location || 'Cantabria'}</p>
                                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.3; color: #4e3518; font-style: italic;">
                                        ${ev.desc || ev.description || 'Algarada imperdible.'}
                                    </p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <!-- Pie del Correo / Botón de Acción -->
                    <div style="text-align: center; margin: 35px 0 20px 0;">
                        <a href="http://localhost:${port}" style="background-color: #8c2512; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; box-shadow: 0 4px 8px rgba(140,37,18,0.25); display: inline-block;">
                            🛡️ Entrar a la App Cantabria Románica 🗺️
                        </a>
                    </div>

                    <div style="border-top: 2px double #5a3c1c; padding-top: 15px; margin-top: 25px; text-align: center; font-size: 0.8rem; color: #7a5c3c; font-style: italic;">
                        Pergamino enviado con amor medieval por las palomas del Gremio del Románico. Si deseas cancelar tu suscripción, envía tu queja formal por cuervo al obispado.
                    </div>
                </div>
            `;

            const mailOptions = {
                from: '"Gremio Románico en Cantabria" <no-reply@cantabriaromanica.org>',
                to: user.email,
                subject: '📜 ¡Pergamino Mensual de Noticias y Agenda del Románico! 🛡️',
                html: emailHtml
            };

            const info = await transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`📧 Boletín mensual enviado a ${user.email}. Previsualización web: ${previewUrl}`);
            }
        }

        // --- 7. ACTUALIZAR HISTÓRICO DE NOTICIAS ENVIADAS ---
        const nuevasUrls = noticiasSeleccionadas.map(n => n.link);
        const nuevoHistorico = [...new Set([...historicoEnviadas, ...nuevasUrls])];
        writeJsonFile(sentNewsFile, nuevoHistorico);

        console.log(`AGENTE: Boletín mensual enviado con éxito. Agregadas ${nuevasUrls.length} noticias al histórico.`);
        return { success: true, count: suscriptores.length, newsCount: noticiasSeleccionadas.length };

    } catch (err) {
        console.error("AGENTE: Error crítico al ejecutar el Agente de Noticias:", err);
        throw err;
    }
}

module.exports = {
    ejecutarAgenteNoticias
};
