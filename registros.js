/**
 * =========================================================================
 * LÓGICA DE NEGOCIO Y CONEXIÓN CON SUPABASE / FALLBACK LOCAL (registros.js)
 * =========================================================================
 * Gestiona la autenticación de usuarios y las operaciones CRUD sobre registros.
 * Incorpora un modo de contingencia inteligente (Fallback en LocalStorage)
 * que entra en acción si Supabase Auth tiene proveedores desactivados en la nube.
 * =========================================================================
 */

// Instancia del cliente de Supabase y estado de la sesión
let supabaseClient = null;
let currentSession = null;
let registrosCache = []; // Caché en memoria para búsquedas/filtros en el cliente

// Banderas de estado
let modoContingenciaLocal = false; // Se activa automáticamente ante fallas de proveedor en Supabase Auth

// Ejecutar al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
    inicializarFechas();
    inicializarApp();
});

/**
 * Inicializa el cliente Supabase y configura los escuchas de eventos.
 */
function inicializarApp() {
    // 1. Cargar sesión local previa de contingencia si existe en el navegador
    const localSession = localStorage.getItem('local_auth_user');
    if (localSession) {
        console.log("Detectada sesión local previa de contingencia.");
        modoContingenciaLocal = true;
        currentSession = JSON.parse(localSession);
        manejarUsuarioAutenticado(currentSession);
        configurarEventosUI();
        return;
    }

    // 2. Verificar si el SDK de Supabase está cargado
    if (typeof supabase === 'undefined') {
        showToast('Error de Carga', 'No se pudo cargar el SDK de Supabase. Conmutando a modo local.', 'warning');
        activarModoLocalImprevisto();
        configurarEventosUI();
        return;
    }

    // 3. Verificar configuración del archivo de credenciales
    if (!window.checkSupabaseConfig || !window.checkSupabaseConfig()) {
        // Si no está configurado, mostramos la guía informativa para configurarlo
        mostrarAlertaConfiguracion();
        return;
    }

    try {
        // 4. Crear cliente oficial de Supabase
        supabaseClient = supabase.createClient(window.supabaseUrl, window.supabaseAnonKey);
        
        // 5. Escuchar cambios de estado de autenticación en Supabase
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log(`Supabase Auth Event: ${event}`);
            
            // Si estamos en modo de contingencia local, ignoramos cambios de Supabase
            if (modoContingenciaLocal) return;
            
            currentSession = session;
            if (session) {
                manejarUsuarioAutenticado(session);
            } else {
                manejarUsuarioNoAutenticado();
            }
        });

        // 6. Configurar eventos de UI
        configurarEventosUI();

    } catch (error) {
        console.error('Error al inicializar Supabase:', error);
        showToast('Error de Conexión', 'Fallo al iniciar Supabase. Activando modo demostración local.', 'warning');
        activarModoLocalImprevisto();
        configurarEventosUI();
    }
}

/**
 * Activa de forma preventiva el modo local en caso de caídas o falta de SDK.
 */
function activarModoLocalImprevisto() {
    modoContingenciaLocal = true;
    manejarUsuarioNoAutenticado();
}

/**
 * Inicializa los campos de fecha de los formularios al día actual
 */
function inicializarFechas() {
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('reg-fecha');
    if (fechaInput) {
        fechaInput.value = today;
        fechaInput.max = today; // Evitar registros futuros
    }
}

/**
 * Configura los escuchas de los elementos interactivos del DOM.
 */
function configurarEventosUI() {
    // Formularios de Auth (remover anteriores si existieran para evitar duplicación de triggers)
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const registroForm = document.getElementById('registro-form');
    
    if (loginForm) {
        loginForm.replaceWith(loginForm.cloneNode(true));
        document.getElementById('login-form').addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.replaceWith(registerForm.cloneNode(true));
        document.getElementById('register-form').addEventListener('submit', handleRegister);
    }
    
    // Botón de alternar entre Login y Registro
    const btnSwitchAuth = document.getElementById('btn-switch-auth');
    if (btnSwitchAuth) {
        btnSwitchAuth.replaceWith(btnSwitchAuth.cloneNode(true));
        document.getElementById('btn-switch-auth').addEventListener('click', toggleAuthView);
    }
    
    // Botón de Cerrar Sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.replaceWith(btnLogout.cloneNode(true));
        document.getElementById('btn-logout').addEventListener('click', handleLogout);
    }
    
    // Formulario de Registros
    if (registroForm) {
        registroForm.replaceWith(registroForm.cloneNode(true));
        document.getElementById('registro-form').addEventListener('submit', handleSaveRecord);
    }
    
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if (btnCancelEdit) {
        btnCancelEdit.replaceWith(btnCancelEdit.cloneNode(true));
        document.getElementById('btn-cancel-edit').addEventListener('click', cancelarEdicion);
    }
    
    // Filtros y búsquedas en tiempo real
    const searchInput = document.getElementById('table-search');
    const filterSelect = document.getElementById('table-filter-tipo');
    
    if (searchInput) {
        searchInput.replaceWith(searchInput.cloneNode(true));
        document.getElementById('table-search').addEventListener('input', aplicarFiltrosYBusqueda);
    }
    if (filterSelect) {
        filterSelect.replaceWith(filterSelect.cloneNode(true));
        document.getElementById('table-filter-tipo').addEventListener('change', aplicarFiltrosYBusqueda);
    }
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
                Para conectar la aplicación a la nube, edita el archivo <code style="background-color: var(--color-bg-base); padding: 2px 6px; border-radius: 4px; color: var(--color-primary);">supabase_config.js</code> con la URL y Anon Key.
            </p>
            <div style="background-color: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); padding: 16px; border-radius: var(--border-radius-sm); text-align: left; font-size: 0.85rem; color: var(--color-warning); margin-bottom: 16px;">
                <strong>¿No tienes conexión o da error de proveedores?</strong><br>
                Puedes usar el modo autónomo del navegador presionando el botón inferior para probar el CRUD inmediatamente en local.
            </div>
            <button id="btn-force-local" class="btn btn-secondary btn-block">Probar en Modo Local</button>
        </div>
    `;
    
    document.getElementById('btn-force-local').addEventListener('click', () => {
        modoContingenciaLocal = true;
        showToast('Modo Local Forzado', 'Iniciando demostración local usando el almacenamiento de tu navegador.', 'info');
        manejarUsuarioNoAutenticado();
        configurarEventosUI();
    });
}

/* =========================================================================
   GESTIÓN DE AUTENTICACIÓN (CON FALLBACK LOCAL DE DETECCIÓN INTELIGENTE)
   ========================================================================= */

/**
 * Determina si el error provisto por Supabase Auth indica que el proveedor está desactivado
 */
function esErrorProveedorDesactivado(error) {
    if (!error) return false;
    const msg = error.message.toLowerCase();
    return msg.includes('provider is not enabled') || 
           msg.includes('validation_failed') || 
           msg.includes('unsupported provider') || 
           msg.includes('signup is disabled') ||
           msg.includes('signups are not allowed') ||
           msg.includes('provider is disabled');
}

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
    
    cancelarEdicion();

    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authTitle.textContent = 'Bienvenido de nuevo';
        authSubtitle.textContent = 'Ingresa tus credenciales para acceder a tu panel.';
        authSwitchText.textContent = '¿No tienes cuenta?';
        btnSwitchAuth.textContent = 'Regístrate';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authTitle.textContent = 'Crear nueva cuenta';
        authSubtitle.textContent = 'Regístrate para comenzar a administrar tus registros.';
        authSwitchText.textContent = '¿Ya tienes una cuenta?';
        btnSwitchAuth.textContent = 'Inicia Sesión';
    }
}

/**
 * Procesa el inicio de sesión.
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

    // 1. Si ya estamos en modo local, loguear directamente contra LocalStorage
    if (modoContingenciaLocal) {
        toggleButtonLoading(submitBtn, false);
        intentarLoginLocal(email, password);
        return;
    }
    
    // 2. Intentar loguear contra Supabase en la nube
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    toggleButtonLoading(submitBtn, false);
    
    if (error) {
        // Si detecta proveedor inhabilitado en la nube, conmutar y reintentar en local
        if (esErrorProveedorDesactivado(error)) {
            console.warn("Fallo de proveedor de Supabase. Reintentando en local...");
            intentarLoginLocal(email, password);
        } else {
            showToast('Error de Acceso', traducirErrorAuth(error), 'error');
        }
    } else {
        showToast('Acceso Exitoso', 'Sesión iniciada correctamente.', 'success');
        document.getElementById('login-form').reset();
    }
}

/**
 * Procesa el registro.
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

    // 1. Si ya estamos en modo local, registrar directamente en LocalStorage
    if (modoContingenciaLocal) {
        toggleButtonLoading(submitBtn, false);
        activarModoLocalRegistro(email, nombre, apellidos, password);
        return;
    }
    
    // 2. Intentar registrar contra Supabase Auth en la nube
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
        // Si detecta proveedor inhabilitado, conmutar y registrar local
        if (esErrorProveedorDesactivado(error)) {
            console.warn("Fallo de proveedor en Supabase Auth. Sincronizando en local...");
            activarModoLocalRegistro(email, nombre, apellidos, password);
        } else {
            showToast('Error de Registro', traducirErrorAuth(error), 'error');
        }
    } else {
        const session = data?.session;
        if (!session) {
            showToast('Registro Exitoso', 'Cuenta creada en Supabase. Confirma tu correo para ingresar.', 'info');
            toggleAuthView();
        } else {
            showToast('Cuenta Creada', 'Registro completado en la nube e inicio automático.', 'success');
        }
        document.getElementById('register-form').reset();
    }
}

/**
 * Cierra la sesión.
 */
async function handleLogout() {
    if (modoContingenciaLocal) {
        modoContingenciaLocal = false;
        currentSession = null;
        localStorage.removeItem('local_auth_user');
        showToast('Sesión Cerrada', 'Has cerrado tu sesión local correctamente.', 'success');
        manejarUsuarioNoAutenticado();
        return;
    }

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showToast('Error al Salir', error.message, 'error');
    } else {
        showToast('Sesión Cerrada', 'Has cerrado sesión correctamente.', 'success');
    }
}

/**
 * Registra y activa una sesión local (localStorage) de contingencia.
 */
function activarModoLocalRegistro(email, nombre, apellidos, password) {
    modoContingenciaLocal = true;
    
    const dummyUser = {
        id: 'local-usr-' + Date.now(),
        email: email,
        user_metadata: {
            nombre: nombre,
            apellidos: apellidos,
            full_name: `${nombre} ${apellidos}`.trim()
        }
    };
    
    // Simular guardado de base de datos local de usuarios para logins futuros
    const usuariosLocales = JSON.parse(localStorage.getItem('local_users_db') || '[]');
    if (usuariosLocales.find(u => u.email === email)) {
        showToast('Cuenta Existente', 'Este correo ya se encuentra registrado de forma local.', 'warning');
        return;
    }
    
    usuariosLocales.push({ email, nombre, apellidos, password });
    localStorage.setItem('local_users_db', JSON.stringify(usuariosLocales));
    
    // Iniciar sesión local
    const sessionMock = { user: dummyUser };
    currentSession = sessionMock;
    localStorage.setItem('local_auth_user', JSON.stringify(sessionMock));
    
    showToast(
        'Modo Local de Emergencia', 
        'Supabase Auth está desactivado en la nube. Hemos creado tu cuenta de forma local para que puedas interactuar.', 
        'warning'
    );
    
    manejarUsuarioAutenticado(sessionMock);
}

/**
 * Realiza el login en local de contingencia contra la base de datos de localStorage.
 */
function intentarLoginLocal(email, password) {
    const usuariosLocales = JSON.parse(localStorage.getItem('local_users_db') || '[]');
    const user = usuariosLocales.find(u => u.email === email);
    
    if (user && user.password === password) {
        modoContingenciaLocal = true;
        
        const dummyUser = {
            id: 'local-usr-' + email.replace(/[^a-zA-Z0-9]/g, ""),
            email: email,
            user_metadata: {
                nombre: user.nombre,
                apellidos: user.apellidos,
                full_name: `${user.nombre} ${user.apellidos}`.trim()
            }
        };
        
        const sessionMock = { user: dummyUser };
        currentSession = sessionMock;
        localStorage.setItem('local_auth_user', JSON.stringify(sessionMock));
        
        showToast('Sesión Local', 'Iniciaste sesión en modo local de contingencia.', 'info');
        manejarUsuarioAutenticado(sessionMock);
    } else if (user) {
        showToast('Contraseña incorrecta', 'La contraseña introducida no coincide en la base de datos local.', 'error');
    } else {
        // Si no existe, pero quiere probar, le invitamos a registrarse
        showToast('Usuario no encontrado', 'El proveedor de Supabase está inactivo. Regístrate en el formulario para crear una cuenta local.', 'warning');
        toggleAuthView();
    }
}

/**
 * Se ejecuta cuando existe sesión activa.
 */
async function manejarUsuarioAutenticado(session) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'flex';
    
    const metadata = session.user.user_metadata;
    const nombreUsuario = metadata?.nombre || metadata?.full_name || session.user.email.split('@')[0];
    document.getElementById('user-display-name').textContent = nombreUsuario;
    
    await cargarRegistros();
}

/**
 * Se ejecuta cuando no hay sesión.
 */
function manejarUsuarioNoAutenticado() {
    document.getElementById('dashboard-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('user-display-name').textContent = 'Usuario';
    
    // Si no estamos en modo local y se removió la sesión, limpiar la UI
    if (!modoContingenciaLocal) {
        registrosCache = [];
        actualizarTabla([]);
    }
}

/* =========================================================================
   OPERACIONES CRUD (CON BIFURCACIÓN DE CONTINGENCIA LOCAL)
   ========================================================================= */

/**
 * Obtiene todos los registros (desde Supabase o LocalStorage según modo).
 */
async function cargarRegistros() {
    if (!currentSession) return;
    
    mostrarCargaTabla(true);
    
    // --- MODO LOCAL DE CONTINGENCIA ---
    if (modoContingenciaLocal) {
        setTimeout(() => {
            const todosRegistros = JSON.parse(localStorage.getItem('local_records') || '[]');
            // Filtrar solo los registros pertenecientes al usuario local activo
            const misRegistros = todosRegistros.filter(r => r.user_id === currentSession.user.id);
            
            // Ordenar de forma descendente por fecha y creación
            registrosCache = misRegistros.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
            
            mostrarCargaTabla(false);
            aplicarFiltrosYBusqueda();
        }, 500); // 500ms de retraso simulado para ver cargando premium
        return;
    }
    
    // --- MODO SUPABASE NUBE ---
    const { data, error } = await supabaseClient
        .from('registros')
        .select('*')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false });
        
    mostrarCargaTabla(false);
    
    if (error) {
        console.error('Error al cargar registros de Supabase:', error);
        showToast('Error de Lectura', 'No se pudieron descargar los datos de la nube: ' + error.message, 'error');
        actualizarTabla([]);
    } else {
        registrosCache = data || [];
        aplicarFiltrosYBusqueda();
    }
}

/**
 * Inserta un registro nuevo o actualiza uno existente.
 */
async function handleSaveRecord(e) {
    e.preventDefault();
    
    if (!currentSession) {
        showToast('Sesión expirada', 'Debes iniciar sesión para realizar esta acción.', 'error');
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
    
    const userId = currentSession.user.id;
    const isEdit = !!recordId;
    
    toggleButtonLoading(saveBtn, true);

    // --- MODO LOCAL DE CONTINGENCIA ---
    if (modoContingenciaLocal) {
        setTimeout(async () => {
            toggleButtonLoading(saveBtn, false);
            
            const todosRegistros = JSON.parse(localStorage.getItem('local_records') || '[]');
            
            if (isEdit) {
                // Editar en localStorage
                const idx = todosRegistros.findIndex(r => r.id === recordId && r.user_id === userId);
                if (idx !== -1) {
                    todosRegistros[idx].fecha = fecha;
                    todosRegistros[idx].tipo_registro = tipo;
                    todosRegistros[idx].descripcion = descripcion;
                }
            } else {
                // Crear en localStorage
                todosRegistros.push({
                    id: 'local-rec-' + Date.now(),
                    user_id: userId,
                    fecha: fecha,
                    tipo_registro: tipo,
                    descripcion: descripcion,
                    creado_en: new Date().toISOString()
                });
            }
            
            localStorage.setItem('local_records', JSON.stringify(todosRegistros));
            
            showToast(
                isEdit ? 'Registro Modificado' : 'Registro Creado', 
                isEdit ? 'El registro local se actualizó en tu navegador.' : 'El registro se guardó localmente de forma correcta.', 
                'success'
            );
            
            cancelarEdicion();
            await cargarRegistros();
        }, 500);
        return;
    }
    
    // --- MODO SUPABASE NUBE ---
    let result = null;
    if (isEdit) {
        result = await supabaseClient
            .from('registros')
            .update({ fecha, tipo_registro: tipo, descripcion })
            .eq('id', recordId)
            .eq('user_id', userId)
            .select();
    } else {
        result = await supabaseClient
            .from('registros')
            .insert([{ user_id: userId, fecha, tipo_registro: tipo, descripcion }])
            .select();
    }
    
    toggleButtonLoading(saveBtn, false);
    const { data, error } = result;
    
    if (error) {
        console.error('Error al guardar en Supabase:', error);
        showToast('Error al Guardar', 'No se pudo subir la información: ' + error.message, 'error');
    } else {
        showToast(
            isEdit ? 'Registro Actualizado' : 'Registro Creado', 
            isEdit ? 'Los cambios se han guardado en la nube.' : 'El registro se ha sincronizado en la base de datos.', 
            'success'
        );
        cancelarEdicion();
        await cargarRegistros();
    }
}

/**
 * Elimina un registro de la base de datos.
 */
async function eliminarRegistro(id) {
    if (!currentSession) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar este registro permanentemente?')) {
        return;
    }
    
    const userId = currentSession.user.id;

    // --- MODO LOCAL DE CONTINGENCIA ---
    if (modoContingenciaLocal) {
        const todosRegistros = JSON.parse(localStorage.getItem('local_records') || '[]');
        const filtrados = todosRegistros.filter(r => !(r.id === id && r.user_id === userId));
        localStorage.setItem('local_records', JSON.stringify(filtrados));
        
        showToast('Registro Eliminado', 'El registro local se eliminó del navegador.', 'success');
        
        const editingId = document.getElementById('registro-id').value;
        if (editingId === id) {
            cancelarEdicion();
        }
        
        await cargarRegistros();
        return;
    }
    
    // --- MODO SUPABASE NUBE ---
    const { error } = await supabaseClient
        .from('registros')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
        
    if (error) {
        console.error('Error al eliminar en Supabase:', error);
        showToast('Error al Eliminar', 'No se pudo borrar el registro: ' + error.message, 'error');
    } else {
        showToast('Registro Eliminado', 'El registro se borró de la base de datos.', 'success');
        
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
    
    document.getElementById('registro-id').value = registro.id;
    document.getElementById('reg-fecha').value = registro.fecha;
    document.getElementById('reg-tipo').value = registro.tipo_registro;
    document.getElementById('reg-descripcion').value = registro.descripcion;
    
    document.getElementById('form-title').textContent = 'Editar Registro';
    document.getElementById('btn-save-text').textContent = 'Guardar Cambios';
    document.getElementById('btn-cancel-edit').style.display = 'block';
    
    const saveBtn = document.getElementById('btn-save-record');
    saveBtn.querySelector('svg').innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    `;
    
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Cancela la edición actual y restablece el formulario.
 */
function cancelarEdicion() {
    document.getElementById('registro-id').value = '';
    document.getElementById('registro-form').reset();
    inicializarFechas();
    
    document.getElementById('form-title').textContent = 'Nuevo Registro';
    document.getElementById('btn-save-text').textContent = 'Agregar Registro';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    
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
    
    if (filterTipo !== 'Todos') {
        registrosFiltrados = registrosFiltrados.filter(r => r.tipo_registro === filterTipo);
    }
    
    if (searchText !== '') {
        registrosFiltrados = registrosFiltrados.filter(r => 
            r.descripcion.toLowerCase().includes(searchText)
        );
    }
    
    actualizarTabla(registrosFiltrados);
}

/**
 * Renderiza los registros en el cuerpo de la tabla HTML.
 */
function actualizarTabla(registros) {
    const tableBody = document.getElementById('tabla-registros-body');
    const emptyState = document.getElementById('empty-state');
    const recordsCounter = document.getElementById('records-counter');
    
    recordsCounter.textContent = registrosCache.length;
    tableBody.innerHTML = '';
    
    if (registros.length === 0) {
        document.getElementById('tabla-registros').style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    document.getElementById('tabla-registros').style.display = 'table';
    emptyState.style.display = 'none';
    
    registros.forEach(r => {
        const row = document.createElement('tr');
        
        const fechaFormateada = formatearFecha(r.fecha);
        const creadoFormateado = formatearTimestamp(r.creado_en);
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
 * Traduce los errores comunes de Auth para el usuario.
 */
function traducirErrorAuth(error) {
    if (!error) return 'Ocurrió un error desconocido.';
    const msg = error.message.toLowerCase();
    
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return 'El correo electrónico o la contraseña son incorrectos.';
    }
    if (msg.includes('user already exists') || msg.includes('user already registered') || msg.includes('email already registered') || msg.includes('email already exists') || msg.includes('email already in use') || msg.includes('already exists')) {
        return 'Ya existe una cuenta registrada con este correo electrónico.';
    }
    if (msg.includes('password should be') || msg.includes('password is too weak') || msg.includes('stronger password') || msg.includes('weak password')) {
        return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres o cumplir con las políticas de seguridad.';
    }
    if (msg.includes('email address is invalid') || msg.includes('unable to validate email') || msg.includes('invalid email')) {
        return 'Por favor, introduce un correo electrónico válido.';
    }
    
    return error.message;
}

/**
 * Controla el spinner de carga en los botones.
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
 * Muestra u oculta la carga de la tabla.
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
 * Formatea una fecha YYYY-MM-DD a DD/MM/YYYY.
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
 * Formatea un timestamp ISO.
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
 * Escapa HTML.
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
 * Lanza una notificación flotante Toast en pantalla.
 */
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let svgIcon = '';
    if (type === 'success') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
    } else if (type === 'error') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
    } else if (type === 'warning') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="toast-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
    } else {
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
    
    const dismissToast = () => {
        if (toast.classList.contains('toast-closing')) return;
        toast.classList.add('toast-closing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    };
    
    toast.querySelector('.toast-close-btn').addEventListener('click', dismissToast);
    setTimeout(dismissToast, 4500); // 4.5 segundos
}
