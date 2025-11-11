// 🌟 URL DE API UNIFICADA DEL USUARIO (¡LISTA PARA USAR!) 🌟
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx8yPloexKjU6mEXyJR5YxgAoMKdvYrekWVxtm1aGqHOAHxg3IjnIGRJAkiKfoCR2XUUg/exec'; 

const State = {
    isAuthenticated: false,
    userName: '',
    personnel: [],
    leads: [], // Almacén principal de todos los leads
    currentFilter: 'all' // NUEVO: Estado del filtro
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

// --- MODAL DE CONFIRMACIÓN ---
function showCustomConfirm(title, message, details, onConfirm) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const modal = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('custom-confirm-title');
    const messageEl = document.getElementById('custom-confirm-message');
    const detailsEl = document.getElementById('custom-confirm-details');
    const yesBtn = document.getElementById('custom-confirm-yes');
    const noBtn = document.getElementById('custom-confirm-no');

    titleEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    messageEl.textContent = message;
    detailsEl.textContent = details;

    overlay.classList.add('visible');
    modal.classList.add('visible'); // <-- NUEVO 1: Muestra el modal

    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    newYesBtn.addEventListener('click', () => {
        onConfirm();
        overlay.classList.remove('visible');
        modal.classList.remove('visible'); // <-- NUEVO 2: Oculta el modal
    });

    newNoBtn.addEventListener('click', () => {
        overlay.classList.remove('visible');
        modal.classList.remove('visible'); // <-- NUEVO 3: Oculta el modal
    });

    if (title.toLowerCase().includes('eliminar')) {
        newYesBtn.textContent = "Sí, Eliminar";
        newYesBtn.style.backgroundColor = '#dc3545';
    } else {
        newYesBtn.textContent = "Sí, Guardar";
        newYesBtn.style.backgroundColor = 'var(--accent-success)';
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
    document.getElementById('dashboard-screen').style   .display = 'block';
    
    // --- LÓGICA DE EVENTOS PRINCIPALES ---
    const grid = document.getElementById('leads-grid');
    grid.addEventListener('click', handleGridClick);
    grid.addEventListener('change', handleGridChange);
    
    // NUEVO: Listeners para Recarga y Filtros
    document.getElementById('reload-button').addEventListener('click', handleReload);
    document.getElementById('filter-container').addEventListener('click', handleFilterClick);
    
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('deltalink_user');
        State.isAuthenticated = false;
        State.userName = '';
        State.leads = [];
        State.currentFilter = 'all'; // Resetear filtro al salir
        showLogin();
    });

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

// --- DASHBOARD LOGIC ---

// NUEVO: Botón de recarga
function handleReload() {
    const reloadIcon = document.querySelector('#reload-button i');
    reloadIcon.classList.add('fa-spin'); // Añadir animación de giro
    loadDashboardData().finally(() => {
        setTimeout(() => reloadIcon.classList.remove('fa-spin'), 500); // Quitar animación
    });
}

// NUEVO: Clic en botones de filtro
function handleFilterClick(e) {
    if (!e.target.classList.contains('filter-btn')) return;

    // Quitar 'active' de todos
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    // Añadir 'active' al clicado
    e.target.classList.add('active');

    State.currentFilter = e.target.dataset.filter;
    filterAndRenderLeads();
}

// NUEVO: Lógica de filtrado
function filterAndRenderLeads() {
    let filteredLeads = State.leads;

    if (State.currentFilter !== 'all') {
        filteredLeads = State.leads.filter(lead => lead.estado === State.currentFilter);
    }
    
    renderLeads(filteredLeads); // Renderizar solo los leads filtrados
}

async function loadDashboardData() {
    const grid = document.getElementById('leads-grid');
    grid.innerHTML = '<div class="loading">Cargando datos... <i class="fas fa-spinner fa-spin"></i></div>';
    
    const result = await fetchAPI('get_data');

    if (result.error) {
        grid.innerHTML = '<div class="loading">No se pudieron cargar los leads. Verifique la conexión o las pestañas de Google Sheets.</div>';
        return;
    }

    // 1. Guardar todos los leads en el estado
    State.leads = result.leads.sort((a, b) => {
        const statusOrder = { 'Pendiente': 0, 'En Proceso': 1, 'Finalizado': 2 };
        return (statusOrder[a.estado] || 0) - (statusOrder[b.estado] || 0);
    });

    State.personnel = result.personnel;
    
    // 2. Filtrar y luego renderizar
    filterAndRenderLeads();
}

function renderLeads(leadsToRender) {
    const grid = document.getElementById('leads-grid');
    grid.className = ''; 
    grid.innerHTML = ''; 

    // MODIFICADO: Mensaje si la lista FILTRADA está vacía
    if (leadsToRender.length === 0) {
        if (State.currentFilter === 'all') {
            grid.innerHTML = '<p class="loading">No hay leads pendientes en la hoja.</p>';
        } else {
            grid.innerHTML = `<p class="loading">No se encontraron leads con el estado "${State.currentFilter}".</p>`;
        }
        return;
    }
    
    leadsToRender.forEach((lead, index) => {
        const statusInfo = STATUS_OPTIONS.find(s => s.value === lead.estado) || { value: lead.estado || 'Pendiente', label: lead.estado || 'Pendiente', class: 'status-Pendiente' };
        const isFinalized = lead.estado === 'Finalizado';
        
        const card = document.createElement('div');
        card.className = `lead-card ${isFinalized ? 'finalized' : ''}`;
        card.setAttribute('data-row-id', lead.rowId);
        card.style.animationDelay = `${index * 0.05}s`;

        const formattedDate = formatLeadDate(lead.fecha);
        const completionDateDisplay = formatDateDisplay(lead.fechaFinalizacion);
        
        const assignedPeople = (lead.asignadoA && lead.asignadoA !== 'Sin asignar') ? lead.asignadoA.split(',') : [];
        const pillsHTML = assignedPeople.map(name => `
            <span class="assignee-pill" data-name="${name}">
                ${name}
                <span class="remove-assignee" data-name="${name}" data-row-id="${lead.rowId}">
                    <i class="fas fa-times"></i>
                </span>
            </span>
        `).join('');

        const placeholderHTML = assignedPeople.length === 0 ? '<p class="unassigned-placeholder">Sin asignar</p>' : '';
        const availablePeople = State.personnel.filter(name => !assignedPeople.includes(name));
        const optionsHTML = availablePeople.map(name => `<option value="${name}">${name}</option>`).join('');

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
                <div class="control-group align-top">
                    <label>Asignado a:</label>
                    <div class="assignee-container">
                        <div class="assigned-pills" id="pills-${lead.rowId}">
                            ${pillsHTML}
                            ${placeholderHTML}
                        </div>
                        <select class="assignee-add-select" data-row-id="${lead.rowId}" ${isFinalized ? 'disabled' : ''}>
                            <option value="">— Asignar a otra persona —</option>
                            ${optionsHTML}
                        </select>
                    </div>
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
}

// --- MANEJADORES DE EVENTOS ---

function handleGridClick(e) {
    const target = e.target;
    if (target.classList.contains('save-btn')) {
        handleSave(target);
    }
    if (target.classList.contains('delete-btn')) {
        handleDelete(target);
    }
    const removeBtn = target.closest('.remove-assignee');
    if (removeBtn) {
        const name = removeBtn.dataset.name;
        const rowId = removeBtn.dataset.rowId;
        removeAssigneePill(name, rowId);
    }
}

function handleGridChange(e) {
    const target = e.target;
    if (target.classList.contains('assignee-add-select')) {
        const name = target.value;
        if (!name) return;
        const rowId = target.dataset.rowId;
        addAssigneePill(name, rowId);
        target.value = '';
    }
}

// --- LÓGICA DE UI: Añadir/Quitar Pills ---

function addAssigneePill(name, rowId) {
    const pillsContainer = document.getElementById(`pills-${rowId}`);
    const addSelect = document.querySelector(`.assignee-add-select[data-row-id="${rowId}"]`);

    const placeholder = pillsContainer.querySelector('.unassigned-placeholder');
    if (placeholder) placeholder.remove();

    const pill = document.createElement('span');
    pill.className = 'assignee-pill';
    pill.dataset.name = name;
    pill.innerHTML = `
        ${name}
        <span class="remove-assignee" data-name="${name}" data-row-id="${rowId}">
            <i class="fas fa-times"></i>
        </span>
    `;
    pillsContainer.appendChild(pill);

    const optionToRemove = addSelect.querySelector(`option[value="${name}"]`);
    if (optionToRemove) optionToRemove.remove();
}

function removeAssigneePill(name, rowId) {
    const pillsContainer = document.getElementById(`pills-${rowId}`);
    const addSelect = document.querySelector(`.assignee-add-select[data-row-id="${rowId}"]`);

    const pillToRemove = pillsContainer.querySelector(`.assignee-pill[data-name="${name}"]`);
    if (pillToRemove) pillToRemove.remove();

    const optionExists = addSelect.querySelector(`option[value="${name}"]`);
    if (!optionExists) {
        const newOption = document.createElement('option');
        newOption.value = name;
        newOption.textContent = name;
        addSelect.appendChild(newOption);
    }

    if (pillsContainer.querySelectorAll('.assignee-pill').length === 0) {
        pillsContainer.innerHTML = '<p class="unassigned-placeholder">Sin asignar</p>';
    }
}

// --- LÓGICA DE GUARDAR Y ELIMINAR ---

async function handleSave(button) {
    const rowId = button.dataset.rowId;
    const card = button.closest('.lead-card');
    
    const pills = card.querySelectorAll('.assignee-pill');
    const assignedNames = Array.from(pills).map(pill => pill.dataset.name);
    let assignedToValue = (assignedNames.length === 0) ? 'Sin asignar' : assignedNames.join(',');

    const status = card.querySelector(`#status-${rowId}`).value;
    const completionDate = card.querySelector(`#date-${rowId}`).value;
    
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
    card.querySelector('.delete-btn').disabled = true;

    const updateData = {
        rowId,
        assignedTo: assignedToValue,
        status: status,
        completionDate: completionDate 
    };

    const result = await fetchAPI('update_lead_status', updateData);

    if (result.success) {
        showMessage('dashboard-message', result.message, 'success');
        // MODIFICADO: En lugar de recargar todo, solo actualiza el estado local
        // y vuelve a filtrar/renderizar.
        const leadToUpdate = State.leads.find(l => l.rowId == rowId);
        if (leadToUpdate) {
            leadToUpdate.asignadoA = assignedToValue;
            leadToUpdate.estado = status;
            leadToUpdate.fechaFinalizacion = completionDate;
        }
        filterAndRenderLeads(); // Vuelve a renderizar con el filtro actual
    } else {
        showMessage('dashboard-message', result.message, 'error');
        button.textContent = 'Error: Reintentar';
        button.disabled = false;
        if(status !== 'Finalizado') {
            card.querySelector('.delete-btn').disabled = false;
        }
    }
}

async function handleDelete(button) {
    const rowId = button.dataset.rowId;
    const card = button.closest('.lead-card');
    const leadName = card.querySelector('.lead-name').textContent.trim();

    showCustomConfirm(
        "Confirmar Eliminación",
        `¿Estás seguro de que deseas eliminar este lead?`,
        `Lead: "${leadName}" (Fila ${rowId}). Esta acción no se puede deshacer.`,
        async () => {
            card.style.opacity = '0.5';
            button.disabled = true;
            card.querySelector('.save-btn').disabled = true;
            
            const result = await fetchAPI('delete_lead', { rowId });

            if (result.success) {
                showMessage('dashboard-message', result.message, 'success');
                
                // MODIFICADO: Elimina el lead del estado global
                State.leads = State.leads.filter(l => l.rowId != rowId);

                // Anima y elimina la tarjeta
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease, height 0.3s ease, padding 0.3s ease, margin 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                card.style.height = '0px';
                card.style.paddingTop = '0px';
                card.style.paddingBottom = '0px';
                card.style.marginTop = '0px';
                card.style.marginBottom = '0px';
                card.style.border = 'none';
                
                setTimeout(() => {
                    card.remove();
                    // Vuelve a verificar si la lista filtrada está vacía
                    if (document.querySelectorAll('.lead-card').length === 0) {
                        filterAndRenderLeads();
                    }
                }, 350);
                 
            } else {
                showMessage('dashboard-message', result.message, 'error');
                card.style.opacity = '1';
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