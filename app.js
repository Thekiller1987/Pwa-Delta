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

    State.leads = result.leads;
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
        card.className = 'lead-card';
        card.setAttribute('data-row-id', lead.rowId);
        card.style.animationDelay = `${index * 0.05}s`;

        const formattedDate = formatLeadDate(lead.fecha);
        const completionDateDisplay = formatDateDisplay(lead.fechaFinalizacion);
        
        card.innerHTML = `
            <h3>
                ${lead.nombre} 
                <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
            </h3>
            <p><strong>Empresa:</strong> ${lead.empresa}</p>
            <p><strong>Email:</strong> <a href="mailto:${lead.email}" style="color: ${isFinalized ? '#aaa' : 'white'};">${lead.email}</a></p>
            <p><strong>Teléfono:</strong> ${lead.telefono}</p>
            <p><strong>Registro:</strong> ${formattedDate}</p>
            <p style="margin-top: 10px;"><strong>Mensaje:</strong> ${lead.mensaje}</p>
            
            <div class="management-controls">
                <div class="control-group">
                    <label>Asignado a:</label>
                    <select class="assignee-select" id="assignee-${lead.rowId}" ${isFinalized ? 'disabled' : ''}>
                        <option value="Sin asignar" ${!lead.asignadoA || lead.asignadoA === 'Sin asignar' ? 'selected' : ''}>— Sin asignar —</option>
                        ${State.personnel.map(name => `<option value="${name}" ${lead.asignadoA === name ? 'selected' : ''}>${name}</option>`).join('')}
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

                <button class="save-btn" data-row-id="${lead.rowId}" ${isFinalized ? 'disabled' : ''}>
                    ${isFinalized ? 'FINALIZADO' : 'GUARDAR CAMBIOS'}
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });

    // Add event listeners for assignment buttons
    document.querySelectorAll('.save-btn').forEach(button => {
        button.addEventListener('click', handleSave);
    });
}

async function handleSave(e) {
    const button = e.target;
    const rowId = button.getAttribute('data-row-id');
    const card = button.closest('.lead-card');
    
    const assignee = card.querySelector(`#assignee-${rowId}`).value;
    const status = card.querySelector(`#status-${rowId}`).value;
    const completionDate = card.querySelector(`#date-${rowId}`).value;
    
    if (!assignee || assignee === 'Sin asignar') {
         showMessage('dashboard-message', 'Debe asignar el lead a una persona.', 'info');
         return;
    }
    if (status === 'Finalizado' && !completionDate) {
         showMessage('dashboard-message', 'Si el estado es Finalizado, debe especificar la Fecha de Finalización.', 'info');
         return;
    }

    button.textContent = 'Guardando...';
    button.disabled = true;

    const updateData = {
        rowId,
        assignedTo: assignee,
        status: status,
        completionDate: completionDate 
    };

    const result = await fetchAPI('update_lead_status', updateData);

    if (result.success) {
        showMessage('dashboard-message', result.message, 'success');
        loadDashboardData(); 
    } else {
        showMessage('dashboard-message', result.message, 'error');
        button.textContent = 'Error: Reintentar';
        button.disabled = false;
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', checkAuth);