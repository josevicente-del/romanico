/**
 * CONFIGURACIÓN DE SUPABASE - CANTABRIA ROMÁNICA
 * 
 * Reemplaza las siguientes constantes con los valores de tu proyecto de Supabase.
 * Puedes obtenerlos en Settings > API en tu panel de control de Supabase.
 */

window.supabaseUrl = "TU_SUPABASE_URL_AQUI"; // Ejemplo: "https://xyzabc.supabase.co"
window.supabaseAnonKey = "TU_SUPABASE_ANON_KEY_AQUI"; // Ejemplo: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Función auxiliar para comprobar si la configuración se ha inicializado correctamente
window.checkSupabaseConfig = function() {
    if (!window.supabaseUrl || window.supabaseUrl.includes("TU_SUPABASE_URL") ||
        !window.supabaseAnonKey || window.supabaseAnonKey.includes("TU_SUPABASE_ANON_KEY")) {
        console.warn("Supabase no está configurado. Por favor, edita 'supabase_config.js' con las credenciales de tu proyecto.");
        return false;
    }
    return true;
};
