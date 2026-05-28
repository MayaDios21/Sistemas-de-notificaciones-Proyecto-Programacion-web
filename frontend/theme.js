/**
 * theme.js - Manejo de tema claro/oscuro
 * 
 * Este archivo maneja:
 * - Detección de preferencia del sistema
 * - Almacenamiento de preferencia en localStorage
 * - Aplicación de tema al documento
 * - Sincronización entre páginas
 */

const THEME_KEY = 'app-theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

/**
 * Función: getPreferredTheme
 * Determina el tema preferido del usuario
 * @returns {string} 'dark' o 'light'
 */
function getPreferredTheme() {
  // 1. Verificar si hay una preferencia guardada
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    return savedTheme;
  }
  
  // 2. Verificar preferencia del sistema
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return THEME_DARK;
  }
  
  // 3. Por defecto, usar light
  return THEME_LIGHT;
}

/**
 * Función: setTheme
 * Aplica el tema especificado
 * @param {string} theme - 'dark' o 'light'
 */
function setTheme(theme) {
  const html = document.documentElement;
  const body = document.body;
  
  if (theme === THEME_DARK) {
    html.classList.add(THEME_DARK);
    body.classList.add(THEME_DARK);
  } else {
    html.classList.remove(THEME_DARK);
    body.classList.remove(THEME_DARK);
  }
  
  // Guardar preferencia
  localStorage.setItem(THEME_KEY, theme);
  
  // Actualizar estado del botón toggle
  updateThemeToggle(theme);
}

/**
 * Función: toggleTheme
 * Alterna entre tema claro y oscuro
 */
function toggleTheme() {
  const currentTheme = getPreferredTheme();
  const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setTheme(newTheme);
}

/**
 * Función: updateThemeToggle
 * Actualiza la apariencia del botón toggle
 * @param {string} theme - 'dark' o 'light'
 */
function updateThemeToggle(theme) {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  
  const sunIcon = toggle.querySelector('.theme-icon-sun');
  const moonIcon = toggle.querySelector('.theme-icon-moon');
  
  if (theme === THEME_DARK) {
    sunIcon.style.display = 'inline';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'inline';
  }
}

/**
 * Función: initTheme
 * Inicializa el tema al cargar la página
 */
function initTheme() {
  const theme = getPreferredTheme();
  setTheme(theme);
  
  // Configurar botón toggle si existe
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', toggleTheme);
  }
  
  // Escuchar cambios en preferencia del sistema
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Solo cambiar si el usuario no ha establecido una preferencia manual
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? THEME_DARK : THEME_LIGHT);
      }
    });
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
