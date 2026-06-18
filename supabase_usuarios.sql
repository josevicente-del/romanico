-- =========================================================================
-- SCRIPT DE CREACIÓN DE LA TABLA DE USUARIOS EN SUPABASE
-- =========================================================================
-- Ejecuta este script en el apartado "SQL Editor" de la consola de tu proyecto de Supabase.
-- Este script crea la tabla 'usuarios' con validaciones, índices, seguridad RLS
-- y un trigger para la actualización automática de fechas.
-- =========================================================================

-- 1. Asegurar la disponibilidad de la extensión pgcrypto para generación de UUIDs si es necesario
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    -- Identificación
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    
    -- Contacto
    email TEXT NOT NULL UNIQUE,
    telefono TEXT,
    
    -- Credenciales de acceso
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    
    -- Información demográfica
    fecha_nacimiento DATE NOT NULL,
    pais TEXT,
    ciudad TEXT,
    
    -- Metadatos automáticos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Validaciones CHECK a nivel de tabla
    -- Validación de formato de email (Regex estándar de email)
    CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    
    -- El username solo puede contener letras, números y guiones bajos (_)
    CONSTRAINT check_username_format CHECK (username ~ '^[A-Za-z0-9_]+$'),
    
    -- La fecha de nacimiento no puede ser una fecha futura
    CONSTRAINT check_fecha_nacimiento_past CHECK (fecha_nacimiento <= CURRENT_DATE),
    
    -- El teléfono, si se proporciona, debe tener entre 7 y 15 caracteres
    CONSTRAINT check_telefono_length CHECK (telefono IS NULL OR (length(telefono) >= 7 AND length(telefono) <= 15))
);

-- Comentario explicativo de la tabla
COMMENT ON TABLE public.usuarios IS 'Tabla que almacena la información de registro y credenciales de los usuarios de la plataforma.';

-- 3. Crear índices para búsquedas rápidas por email y username
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON public.usuarios(username);

-- 4. Habilitar la seguridad a nivel de filas (Row Level Security - RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS (Row Level Security)
-- Permitir al usuario ver únicamente su propio perfil (comparando el auth.uid() de Supabase con el id)
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON public.usuarios FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Permitir al usuario actualizar únicamente su propio perfil
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
ON public.usuarios FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Permitir a cualquier usuario anónimo o autenticado registrarse (inserción)
-- Al insertar, si se usa Supabase Auth, se puede validar que auth.uid() = id
CREATE POLICY "Permitir inserción de nuevo perfil" 
ON public.usuarios FOR INSERT 
WITH CHECK (true);

-- 6. Trigger para actualizar automáticamente el campo updated_at
-- Creamos la función de trigger si no existe
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignar el trigger a la tabla usuarios
DROP TRIGGER IF EXISTS on_usuarios_update ON public.usuarios;
CREATE TRIGGER on_usuarios_update
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- EJEMPLO DE INSERCIÓN DE PRUEBA (INSERT)
-- =========================================================================
-- INSERT INTO public.usuarios (
--     nombre, 
--     apellidos, 
--     email, 
--     telefono, 
--     username, 
--     password_hash, 
--     fecha_nacimiento, 
--     pais, 
--     ciudad
-- ) VALUES (
--     'Juan', 
--     'Pérez García', 
--     'juan.perez@example.com', 
--     '+34600123456', 
--     'juan_perez99', 
--     -- Contraseña encriptada de ejemplo (simulada, en producción generada con bcrypt/pgcrypto en backend)
--     '$2b$12$LRYuH76V7p6V7p6V7p6V7eO3hXwM1vVzY4v.XlX4g9vX8v8v8v8v8', 
--     '1990-05-15', 
--     'España', 
--     'Santander'
-- );
-- =========================================================================
