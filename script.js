/* ═══════════════════════════════════════════════════════════════
   SUSHIL CHAUHAN — SHARED JAVASCRIPT
   sushilchauhan28.github.io/sushil-a11y
   ═══════════════════════════════════════════════════════════════ */

/* ── COLOR SCHEME TOGGLE ────────────────────────────────────────
   Uses native <input type="radio"> + <fieldset> + <legend>
   - Arrow keys navigate between options (native radio behaviour)
   - Screen reader: "Color scheme group — System, radio 1 of 3"
   - .is-selected class = fallback for browsers without :has()
   - Preference saved to localStorage key 'sc-scheme'
──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var html   = document.documentElement;
  var radios = document.querySelectorAll('.scheme-radio');
  var KEY    = 'sc-scheme';

  function applyScheme(s) {
    html.setAttribute('data-scheme', s);
    try { localStorage.setItem(KEY, s); } catch (e) {}

    radios.forEach(function (r) {
      var isSelected = r.value === s;
      r.checked = isSelected;
      var label = r.closest('.scheme-label');
      if (label) label.classList.toggle('is-selected', isSelected);
    });
  }

  /* Restore saved preference on page load */
  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  applyScheme(saved || 'system');

  /* Listen for radio change events */
  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (r.checked) applyScheme(r.value);
    });
  });
}());
