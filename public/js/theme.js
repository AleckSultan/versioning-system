// ─── THEME MANAGEMENT ──────────────────────────────────────────
const THEME_KEY = 'nyeri_theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  // Update all toggle switches on page
  document.querySelectorAll('[data-theme-toggle]').forEach(el => {
    el.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  });
}

function toggleTheme() {
  const current = getTheme();
  applyTheme(current === 'light' ? 'dark' : 'light');
}

// Apply immediately on load to prevent flash
applyTheme(getTheme());

// Expose globally
window.ThemeManager = { getTheme, applyTheme, toggleTheme };
