-- =========================================================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS PARA EL SISTEMA DE REGISTROS
-- =========================================================================
-- Instrucciones: Ejecuta este script en el apartado "SQL Editor" de tu 
-- consola de Supabase para configurar la base de datos correctamente.
-- =========================================================================

-- 1. Habilitar la extensión para generación de UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crear tabla pública de usuarios (vinculada con auth.users de Supabase)
-- Almacena los perfiles de los usuarios de forma segura y accesible para el frontend.
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellidos TEXT,
    email TEXT UNIQUE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.usuarios IS 'Tabla de perfiles públicos de usuario vinculados al sistema de autenticación de Supabase.';

-- 3. Crear tabla pública de registros
-- Almacena los registros que los usuarios crean, editan y eliminan.
CREATE TABLE IF NOT EXISTS public.registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_registro TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Validaciones básicas para garantizar consistencia
    CONSTRAINT check_tipo_registro_not_empty CHECK (char_length(trim(tipo_registro)) > 0),
    CONSTRAINT check_descripcion_not_empty CHECK (char_length(trim(descripcion)) > 0)
);

COMMENT ON TABLE public.registros IS 'Tabla que almacena los registros de actividad/eventos creados por los usuarios.';

-- 4. Crear índices para optimizar las consultas y búsquedas
CREATE INDEX IF NOT EXISTS idx_registros_user_id ON public.registros(user_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON public.registros(fecha);

-- 5. Habilitar la seguridad a nivel de filas (Row Level Security - RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

-- 6. Definir Políticas de Seguridad RLS para la tabla 'usuarios'
-- Los usuarios autenticados solo pueden ver su propio perfil
CREATE POLICY "Permitir lectura de perfil propio" 
ON public.usuarios FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Los usuarios autenticados solo pueden actualizar su propio perfil
CREATE POLICY "Permitir actualización de perfil propio" 
ON public.usuarios FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 7. Definir Políticas de Seguridad RLS para la tabla 'registros'
-- Los usuarios autenticados solo pueden ver sus propios registros
CREATE POLICY "Permitir lectura de registros propios" 
ON public.registros FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Los usuarios autenticados solo pueden insertar sus propios registros
CREATE POLICY "Permitir inserción de registros propios" 
ON public.registros FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Los usuarios autenticados solo pueden actualizar sus propios registros
CREATE POLICY "Permitir actualización de registros propios" 
ON public.registros FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Los usuarios autenticados solo pueden eliminar sus propios registros
CREATE POLICY "Permitir eliminación de registros propios" 
ON public.registros FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 8. Trigger para sincronizar automáticamente el registro de auth.users con public.usuarios
-- Esta función de base de datos se ejecuta en el espacio de nombres del sistema (SECURITY DEFINER)
-- y copia los metadatos y el email a la tabla pública 'usuarios' al crearse un usuario en la autenticación.
CREATE OR REPLACE FUNCTION public.handle_new_user_sync()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nombre, apellidos, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', 'Usuario'),
        COALESCE(new.raw_user_meta_data->>'apellidos', ''),
        new.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enlazar el trigger a la tabla auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_sync();
