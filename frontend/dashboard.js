/**
 * dashboard.js — Lógica del Dashboard en tiempo real (dashboard.html)
 *
 * Responsabilidades:
 *  1. Conectar al endpoint SSE del backend con EventSource
 *  2. Escuchar eventos de actualización de tareas y re-renderizar el DOM
 *  3. Mantener contadores de estado actualizados
 *  4. Registrar un historial de eventos (log)
 *  5. Renderizar tarjetas de workers
 *  6. Manejar reconexión automática ante desconexiones
 */

'use strict';

// ── Configuración ──────────────────────────────────────────────────────────
const API_BASE  = 'http://localhost:8000';
const SSE_URL   = `${API_BASE}/api/tasks/events`;   // Endpoint SSE del backend
const RECONNECT_DELAY_MS = 5000;                    // Tiempo entre reintentos de conexión

// ── Estado interno (fuente de verdad del dashboard) ───────────────────────
// Mapa de tareas indexado por ID para actualizaciones O(1)
const taskMap = new Map();

// ── Referencias DOM ────────────────────────────────────────────────────────
const DOM = {
  pending:         document.getElementById('pendingCount'),
  processing:      document.getElementById('processingCount'),
  completed:       document.getElementById('completedCount'),
  error:           document.getElementById('errorCount'),
  connDot:         document.getElementById('connectionDot'),
  connText:        document.getElementById('connectionText'),
  lastUpdate:      document.getElementById('lastUpdate'),
  pendingTasks:    document.getElementById('pendingTasks'),
  processingTasks: document.getElementById('processingTasks'),
  completedTasks:  document.getElementById('completedTasks'),
  errorTasks:      document.getElementById('errorTasks'),
  pendingCol:      document.getElementById('pendingColCount'),
  processingCol:   document.getElementById('processingColCount'),
  completedCol:    document.getElementById('completedColCount'),
  errorCol:        document.getElementById('errorColCount'),
  eventLog:        document.getElementById('eventLog'),
  workersGrid:     document.getElementById('workersGrid'),
  clearLogBtn:     document.getElementById('clearLogBtn'),
  exportLogBtn:    document.getElementById('exportLogBtn'),
};

// ── Log interno (para exportar) ────────────────────────────────────────────
const logEntries = [];

// ── SSE: conexión con reconexión automática ────────────────────────────────

/** Referencia global al EventSource activo */
let eventSource = null;

/**
 * Inicia (o reinicia) la conexión SSE al backend.
 * El navegador intenta reconectar automáticamente, pero esta función
 * añade control explícito para manejar errores graves.
 */
function connectSSE() {
  setConnectionState('connecting', 'Conectando al servidor...');

  // Cerrar conexión previa si existe
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  eventSource = new EventSource(SSE_URL);

  // ── Evento genérico "message" ──────────────────────────────────────────
  // El backend puede enviar eventos sin nombre de tipo (data: {...})
  eventSource.addEventListener('message', (e) => {
    handleSSEMessage(e.data);
  });

  // ── Eventos con nombre específico que puede emitir el backend ──────────

  // Actualización de una tarea
  eventSource.addEventListener('task_update', (e) => {
    handleSSEMessage(e.data);
  });

  // Snapshot completo del estado del sistema (útil al conectar)
  eventSource.addEventListener('snapshot', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (Array.isArray(data.tasks)) {
        // Cargar todas las tareas del snapshot
        data.tasks.forEach(t => taskMap.set(t.id, t));
        renderAll();
        addLog('info', 'Snapshot del sistema recibido.');
      }
      if (Array.isArray(data.workers)) {
        renderWorkers(data.workers);
      }
    } catch (err) {
      console.error('[SSE] Error parseando snapshot:', err);
    }
  });

  // Actualización de workers
  eventSource.addEventListener('workers_update', (e) => {
    try {
      const workers = JSON.parse(e.data);
      renderWorkers(workers);
    } catch (err) {
      console.error('[SSE] Error parseando workers:', err);
    }
  });

  // ── Handlers de ciclo de vida ──────────────────────────────────────────

  eventSource.onopen = () => {
    setConnectionState('connected', 'Conectado — recibiendo eventos');
    addLog('info', 'Conexión SSE establecida con el servidor.');
  };

  eventSource.onerror = () => {
    // readyState 2 = CLOSED (el EventSource no puede reconectar)
    if (eventSource.readyState === EventSource.CLOSED) {
      setConnectionState('failed', 'Conexión perdida. Reintentando...');
      addLog('error', 'Conexión SSE cerrada. Reintentando en 5 s...');
      // Reconexión manual con delay
      setTimeout(connectSSE, RECONNECT_DELAY_MS);
    } else {
      // readyState 0 (CONNECTING): el EventSource ya está reintentando solo
      setConnectionState('disconnected', 'Reconectando...');
    }
  };
}

// ── Procesamiento de mensajes SSE ──────────────────────────────────────────

/**
 * Parsea el JSON recibido, actualiza el mapa de tareas y re-renderiza.
 * @param {string} raw - Datos crudos del evento SSE
 */
function handleSSEMessage(raw) {
  try {
    const data = JSON.parse(raw);

    // El backend puede envolver en { task: {...} } o enviar el objeto directo
    const task = data.task || data;

    if (!task.id) {
      console.warn('[SSE] Mensaje sin ID de tarea:', task);
      return;
    }

    const prev = taskMap.get(task.id);
    taskMap.set(task.id, { ...(prev || {}), ...task });

    renderAll();
    updateTimestamp();

    // Registrar en el log sólo cambios de estado
    if (!prev || prev.status !== task.status) {
      const label = STATUS_LABELS[task.status] || task.status;
      addLog(statusToLogType(task.status), `Tarea "${esc(task.title)}" — Estado: ${label}`);
    }

  } catch (err) {
    console.error('[SSE] Error al procesar mensaje:', err, raw);
  }
}

// ── Renderizado del Kanban ─────────────────────────────────────────────────

/** Re-renderiza todos los contadores y columnas del Kanban */
function renderAll() {
  // Agrupar tareas por estado
  const groups = { pendiente: [], 'en proceso': [], completada: [], error: [] };

  for (const task of taskMap.values()) {
    const key = task.status in groups ? task.status : 'pendiente';
    groups[key].push(task);
  }

  // Actualizar contadores de stats panel
  DOM.pending.textContent    = groups['pendiente'].length;
  DOM.processing.textContent = groups['en proceso'].length;
  DOM.completed.textContent  = groups['completada'].length;
  DOM.error.textContent      = groups['error'].length;

  // Renderizar columnas Kanban
  renderColumn(DOM.pendingTasks,    DOM.pendingCol,    groups['pendiente']);
  renderColumn(DOM.processingTasks, DOM.processingCol, groups['en proceso']);
  renderColumn(DOM.completedTasks,  DOM.completedCol,  groups['completada']);
  renderColumn(DOM.errorTasks,      DOM.errorCol,      groups['error']);
}

/**
 * Renderiza una columna del Kanban con sus mini-tarjetas.
 * @param {HTMLElement} container - Elemento contenedor de la columna
 * @param {HTMLElement} countEl   - Badge de conteo de la columna
 * @param {Array}       tasks     - Tareas para esta columna
 */
function renderColumn(container, countEl, tasks) {
  countEl.textContent = tasks.length;

  if (tasks.length === 0) {
    container.innerHTML = '<p class="empty-flow">Sin tareas</p>';
    return;
  }

  // Ordenar por fecha de creación descendente (más reciente primero)
  const sorted = [...tasks].sort((a, b) =>
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  container.innerHTML = sorted.map(buildFlowCard).join('');
}

/** Construye HTML de una mini-tarjeta para el Kanban */
function buildFlowCard(task) {
  const priClass = `priority-${esc(task.priority || 'media')}`;
  const priLabel = PRIORITY_LABELS[task.priority] || task.priority || '—';
  const time     = formatTime(task.created_at);

  return `
    <div class="flow-task-card" data-id="${esc(task.id)}">
      <div class="flow-task-title">${esc(task.title)}</div>
      <div class="flow-task-meta">
        <span class="badge flow-task-priority ${priClass}">${priLabel}</span>
        <span class="flow-task-time">${time}</span>
      </div>
    </div>
  `;
}

// ── Workers ────────────────────────────────────────────────────────────────

/**
 * Renderiza las tarjetas de workers.
 * @param {Array} workers - Array de objetos worker del backend
 */
function renderWorkers(workers) {
  if (!workers || workers.length === 0) {
    DOM.workersGrid.innerHTML = '<p class="empty-state">Sin workers registrados en este momento.</p>';
    return;
  }

  DOM.workersGrid.innerHTML = workers.map(w => `
    <div class="worker-card">
      <div class="worker-header">
        <span class="worker-name">${esc(w.name || w.id || 'Worker')}</span>
        <span class="worker-status ${esc(w.status || 'idle')}">${esc(w.status || 'idle')}</span>
      </div>
      <div class="worker-stats">
        <div class="worker-stat">
          <span class="stat-label">Tareas procesadas</span>
          <span class="stat-val">${w.tasks_processed ?? '—'}</span>
        </div>
        <div class="worker-stat">
          <span class="stat-label">Tiempo activo</span>
          <span class="stat-val">${esc(w.uptime || '—')}</span>
        </div>
        <div class="worker-stat">
          <span class="stat-label">Tarea actual</span>
          <span class="stat-val">${esc(w.current_task || '—')}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Log de eventos ─────────────────────────────────────────────────────────

/**
 * Agrega una entrada al historial de eventos.
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {string} message
 */
function addLog(type, message) {
  const time = new Date().toLocaleTimeString('es-MX', { hour12: false });

  logEntries.push({ time, type, message });

  // Limitar log visual a 200 entradas
  if (DOM.eventLog.children.length > 200) {
    DOM.eventLog.removeChild(DOM.eventLog.firstChild);
  }

  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-message">${esc(message)}</span>
  `;

  DOM.eventLog.appendChild(entry);

  // Scroll al final si el usuario está cerca del fondo
  const logEl = DOM.eventLog;
  const isNearBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
  if (isNearBottom) logEl.scrollTop = logEl.scrollHeight;
}

// Limpiar log
DOM.clearLogBtn.addEventListener('click', () => {
  DOM.eventLog.innerHTML = '';
  logEntries.length = 0;
  addLog('info', 'Historial limpiado.');
});

// Exportar log como .txt
DOM.exportLogBtn.addEventListener('click', () => {
  const lines = logEntries.map(e => `[${e.time}] [${e.type.toUpperCase()}] ${e.message}`);
  const blob   = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `eventos_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Estado de conexión ─────────────────────────────────────────────────────

/**
 * Actualiza el indicador visual de conexión SSE.
 * @param {'connecting'|'connected'|'disconnected'|'failed'} state
 * @param {string} label
 */
function setConnectionState(state, label) {
  DOM.connDot.className  = `status-dot ${state}`;
  DOM.connText.textContent = label;
}

/** Actualiza el timestamp de última actualización */
function updateTimestamp() {
  DOM.lastUpdate.textContent = new Date().toLocaleTimeString('es-MX', { hour12: false });
}

// ── Utilidades ─────────────────────────────────────────────────────────────

/** Escapa HTML para prevenir XSS */
function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/** Formatea hora corta */
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Mapea un status al tipo de entrada de log */
function statusToLogType(status) {
  return { completada: 'success', error: 'error', 'en proceso': 'info', pendiente: 'info' }[status] || 'info';
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

// ── Arranque ───────────────────────────────────────────────────────────────
connectSSE();