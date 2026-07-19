/**
 * CONFIGURACIÓN DE SUPABASE - CANTABRIA ROMÁNICA
 * 
 * Reemplaza las siguientes constantes con los valores de tu proyecto de Supabase.
 * Puedes obtenerlos en Settings > API en tu panel de control de Supabase.
 */

window.supabaseUrl = "https://dqbmaxdkblgqphjxzfvt.supabase.co";
window.supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxYm1heGRrYmxncXBoanh6ZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODMyMTYsImV4cCI6MjA5MzY1OTIxNn0.N4u8ji4TJtpiMl_6H0WP-hKrsugurMWKd7WLTnyl5dA";

// Función auxiliar para comprobar si la configuración se ha inicializado correctamente
window.checkSupabaseConfig = function() {
    if (!window.supabaseUrl || window.supabaseUrl.includes("TU_SUPABASE_URL") ||
        !window.supabaseAnonKey || window.supabaseAnonKey.includes("TU_SUPABASE_ANON_KEY")) {
        console.warn("Supabase no está configurado. Por favor, edita 'supabase_config.js' con las credenciales de tu proyecto.");
        return false;
    }
    return true;
};
