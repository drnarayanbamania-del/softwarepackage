document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ── Theme Toggle ──
  var toggleBtn = document.getElementById('themeToggle');

  function getThemeIcon(theme) {
    return theme === 'dark' ? 'moon' : 'sun';
  }

  function applyTheme(theme, animate) {
    if (animate) {
      document.documentElement.classList.add('theme-transition');
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update toggle button icon
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i data-lucide="' + getThemeIcon(theme) + '"></i>';
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    if (animate) {
      setTimeout(function() {
        document.documentElement.classList.remove('theme-transition');
      }, 350);
    }
  }

  // Initialize theme (reads 'theme' or matches system prefers-color-scheme on first load)
  var savedTheme = localStorage.getItem('theme');
  var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var initialTheme = savedTheme || (systemDark ? 'dark' : 'light');
  applyTheme(initialTheme, false);

  // Toggle click and touch listeners for instant mobile responsiveness
  if (toggleBtn) {
    var handleToggle = function(e) {
      e.preventDefault();
      var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      var targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(targetTheme, true);
    };
    toggleBtn.addEventListener('click', handleToggle);
    toggleBtn.addEventListener('touchstart', handleToggle, { passive: false });
  }

  // Listen for OS theme changes (only if user hasn't explicitly set a preference)
  if (window.matchMedia) {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var mediaHandler = function() {
      if (!localStorage.getItem('theme')) {
        var systemDark = mediaQuery.matches;
        applyTheme(systemDark ? 'dark' : 'light', true);
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', mediaHandler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(mediaHandler);
    }
  }

  // ── Mobile Menu ──
  var nav = document.getElementById('nav');
  var burger = document.querySelector('.burger');

  if (nav && burger) {
    document.addEventListener('click', function(event) {
      if (!nav.contains(event.target) && !burger.contains(event.target)) {
        nav.classList.remove('open');
      }
    });
  }
});
