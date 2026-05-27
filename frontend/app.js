/**
 * app.js — Lógica de la pantalla principal (index.html)
 *
 * Responsabilidades:
 *  1. Validar y enviar tareas al backend via fetch (POST)
 *  2. Persistir tareas recientes en localStorage
 *  3. Renderizar la lista de tareas recientes
 */

'use strict';

// ── Configuración de API ───────────────────────────────────────────────────
const API_BASE    = 'http://localhost:8000';
const TASKS_URL   = `${API_BASE}/api/tasks`;

// ── Referencias DOM ────────────────────────────────────────────────────────
const taskForm      = document.getElementById('taskForm');
const submitBtn     = document.getElementById('submitBtn');
const btnText       = submitBtn.querySelector('.btn-text');
const btnLoader     = document.getElementById('btnLoader');
const responseMsg   = document.getElementById('responseMessage');
const recentList    = document.getElementById('recentTasksList');

// ── Inicialización ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderRecentTasks);

// ── Envío del formulario ───────────────────────────────────────────────────
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!taskForm.checkValidity()) {
    taskForm.reportValidity();
    return;
  }

  setLoading(true);
  hideMessage();

  // Recopilar datos del formulario
  const payload = {
    title:       document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDescription').value.trim(),
    priority:    document.getElementById('taskPriority').value,
    type:        document.getElementById('taskType').value,
    created_at:  new Date().toISOString(),
  };

  try {
    // POST al backend FastAPI
    const res = await fetch(TASKS_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Intentar leer el detalle de error del servidor
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Error ${res.status}: ${res.statusText}`);
    }

    const result = await res.json();

    // Guardar en localStorage y refrescar lista
    persistTask({
      ...payload,
      id:     result.id || generateId(),
      status: result.status || 'pendiente',
    });

    renderRecentTasks();
    taskForm.reset();
    showMessage('success', `Tarea creada correctamente. ID: ${result.id || '—'}`);

  } catch (err) {
    console.error('[app] Error al enviar tarea:', err);
    showMessage('error', err.message || 'No se pudo conectar con el servidor.');
  } finally {
    setLoading(false);
  }
});

// Limpiar mensaje al resetear
taskForm.addEventListener('reset', hideMessage);

// ── Helpers de UI ──────────────────────────────────────────────────────────

/** Activa/desactiva el estado de carga del botón de envío */
function setLoading(on) {
  submitBtn.disabled = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'inline-block' : 'none';
}

/** Muestra un mensaje de respuesta (success | error) */
function showMessage(type, text) {
  responseMsg.textContent = text;
  responseMsg.className   = `response-message ${type}`;
  // Auto-ocultar tras 6 segundos
  clearTimeout(responseMsg._timer);
  responseMsg._timer = setTimeout(hideMessage, 6000);
}

/** Oculta el mensaje de respuesta */
function hideMessage() {
  responseMsg.className   = 'response-message';
  responseMsg.textContent = '';
}

// ── Persistencia ───────────────────────────────────────────────────────────
const LS_KEY = 'taskmaster_recent';

/** Guarda una tarea al inicio de la lista en localStorage (máx. 10) */
function persistTask(task) {
  try {
    const list = getTasks();
    list.unshift(task);
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch (e) {
    console.warn('[app] localStorage no disponible:', e);
  }
}

/** Lee las tareas recientes de localStorage */
function getTasks() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

// ── Renderizado ────────────────────────────────────────────────────────────

/** Renderiza la lista de tareas recientes en el DOM */
function renderRecentTasks() {
  const tasks = getTasks();

  if (tasks.length === 0) {
    recentList.innerHTML = '<p class="empty-state">Aún no hay tareas registradas. Envía tu primera tarea.</p>';
    return;
  }

  recentList.innerHTML = tasks.map(buildTaskCard).join('');
}

/** Construye el HTML de una tarjeta de tarea */
function buildTaskCard(task) {
  const statusLabel    = STATUS_LABELS[task.status]    || task.status;
  const priorityLabel  = PRIORITY_LABELS[task.priority] || task.priority;
  const typeLabel      = TYPE_LABELS[task.type]         || task.type;

  return `
    <article class="task-card" data-id="${esc(task.id)}">
      <div class="task-header">
        <h3 class="task-title">${esc(task.title)}</h3>
        <span class="badge ${esc(task.status)}">
          <span class="badge-dot"></span>
          ${statusLabel}
        </span>
      </div>
      <p class="task-description">${esc(task.description)}</p>
      <div class="task-meta">
        <span class="badge priority-${esc(task.priority)}">${priorityLabel}</span>
        <span class="badge badge-type">${typeLabel}</span>
        <span class="task-time">${formatDate(task.created_at)}</span>
      </div>
    </article>
  `;
}

// ── Utilidades ─────────────────────────────────────────────────────────────

/** Genera un ID de fallback único */
function generateId() {
  return 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Escapa HTML para prevenir XSS */
function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/** Formatea una fecha ISO a formato legible */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Mapas de etiquetas ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  'pendiente':  'Pendiente',
  'en proceso': 'En Proceso',
  'completada': 'Completada',
  'error':      'Error',
};

const PRIORITY_LABELS = {
  'baja':    'Baja',
  'media':   'Media',
  'alta':    'Alta',
  'critica': 'Crítica',
};

const TYPE_LABELS = {
  'procesamiento': 'Procesamiento',
  'analisis':      'Análisis',
  'reporte':       'Reporte',
  'notificacion':  'Notificación',
};