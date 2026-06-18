-- =========================================================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS EN SUPABASE - CANTABRIA ROMÁNICA
-- =========================================================================
-- Ejecuta este script en el apartado "SQL Editor" de la consola de tu proyecto de Supabase.
-- =========================================================================

-- 1. Crear tabla de perfiles públicos de viajeros
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    country TEXT,
    city TEXT,
    province TEXT,
    visited TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar la seguridad a nivel de filas (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso RLS
-- Permitir lectura pública a cualquier usuario (para contadores y ranking)
CREATE POLICY "Permitir lectura pública de perfiles" 
ON public.profiles FOR SELECT 
USING (true);

-- Permitir inserción al propio usuario que se está registrando
CREATE POLICY "Permitir inserción al propio usuario" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Permitir actualización al propio usuario de sus propios datos
CREATE POLICY "Permitir actualización al propio usuario" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 4. Función de trigger para copiar metadatos tras la verificación de email
-- Esta función se ejecuta automáticamente cuando un usuario se registra o confirma su email en auth.users.
-- Solo inserta el perfil público si el email ha sido verificado (email_confirmed_at no es nulo)
-- y si el perfil no existe ya en la base de datos.
CREATE OR REPLACE FUNCTION public.handle_user_verification_or_creation()
RETURNS TRIGGER AS $$
BEGIN
    IF new.email_confirmed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
        INSERT INTO public.profiles (id, email, full_name, country, city, province, visited)
        VALUES (
            new.id,
            new.email,
            COALESCE(new.raw_user_meta_data->>'full_name', ''),
            COALESCE(new.raw_user_meta_data->>'country', ''),
            COALESCE(new.raw_user_meta_data->>'city', ''),
            COALESCE(new.raw_user_meta_data->>'province', ''),
            '{}'::TEXT[]
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear el trigger en auth.users
-- Cada vez que se crea o actualiza un usuario en la autenticación de Supabase, se evalúa si debe agregarse a perfiles.
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_verification_or_creation();
