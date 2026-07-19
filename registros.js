/**
 * =========================================================================
 * LÓGICA DE NEGOCIO Y CONEXIÓN CON SUPABASE (registros.js)
 * =========================================================================
 * Desarrollado con Javascript modular para gestionar la autenticación de usuarios
 * y las operaciones CRUD sobre la tabla 'registros' mediante el SDK oficial.
 * =========================================================================
 */

// Instancia del cliente de Supabase (se inicializa una vez que el DOM y el SDK estén listos)
let supabaseClient = null;
let currentSession = null;
let registrosCache = []; // Caché local para búsquedas y filtrados rápidos en el frontend

// Ejecutar al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
    inicializarFechas();
    inicializarApp();
});

/**
 * Inicializa el cliente Supabase y configura los escuchas de eventos.
 */
function inicializarApp() {
    // 1. Verificar si el SDK de Supabase se ha cargado correctamente
    if (typeof supabase === 'undefined') {
        showToast('Error de Carga', 'No se pudo cargar el SDK de Supabase. Revisa tu conexión de red.', 'error');
        setLoadingState(false);
        return;
    }

    // 2. Verificar la configuración del workspace
    if (!window.checkSupabaseConfig || !window.checkSupabaseConfig()) {
        showToast(
            'Configuración Requerida', 
            'Por favor, configura las variables en el archivo "supabase_config.js" para conectar la aplicación.', 
            'warning'
        );
        mostrarAlertaConfiguracion();
        return;
    }

    try {
        // 3. Crear el cliente oficial de Supabase
        supabaseClient = supabase.createClient(window.supabaseUrl, window.supabaseAnonKey);
        
        // 4. Configurar el escuchador de estado de autenticación (Auth State Change)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(`Supabase Auth Event: ${event}`);
            currentSession = session;
            
            if (session) {
                // Usuario autenticado exitosamente
                manejarUsuarioAutenticado(session);
            } else {
                // Sin sesión activa
                manejarUsuarioNoAutenticado();
            }
        });

        // 5. Configurar escuchadores de formularios e interfaz
        configurarEventosUI();

    } catch (error) {
        console.error('Error al inicializar Supabase:', error);
        showToast('Error Crítico', 'Ocurrió un error inesperado al iniciar la aplicación: ' + error.message, 'error');
    }
}

/**
 * Inicializa los campos de fecha de los formularios al día actual
 */
function inicializarFechas() {
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('reg-fecha');
    if (fechaInput) {
        fechaInput.value = today;
        fechaInput.max = today; // Evitar registros en el futuro
    }
}

/**
 * Configura los escuchas de los elementos interactivos del DOM.
 */
function configurarEventosUI() {
    // Formularios de Auth
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Botón de alternar entre Login y Registro
    const btnSwitchAuth = document.getElementById('btn-switch-auth');
    btnSwitchAuth.addEventListener('click', toggleAuthView);
    
    // Botón de Cerrar Sesión
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    
    // Formulario de Registros
    document.getElementById('registro-form').addEventListener('submit', handleSaveRecord);
    document.getElementById('btn-cancel-edit').addEventListener('click', cancelarEdicion);
    
    // Filtros y búsquedas en tiempo real
    document.getElementById('table-search').addEventListener('input', aplicarFiltrosYBusqueda);
    document.getElementById('table-filter-tipo').addEventListener('change', aplicarFiltrosYBusqueda);
}

/**
 * Muestra un aviso en la pantalla si Supabase no está configurado.
 */
function mostrarAlertaConfiguracion() {
    const authContainer = document.getElementById('auth-container');
    authContainer.innerHTML = `
        <div class="auth-card" style="max-width: 550px; text-align: center;">
            <div class="brand-logo" style="justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="logo-icon" style="color: var(--color-warning);">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>Configuración Pendiente</span>
            </div>
            <h1 style="font-size: 1.5rem; margin-bottom: 12px;">Se requieren credenciales de Supabase</h1>
            <p style="color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">
                Para que esta aplicación funcione, debes editar el archivo <code style="background-color: var(--color-bg-base); padding: 2px 6px; border-radius: 4px; color: var(--color-primary);">supabase_config.js</code> y añadir la URL y la Anon Key de tu proyecto de Supabase.
            </p>
            <div style="background-color: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); padding: 16px; border-radius: var(--border-radius-sm); text-align: left; font-size: 0.85rem; color: var(--color-warning);">
                <strong>Ruta del archivo:</strong> /supabase_config.js<br><br>
                1. Ve a la consola de Supabase.<br>
                2. Navega a Project Settings > API.<br>
                3. Copia la URL del proyecto y la anon/public key.<br>
                4. Reemplaza los placeholders en el archivo JS.
            </div>
        </div>
    `;
}

/* =========================================================================
   GESTIÓN DE AUTENTICACIÓN (LOGIN / REGISTRO / CERRAR SESIÓN)
   ========================================================================= */

/**
 * Alterna visualmente entre el formulario de Login y el de Registro.
 */
function toggleAuthView() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const btnSwitchAuth = document.getElementById('btn-switch-auth');
    const authSwitchText = document.getElementById('auth-switch-text');
    
    cancelarEdicion(); // Limpiar formularios del dashboard por si acaso

    if (loginForm.style.display === 'none') {
        // Cambiar a vista de Login
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authTitle.textContent = 'Bienvenido de nuevo';
        authSubtitle.textContent = 'Ingresa tus credenciales para acceder a tu panel.';
        authSwitchText.textContent = '¿No tienes cuenta?';
        btnSwitchAuth.textContent = 'Regístrate';
    } else {
        // Cambiar a vista de Registro
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authTitle.textContent = 'Crear nueva cuenta';
        authSubtitle.textContent = 'Regístrate para comenzar a administrar tus registros.';
        authSwitchText.textContent = '¿Ya tienes una cuenta?';
        btnSwitchAuth.textContent = 'Inicia Sesión';
    }
}

/**
 * Procesa el inicio de sesión del usuario.
 */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!email || !password) {
        showToast('Campos vacíos', 'Por favor, rellena todos los campos.', 'warning');
        return;
    }
    
    toggleButtonLoading(submitBtn, true);
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    toggleButtonLoading(submitBtn, false);
    
    if (error) {
        showToast('Error de Acceso', traducirErrorAuth(error), 'error');
    } else {
        showToast('Acceso Exitoso', 'Sesión iniciada correctamente.', 'success');
        document.getElementById('login-form').reset();
    }
}

/**
 * Procesa el registro de un nuevo usuario en el sistema.
 */
async function handleRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('register-name').value.trim();
    const apellidos = document.getElementById('register-lastname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!nombre || !email || !password || !confirmPassword) {
        showToast('Campos vacíos', 'Por favor, rellena todos los campos obligatorios.', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showToast('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.', 'warning');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Contraseñas no coinciden', 'Las contraseñas ingresadas no coinciden.', 'warning');
        return;
    }
    
    toggleButtonLoading(submitBtn, true);
    
    // Registrar el usuario en Supabase Auth y pasar datos adicionales en metadatos
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                nombre: nombre,
                apellidos: apellidos,
                full_name: `${nombre} ${apellidos}`.trim()
            }
        }
    });
    
    toggleButtonLoading(submitBtn, false);
    
    if (error) {
        showToast('Error de Registro', traducirErrorAuth(error), 'error');
    } else {
        // Validar si requiere confirmación de email o si inició sesión directamente
        const session = data?.session;
        if (!session) {
            showToast(
                'Registro Exitoso', 
                'Cuenta creada. Por favor, verifica tu correo electrónico para confirmar el acceso.', 
                'info'
            );
            toggleAuthView(); // Cambia a login
        } else {
            showToast('Cuenta Creada', 'Registro completado e inicio de sesión automático.', 'success');
        }
        document.getElementById('register-form').reset();
    }
}

/**
 * Cierra la sesión activa en el sistema.
 */
async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showToast('Error al Salir', error.message, 'error');
    } else {
        showToast('Sesión Cerrada', 'Has cerrado sesión correctamente.', 'success');
    }
}

/**
 * Se ejecuta cuando existe una sesión activa. Ajusta la vista al Dashboard y carga los registros.
 */
async function manejarUsuarioAutenticado(session) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'flex';
    
    // Obtener los metadatos del usuario para mostrar su nombre
    const metadata = session.user.user_metadata;
    const nombreUsuario = metadata?.nombre || metadata?.full_name || session.user.email.split('@')[0];
    document.getElementById('user-display-name').textContent = nombreUsuario;
    
    // Cargar los registros desde la base de datos
    await cargarRegistros();
}

/**
 * Se ejecuta cuando no hay sesión. Ajusta la vista al panel de Autenticación.
 */
function manejarUsuarioNoAutenticado() {
    document.getElementById('dashboard-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('user-display-name').textContent = 'Usuario';
    
    // Vaciar caché y tabla
    registrosCache = [];
    actualizarTabla([]);
}

/* =========================================================================
   OPERACIONES CRUD (CREAR, LEER, ACTUALIZAR, ELIMINAR REGISTROS)
   ========================================================================= */

/**
 * Obtiene todos los registros del usuario autenticado desde Supabase.
 */
async function cargarRegistros() {
    if (!supabaseClient || !currentSession) return;
    
    mostrarCargaTabla(true);
    
    // Realizamos la consulta ordenando por fecha de forma descendente
    const { data, error } = await supabaseClient
        .from('registros')
        .select('*')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false });
        
    mostrarCargaTabla(false);
    
    if (error) {
        console.error('Error al cargar registros:', error);
        showToast('Error al Cargar', 'No se pudieron descargar tus registros: ' + error.message, 'error');
        actualizarTabla([]);
    } else {
        registrosCache = data || [];
        aplicarFiltrosYBusqueda(); // Renderizar y aplicar filtros que estén seleccionados
    }
}

/**
 * Inserta un registro nuevo o actualiza uno existente en Supabase.
 */
async function handleSaveRecord(e) {
    e.preventDefault();
    
    if (!supabaseClient || !currentSession) {
        showToast('Sesión inválida', 'Debes estar autenticado para realizar esta acción.', 'error');
        return;
    }
    
    const recordId = document.getElementById('registro-id').value;
    const fecha = document.getElementById('reg-fecha').value;
    const tipo = document.getElementById('reg-tipo').value;
    const descripcion = document.getElementById('reg-descripcion').value.trim();
    const saveBtn = document.getElementById('btn-save-record');
    
    if (!fecha || !tipo || !descripcion) {
        showToast('Campos vacíos', 'Por favor, rellena todos los campos requeridos.', 'warning');
        return;
    }
    
    toggleButtonLoading(saveBtn, true);
    
    const userId = currentSession.user.id;
    
    let result = null;
    const isEdit = !!recordId;
    
    if (isEdit) {
        // Modo Edición: Actualizar registro existente
        result = await supabaseClient
            .from('registros')
            .update({
                fecha: fecha,
                tipo_registro: tipo,
                descripcion: descripcion
            })
            .eq('id', recordId)
            .eq('user_id', userId) // Seguridad adicional
            .select();
    } else {
        // Modo Creación: Insertar nuevo registro
        result = await supabaseClient
            .from('registros')
            .insert([{
                user_id: userId,
                fecha: fecha,
                tipo_registro: tipo,
                descripcion: descripcion
            }])
            .select();
    }
    
    toggleButtonLoading(saveBtn, false);
    
    const { data, error } = result;
    
    if (error) {
        console.error('Error al guardar registro:', error);
        showToast('Error al Guardar', 'No se pudo guardar la información: ' + error.message, 'error');
    } else {
        showToast(
            isEdit ? 'Registro Actualizado' : 'Registro Creado', 
            isEdit ? 'El registro se actualizó correctamente.' : 'El nuevo registro se añadió a la base de datos.', 
            'success'
        );
        
        // Limpiar formulario y restablecer a modo inserción
        cancelarEdicion();
        
        // Recargar datos
        await cargarRegistros();
    }
}

/**
 * Elimina un registro de la base de datos de Supabase.
 */
async function eliminarRegistro(id) {
    if (!supabaseClient || !currentSession) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar este registro permanentemente?')) {
        return;
    }
    
    const userId = currentSession.user.id;
    
    const { error } = await supabaseClient
        .from('registros')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Seguridad RLS reforzada
        
    if (error) {
        console.error('Error al eliminar registro:', error);
        showToast('Error de Eliminación', 'No se pudo borrar el registro: ' + error.message, 'error');
    } else {
        showToast('Registro Eliminado', 'El registro se ha borrado de tu cuenta.', 'success');
        
        // Si estábamos editando el registro que borramos, cancelamos la edición
        const editingId = document.getElementById('registro-id').value;
        if (editingId === id) {
            cancelarEdicion();
        }
        
        await cargarRegistros();
    }
}

/**
 * Carga un registro específico en el formulario para poder editarlo.
 */
function iniciarEdicion(id) {
    const registro = registrosCache.find(r => r.id === id);
    if (!registro) return;
    
    // Rellenar formulario
    document.getElementById('registro-id').value = registro.id;
    document.getElementById('reg-fecha').value = registro.fecha;
    document.getElementById('reg-tipo').value = registro.tipo_registro;
    document.getElementById('reg-descripcion').value = registro.descripcion;
    
    // Cambiar estilos del panel del formulario a "Modo Edición"
    document.getElementById('form-title').textContent = 'Editar Registro';
    document.getElementById('btn-save-text').textContent = 'Guardar Cambios';
    document.getElementById('btn-cancel-edit').style.display = 'block';
    
    // Ajustar el icono del botón a modo guardar/check
    const saveBtn = document.getElementById('btn-save-record');
    saveBtn.querySelector('svg').innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    `;
    
    // Hacer scroll suave al panel del formulario en móviles
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Cancela la edición actual y restablece el formulario a su modo inicial (nuevo registro).
 */
function cancelarEdicion() {
    document.getElementById('registro-id').value = '';
    document.getElementById('registro-form').reset();
    inicializarFechas();
    
    // Restablecer estilos del panel a "Nuevo Registro"
    document.getElementById('form-title').textContent = 'Nuevo Registro';
    document.getElementById('btn-save-text').textContent = 'Agregar Registro';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    
    // Ajustar el icono del botón de nuevo a agregar/plus
    const saveBtn = document.getElementById('btn-save-record');
    saveBtn.querySelector('svg').innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `;
}

/* =========================================================================
   FILTRADO, RENDERIZADO Y BUSQUEDA DINÁMICA
   ========================================================================= */

/**
 * Filtra los registros según el tipo y el buscador de texto en tiempo real.
 */
function aplicarFiltrosYBusqueda() {
    const searchText = document.getElementById('table-search').value.toLowerCase().trim();
    const filterTipo = document.getElementById('table-filter-tipo').value;
    
    let registrosFiltrados = [...registrosCache];
    
    // 1. Aplicar filtro por tipo
    if (filterTipo !== 'Todos') {
        registrosFiltrados = registrosFiltrados.filter(r => r.tipo_registro === filterTipo);
    }
    
    // 2. Aplicar filtro por búsqueda (descripción)
    if (searchText !== '') {
        registrosFiltrados = registrosFiltrados.filter(r => 
            r.descripcion.toLowerCase().includes(searchText)
        );
    }
    
    // Actualizar tabla y contadores con el set filtrado
    actualizarTabla(registrosFiltrados);
}

/**
 * Renderiza los registros en el cuerpo de la tabla HTML.
 */
function actualizarTabla(registros) {
    const tableBody = document.getElementById('tabla-registros-body');
    const emptyState = document.getElementById('empty-state');
    const recordsCounter = document.getElementById('records-counter');
    
    // Actualizar contador del dashboard
    recordsCounter.textContent = registrosCache.length;
    
    // Vaciar tabla anterior
    tableBody.innerHTML = '';
    
    if (registros.length === 0) {
        document.getElementById('tabla-registros').style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    // Mostrar la tabla y ocultar estado vacío
    document.getElementById('tabla-registros').style.display = 'table';
    emptyState.style.display = 'none';
    
    // Inyectar filas
    registros.forEach(r => {
        const row = document.createElement('tr');
        
        // Formatear fechas
        const fechaFormateada = formatearFecha(r.fecha);
        const creadoFormateado = formatearTimestamp(r.creado_en);
        
        // Determinar badge CSS de tipo
        const tipoClase = `badge-${r.tipo_registro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
        
        row.innerHTML = `
            <td class="date-col">${fechaFormateada}</td>
            <td>
                <span class="badge-tipo ${tipoClase}">${r.tipo_registro}</span>
            </td>
            <td class="desc-col">${escaparHTML(r.descripcion)}</td>
            <td class="created-col">${creadoFormateado}</td>
            <td class="actions-col text-right">
                <button class="btn btn-edit" onclick="iniciarEdicion('${r.id}')" title="Editar Registro">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </button>
                <button class="btn btn-danger" onclick="eliminarRegistro('${r.id}')" title="Eliminar Registro">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

/* =========================================================================
   UTILIDADES (FORMATOS, TOASTS Y TRADUCTOR)
   ========================================================================= */

/**
 * Traduce y simplifica los errores de Firebase/Supabase Auth comunes para el usuario final.
 */
function traducirErrorAuth(error) {
    if (!error) return 'Ocurrió un error desconocido.';
    const msg = error.message.toLowerCase();
    
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return 'El correo electrónico o la contraseña son incorrectos.';
    }
    if (msg.includes('user already exists') || msg.includes('email already registered')) {
        return 'Ya existe una cuenta registrada con este correo electrónico.';
    }
    if (msg.includes('password should be at least')) {
        return 'La contraseña debe tener un tamaño mínimo de 6 caracteres.';
    }
    if (msg.includes('email address is invalid') || msg.includes('unable to validate email')) {
        return 'Por favor, introduce un correo electrónico válido.';
    }
    
    return error.message; // Mensaje original como respaldo
}

/**
 * Controla el spinner y desactiva/activa botones durante procesos asíncronos.
 */
function toggleButtonLoading(button, isLoading) {
    if (!button) return;
    const spinner = button.querySelector('.spinner');
    const textNode = button.querySelector('span');
    const svgIcon = button.querySelector('svg');
    
    button.disabled = isLoading;
    
    if (isLoading) {
        if (spinner) spinner.style.display = 'block';
        if (textNode) textNode.style.opacity = '0.5';
        if (svgIcon) svgIcon.style.opacity = '0.5';
    } else {
        if (spinner) spinner.style.display = 'none';
        if (textNode) textNode.style.opacity = '1';
        if (svgIcon) svgIcon.style.opacity = '1';
    }
}

/**
 * Muestra u oculta el spinner de carga de la tabla de registros.
 */
function mostrarCargaTabla(mostrar) {
    const loader = document.getElementById('table-loading');
    const table = document.getElementById('tabla-registros');
    const emptyState = document.getElementById('empty-state');
    
    if (mostrar) {
        loader.style.display = 'flex';
        table.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loader.style.display = 'none';
    }
}

/**
 * Formatea una fecha YYYY-MM-DD a un formato local legible (DD/MM/YYYY).
 */
function formatearFecha(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {
        return dateStr;
    }
}

/**
 * Formatea un timestamp ISO con zona horaria a un formato legible corto.
 */
function formatearTimestamp(timestampStr) {
    if (!timestampStr) return '';
    try {
        const date = new Date(timestampStr);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const año = date.getFullYear();
        const horas = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${año} ${horas}:${minutos}`;
    } catch {
        return timestampStr;
    }
}

/**
 * Escapa caracteres HTML especiales para evitar ataques XSS por inputs de usuario.
 */
function escaparHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Crea e inserta una notificación flotante (Toast) en el DOM.
 */
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    // Crear el elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icono correspondiente según el tipo
    let svgIcon = '';
    if (type === 'success') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
    } else if (type === 'error') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
    } else if (type === 'warning') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
    } else { // info
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 1 1 1.083.942L12 13.5m-2.25-2.25h1.5L12 13.5m-2.25-2.25h1.5m4.72-4.72a.75.75 0 1 1-1.06 1.06L12 9.31l-2.91 2.91a.75.75 0 1 1-1.06-1.06l2.91-2.91-2.91-2.91a.75.75 0 1 1 1.06-1.06l2.91 2.91 2.91-2.91Z" /></svg>`;
    }
    
    toast.innerHTML = `
        ${svgIcon}
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Función para eliminar el toast con animación
    const dismissToast = () => {
        if (toast.classList.contains('toast-closing')) return;
        toast.classList.add('toast-closing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    };
    
    // Escuchar botón cerrar
    toast.querySelector('.toast-close-btn').addEventListener('click', dismissToast);
    
    // Auto descartar después de 4 segundos
    setTimeout(dismissToast, 4000);
}
