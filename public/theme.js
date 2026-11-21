(function () {
  var KEY = 'fd_theme';

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function updateButton(theme) {
    var b = document.getElementById('theme-toggle');
    if (!b) return;
    var target = theme === 'dark' ? 'light' : 'dark';
    b.textContent = theme === 'dark' ? 'Light' : 'Dark';
    b.setAttribute('aria-label', 'Switch to ' + target + ' theme');
    b.setAttribute('title', 'Switch to ' + target + ' theme');
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    updateButton(theme);
  }

  function init() {
    updateButton(current());
    var b = document.getElementById('theme-toggle');
    if (b) {
      b.addEventListener('click', function () {
        apply(current() === 'dark' ? 'light' : 'dark');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();