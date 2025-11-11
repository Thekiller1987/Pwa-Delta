// 🌟 URL DE API UNIFICADA DEL USUARIO (¡LISTA PARA USAR!) 🌟
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx8yPloexKjU6mEXyJR5YxgAoMKdvYrekWVxtm1aGqHOAHxg3IjnIGRJAkiKfoCR2XUUg/exec'; 

const State = {
    isAuthenticated: false,
    userName: '',
    personnel: [],
    leads: []
};

const STATUS_OPTIONS = [
    { value: 'Pendiente', label: 'Pendiente', class: 'status-Pendiente' },
    { value: 'En Proceso', label: 'En Proceso', class: 'status-En-Proceso' },
    { value: 'Finalizado', label: 'Finalizado', class: 'status-Finalizado' },
];

// --- UTILS ---
function showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = `message-box ${type} visible`;
    el.style.display = 'block';
    
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.style.display = 'none', 300);
    }, 5000);
}

function formatDateDisplay(dateString) {
    if (!dateString || dateString === 'Sin especificar' || dateString === '') return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return 'N/A';
    }
}

function formatLeadDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-NI', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
}


async function fetchAPI(action, data = {}) {
    try {
        const params = new URLSearchParams({ ...data, action: action });
        
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error("API Fetch Error:", error);
        showMessage('dashboard-message', 'Error de conexión con el servidor. Verifique la URL de la API y el despliegue.', 'error');
        return { error: true, message: 'Error de conexión' };
    }
}

// --- MODAL DE CONFIRMACIÓN (NUEVO) ---
/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} title - El título del modal (ej: "Confirmar Eliminación").
 * @param {string} message - La pregunta principal (ej: "¿Estás seguro?").
 * @param {string} details - Texto adicional (ej: "Lead: Juan Pérez").
 * @param {function} onConfirm - Callback que se ejecuta si el usuario presiona "Sí".
 */
function showCustomConfirm(title, message, details, onConfirm) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const modal = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('custom-confirm-title');
    const messageEl = document.getElementById('custom-confirm-message');
    const detailsEl = document.getElementById('custom-confirm-details');
    const yesBtn = document.getElementById('custom-confirm-yes');
    const noBtn = document.getElementById('custom-confirm-no');

    // Asignar contenido
    titleEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    messageEl.textContent = message;
    detailsEl.textContent = details;

    overlay.classList.add('visible');

    // Usamos .cloneNode(true) para limpiar event listeners antiguos y evitar clics múltiples
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    // Asignar nuevos listeners
    newYesBtn.addEventListener('click', () => {
        onConfirm(); // Ejecutar la acción
        overlay.classList.remove('visible');
    });

    newNoBtn.addEventListener('click', () => {
        overlay.classList.remove('visible');
    });

    // Personalizar botón de confirmación para eliminación
    if (title.toLowerCase().includes('eliminar')) {
        newYesBtn.textContent = "Sí, Eliminar";
        newYesBtn.style.backgroundColor = '#dc3545'; // Rojo
    } else {
        newYesBtn.textContent = "Sí, Guardar";
        newYesBtn.style.backgroundColor = 'var(--accent-success)'; // Verde
    }
}


// --- AUTHENTICATION ---
function checkAuth() {
    const user = localStorage.getItem('deltalink_user');
    if (user) {
        State.isAuthenticated = true;
        State.userName = user;
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard-screen').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    document.getElementById('user-name').textContent = State.userName;
    loadDashboardData();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-button');

    loginBtn.textContent = 'Verificando...';
    loginBtn.disabled = true;

    const result = await fetchAPI('login', { username, password });

    loginBtn.textContent = 'Iniciar Sesión';
    loginBtn.disabled = false;

    if (result.authenticated) {
        localStorage.setItem('deltalink_user', result.name);
        State.userName = result.name;
        State.isAuthenticated = true;
        showDashboard();
    } else {
        showMessage('login-message', result.reason || 'Error al iniciar sesión.', 'error');
    }
});

document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('deltalink_user');
    State.isAuthenticated = false;
    State.userName = '';
    showLogin();
});

// --- DASHBOARD LOGIC ---
async function loadDashboardData() {
    const grid = document.getElementById('leads-grid');
    grid.innerHTML = '<div class="loading">Cargando datos... <i class="fas fa-spinner fa-spin"></i></div>';
    
    const result = await fetchAPI('get_data');

    if (result.error) {
        grid.innerHTML = '<div class="loading">No se pudieron cargar los leads. Verifique la conexión o las pestañas de Google Sheets.</div>';
        return;
    }

    // Ordenar: Pendientes primero, luego En Proceso, luego Finalizados
    State.leads = result.leads.sort((a, b) => {
        const statusOrder = { 'Pendiente': 0, 'En Proceso': 1, 'Finalizado': 2 };
        return (statusOrder[a.estado] || 0) - (statusOrder[b.estado] || 0);
    });

    State.personnel = result.personnel;
    renderLeads(State.leads);
}

function renderLeads(leads) {
    const grid = document.getElementById('leads-grid');
    grid.className = ''; 
    grid.innerHTML = ''; 

    if (leads.length === 0) {
         grid.innerHTML = '<p class="loading">No hay leads pendientes en la hoja.</p>';
         return;
    }
    
    leads.forEach((lead, index) => {
        const statusInfo = STATUS_OPTIONS.find(s => s.value === lead.estado) || { value: lead.estado || 'Pendiente', label: lead.estado || 'Pendiente', class: 'status-Pendiente' };
        const isFinalized = lead.estado === 'Finalizado';
        
        const card = document.createElement('div');
        // --- MODIFICADO: Añadida clase 'finalized' ---
        card.className = `lead-card ${isFinalized ? 'finalized' : ''}`;
        card.setAttribute('data-row-id', lead.rowId);
        card.style.animationDelay = `${index * 0.05}s`;

        const formattedDate = formatLeadDate(lead.fecha);
        const completionDateDisplay = formatDateDisplay(lead.fechaFinalizacion);
        
        // --- MODIFICADO: Lógica para selector múltiple ---
        // Convierte el string "User A,User B" en un array ["User A", "User B"]
        const assignedPeople = lead.asignadoA ? lead.asignadoA.split(',') : [];
        const isUnassigned = assignedPeople.length === 0 || assignedPeople[0] === 'Sin asignar';

        const personnelOptions = State.personnel.map(name => 
            // Comprueba si el nombre está en el array de personas asignadas
            `<option value="${name}" ${assignedPeople.includes(name) ? 'selected' : ''}>${name}</option>`
        ).join('');
        // --- FIN DE MODIFICACIÓN ---

        card.innerHTML = `
            <h3>
                <span class="lead-name">${lead.nombre}</span>
                <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
            </h3>
            <p><strong>Empresa:</strong> ${lead.empresa}</p>
            <p><strong>Email:</strong> <a href="mailto:${lead.email}" style="color: ${isFinalized ? '#aaa' : 'white'};">${lead.email}</a></p>
            <p><strong>Teléfono:</strong> ${lead.telefono}</p>
            <p><strong>Registro:</strong> ${formattedDate}</p>
            <p style="margin-top: 10px;"><strong>Mensaje:</strong> ${lead.mensaje || 'N/A'}</p>
            
            <div class="management-controls">
                <div class="control-group">
                    <label>Asignado a:</label>
                    <select class="assignee-select" id="assignee-${lead.rowId}" ${isFinalized ? 'disabled' : ''} multiple>
                        <option value="Sin asignar" ${isUnassigned ? 'selected' : ''}>— Sin asignar —</option>
                        ${personnelOptions}
                    </select>
                </div>

                <div class="control-group">
                    <label>Estado:</label>
                    <select class="status-select" id="status-${lead.rowId}" data-current-status="${lead.estado || 'Pendiente'}" ${isFinalized ? 'disabled' : ''}>
                        ${STATUS_OPTIONS.map(s => `<option value="${s.value}" ${lead.estado === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                </div>
                
                <div class="control-group">
                    <label>F. Finalización:</label>
                    <input type="date" class="completion-date-input" id="date-${lead.rowId}" value="${lead.fechaFinalizacion || ''}" ${isFinalized ? 'disabled' : ''}/>
                </div>
                <p style="font-size: 0.85em; text-align: left; margin-top: -10px; margin-bottom: 5px; color: ${isFinalized ? 'var(--accent-success)' : '#aaa'};">
                    Actual: ${completionDateDisplay}
                </p>

                <div class="card-button-group">
                    <button class="save-btn" data-row-id="${lead.rowId}" ${isFinalized ? 'disabled' : ''}>
                        ${isFinalized ? 'FINALIZADO' : 'GUARDAR'}
                    </button>
                    <button class="delete-btn" data-row-id="${lead.rowId}">
                        ELIMINAR
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });

    // --- MODIFICADO: Añadir listeners para Guardar y Eliminar ---
    document.querySelectorAll('.save-btn').forEach(button => {
        button.addEventListener('click', handleSave);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDelete);
    });
}

async function handleSave(e) {
    const button = e.target;
    const rowId = button.getAttribute('data-row-id');
    const card = button.closest('.lead-card');
    
    // --- MODIFICADO: Obtener valores del select múltiple ---
    const assigneeSelect = card.querySelector(`#assignee-${rowId}`);
    // Crea un array con los valores de todas las opciones seleccionadas
    const selectedAssignees = Array.from(assigneeSelect.selectedOptions).map(option => option.value);
    
    let assignedToValue;
    // Si 'Sin asignar' está seleccionado (incluso con otros), o no hay nada, prioriza 'Sin asignar'
    if (selectedAssignees.includes('Sin asignar') || selectedAssignees.length === 0) {
        assignedToValue = 'Sin asignar';
        // Opcional: Deseleccionar otros si "Sin asignar" fue elegido
        if(selectedAssignees.length > 1) {
             Array.from(assigneeSelect.options).forEach(opt => {
                opt.selected = (opt.value === 'Sin asignar');
             });
        }
    } else {
        // Une los nombres con comas: "User A,User B"
        assignedToValue = selectedAssignees.join(','); 
    }
    // --- FIN DE MODIFICACIÓN ---

    const status = card.querySelector(`#status-${rowId}`).value;
    const completionDate = card.querySelector(`#date-${rowId}`).value;
    
    // Validación
    if (assignedToValue === 'Sin asignar' && (status === 'En Proceso' || status === 'Finalizado')) {
         showMessage('dashboard-message', 'No se puede poner "En Proceso" o "Finalizado" sin asignar a alguien.', 'info');
         return;
    }
    if (status === 'Finalizado' && !completionDate) {
         showMessage('dashboard-message', 'Si el estado es Finalizado, debe especificar la Fecha de Finalización.', 'info');
         return;
    }

    button.textContent = 'Guardando...';
    button.disabled = true;
    card.querySelector('.delete-btn').disabled = true; // Deshabilitar ambos

    const updateData = {
        rowId,
        assignedTo: assignedToValue, // Envía el string con comas
        status: status,
        completionDate: completionDate 
    };

    const result = await fetchAPI('update_lead_status', updateData);

    if (result.success) {
        showMessage('dashboard-message', result.message, 'success');
        // Recarga los datos para reflejar el cambio "en tiempo real" (sin recargar página)
        loadDashboardData(); 
    } else {
        showMessage('dashboard-message', result.message, 'error');
        button.textContent = 'Error: Reintentar';
        button.disabled = false;
        // Habilita el botón de eliminar solo si no estaba finalizado
        if(status !== 'Finalizado') {
            card.querySelector('.delete-btn').disabled = false;
        }
    }
}

// --- NUEVA FUNCIÓN: Manejar Eliminación ---
async function handleDelete(e) {
    const button = e.target;
    const rowId = button.getAttribute('data-row-id');
    const card = button.closest('.lead-card');
    const leadName = card.querySelector('.lead-name').textContent.trim();

    // Usar el nuevo modal de confirmación
    showCustomConfirm(
        "Confirmar Eliminación", // Título
        `¿Estás seguro de que deseas eliminar este lead?`, // Mensaje
        `Lead: "${leadName}" (Fila ${rowId}). Esta acción no se puede deshacer.`, // Detalles
        async () => { // Callback (lo que pasa si dice "Sí")
            
            // Mostrar estado de carga en la tarjeta
            card.style.opacity = '0.5';
            button.disabled = true;
            card.querySelector('.save-btn').disabled = true;
            
            const result = await fetchAPI('delete_lead', { rowId });

            if (result.success) {
                showMessage('dashboard-message', result.message, 'success');
                // Animar y eliminar la tarjeta para feedback instantáneo ("tiempo real")
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, height 0.3s ease, padding 0.3s ease, margin 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                card.style.height = '0px';
                card.style.paddingTop = '0px';
                card.style.paddingBottom = '0px';
                card.style.marginTop = '0px';
                card.style.marginBottom = '0px';
                card.style.border = 'none';
                
                // Esperar a que termine la animación para eliminar el elemento del DOM
                setTimeout(() => {
                    card.remove();
                    // Opcional: Recargar todo si se borró el último item
                    if (document.querySelectorAll('.lead-card').length === 0) {
                        renderLeads([]);
                    }
                }, 350);
                 
            } else {
                showMessage('dashboard-message', result.message, 'error');
                card.style.opacity = '1'; // Restaurar tarjeta si falla
                button.disabled = false;
                if (!card.classList.contains('finalized')) {
                    card.querySelector('.save-btn').disabled = false;
                }
            }
        }
    );
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', checkAuth);