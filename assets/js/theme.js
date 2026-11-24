// Theme toggle: follows the OS until the visitor picks a theme, then remembers it.
// Loaded as a classic script in <head> so the stored theme applies before first paint.
(function () {
  var KEY = 'hw-theme';
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* storage unavailable: just follow the OS */ }

  function current() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function label() { return current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'; }

  function paint(btn) {
    btn.innerHTML = current() === 'dark' ? SUN : MOON;
    btn.setAttribute('aria-label', label());
    btn.title = label();
  }

  // layout.js renders the header with the icon already in place, so it never blinks while the page's scripts run
  window.hwTheme = {
    button: function () {
      return '<button class="theme-toggle" type="button" aria-label="' + label() + '" title="' + label() + '">' +
        (current() === 'dark' ? SUN : MOON) + '</button>';
    },
  };

  // delegated, so it works as soon as the button exists, before the page's scripts have finished
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (!btn) return;
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* ignore */ }
    paint(btn);
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  });
})();
