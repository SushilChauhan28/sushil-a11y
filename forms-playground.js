/* ═══════════════════════════════════════════════════════════════
   ACCESSIBLE FORMS PLAYGROUND — page script
   accessible-forms-playground.html
   Colour scheme is handled by the shared script.js; nothing here
   touches data-scheme.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scrollBehavior = function () { return reducedMotion.matches ? 'auto' : 'smooth'; };

  /* Visible text of an element, minus aria-hidden parts (e.g. the "*" in labels). */
  function textOf(el) {
    var clone = el.cloneNode(true);
    $$('[aria-hidden="true"]', clone).forEach(function (n) { n.remove(); });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }
  function idsToText(list) {
    return (list || '').split(/\s+/).filter(Boolean).map(function (id) {
      var n = document.getElementById(id);
      return n && !n.hidden ? textOf(n) : '';
    }).filter(Boolean).join(' ');
  }
  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  /* ── Syntax colouring ───────────────────────────────────────────
     innerHTML is already entity-escaped (&lt; &quot;), so match on the
     entities. Re-escaping would double-encode and print "&lt;". */
  $$('.fp-page pre code').forEach(function (block) {
    block.innerHTML = block.innerHTML
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>')
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>')
      .replace(/([\w-]+)(=)(&quot;)/g, '<span class="hl-attr">$1</span>$2$3');
  });

  /* ── Scrollable tables and code ─────────────────────────────────
     A region that scrolls horizontally must be reachable by keyboard,
     but a focus stop on one that does not scroll is just noise. So the
     tab stop (and the region role it needs for a name) is added only
     while the content actually overflows. */
  // Region names must be unique (landmark-unique), so code blocks are named
  // after the nearest heading above them plus a running number.
  var headings = $$('main h2, main h3, main h4');
  function codeRegionName(pre, n) {
    var near = headings.filter(function (h) {
      return h.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING;
    }).pop();
    return 'Code example ' + n + (near ? ': ' + textOf(near) : '') + ' (scrollable)';
  }
  function syncScrollRegions() {
    var preCount = 0;
    $$('.fp-page .table-wrap, .fp-page pre').forEach(function (el) {
      if (el.tagName === 'PRE') preCount++;
      var overflows = el.scrollWidth > el.clientWidth + 1;
      if (overflows && !el.hasAttribute('tabindex')) {
        var cap = el.tagName === 'PRE' ? null : $('caption', el);
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', cap ? textOf(cap) + ' (scrollable)' : codeRegionName(el, preCount));
      } else if (!overflows && el.hasAttribute('tabindex')) {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
      }
    });
  }
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncScrollRegions, 150);
  });

  /* ── Disclosures ────────────────────────────────────────────────
     Markup ships expanded so the content is readable without script;
     collapse here. `hidden` removes collapsed code from both the tab
     order and the accessibility tree in one step. */
  $$('.fp-disclosure-btn').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      if (!open) syncScrollRegions();
    });
  });

  /* ── Demo form ──────────────────────────────────────────────── */
  var form = $('#demoForm');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE = /^\+?[\d\s\-()]{7,20}$/;
  var MESSAGES = {
    'demo-firstname':        { required: 'Enter your first name' },
    'demo-lastname':         { required: 'Enter your last name' },
    'demo-email':            { required: 'Enter your email address',
                               format:   'Enter an email address in the correct format, like name@example.com' },
    'demo-phone':            { required: 'Enter your phone number',
                               format:   'Enter a phone number using digits, spaces, brackets, + or -, like +1 555 123 4567' },
    'demo-password':         { required: 'Enter a password',
                               format:   'Password must be at least 8 characters' },
    'demo-confirm-password': { required: 'Re-enter your password to confirm it',
                               format:   'Passwords do not match. Enter the same password in both fields' },
    'demo-country':          { required: 'Select the country where you live' },
    'demo-dept':             { required: 'Select your department' },
    'demo-terms':            { required: 'Agree to the Terms of Service and Privacy Policy to continue' }
  };

  if (form) {
    var fields    = $$('[required]', form);
    var pw        = $('#demo-password');
    var pwConfirm = $('#demo-confirm-password');
    var summary   = $('#errorSummary');
    var success   = $('#formSuccess');
    var status    = $('#formStatus');

    var problemWith = function (el) {
      var m = MESSAGES[el.id] || { required: 'This field is required' };
      if (el.type === 'checkbox') return el.checked ? '' : m.required;
      var raw = el.value;
      var v = el.type === 'password' ? raw : raw.trim();
      if (!v) return el.required ? m.required : '';
      if (el.type === 'email' && !EMAIL.test(v)) return m.format;
      if (el.type === 'tel' && !PHONE.test(v)) return m.format;
      if (el === pw && v.length < 8) return m.format;
      if (el === pwConfirm && v !== pw.value) return m.format;
      return '';
    };

    var setError = function (el, msg) {
      var err = document.getElementById(el.id + '-error');
      if (!err) return;
      var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== err.id; });
      if (msg) {
        // Built with nodes, not innerHTML: messages never become markup.
        var icon = document.createElement('span');
        icon.className = 'fp-error-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '!';
        var prefix = document.createElement('span');
        prefix.className = 'sr-only'; prefix.textContent = 'Error: ';
        var text = document.createElement('span');
        text.append(prefix, msg);
        err.replaceChildren(icon, text);
        err.hidden = false;
        // No role="alert" per field: the message is read with the field on focus,
        // and the summary gives the one announcement on submit.
        el.setAttribute('aria-invalid', 'true');
        ids.push(err.id);
      } else {
        err.hidden = true;
        err.replaceChildren();
        el.removeAttribute('aria-invalid');
      }
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    var validate = function (el) { var msg = problemWith(el); setError(el, msg); return msg; };

    // Validate a single field on blur only once the user has typed in it, so
    // Tabbing through an empty form does not spray errors. Once a field is in
    // error, re-check as they type so the message clears the moment it is fixed.
    fields.forEach(function (el) {
      var evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function () {
        el.dataset.touched = 'true';
        if (el.getAttribute('aria-invalid') === 'true') validate(el);
        if (el === pw && pwConfirm.dataset.touched && pwConfirm.value) validate(pwConfirm);
      });
      el.addEventListener('blur', function () { if (el.dataset.touched) validate(el); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errors = [];
      fields.forEach(function (el) {
        var msg = validate(el);
        if (msg) errors.push({ id: el.id, msg: msg });
      });
      status.textContent = '';
      if (errors.length) {
        success.hidden = true;
        $('#errorSummaryCount').textContent = errors.length === 1 ? '1 field needs your attention.' : errors.length + ' fields need your attention.';
        $('#errorSummaryList').replaceChildren.apply($('#errorSummaryList'), errors.map(function (er) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#' + er.id; a.textContent = er.msg;
          li.append(a);
          return li;
        }));
        summary.hidden = false;
        summary.focus();
      } else {
        summary.hidden = true;
        success.hidden = false;
        // Focus stays on Submit; the result is announced as a status message (4.1.3).
        status.textContent = 'Application submitted. Every field passed validation.';
      }
      runChecks();
    });

    // Summary links: focus the field, and scroll its label (or legend) into
    // view — jumping straight to the input can leave the label off-screen.
    summary.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var field = document.getElementById(link.getAttribute('href').slice(1));
      if (!field) return;
      e.preventDefault();
      var label = $('label[for="' + field.id + '"]') || field.closest('fieldset');
      field.focus({ preventScroll: true });
      (label || field).scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    });

    $('#demoClear').addEventListener('click', function () {
      form.reset();
      fields.forEach(function (el) { setError(el, ''); delete el.dataset.touched; });
      $$('.fp-reveal', form).forEach(function (btn) {
        btn.setAttribute('aria-pressed', 'false');
        document.getElementById(btn.getAttribute('aria-controls')).type = 'password';
      });
      summary.hidden = true;
      success.hidden = true;
      updateStrength();
      $$('textarea[maxlength]', form).forEach(function (t) { t.dispatchEvent(new Event('input')); });
      runChecks();
      status.textContent = 'Form cleared.';
      $('#demo-firstname').focus();
    });

    /* Show / hide password. The name stays "Show password"; aria-pressed
       carries the state, so the button never announces the opposite of
       what it does. */
    $$('.fp-reveal', form).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('aria-controls'));
        var show = btn.getAttribute('aria-pressed') !== 'true';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
      });
    });

    /* Password strength: bar is decorative, the text is the information. */
    var LEVELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
    var bar = $('#pw-strength-bar');
    var strengthText = $('#demo-pw-strength');
    var updateStrength = function () {
      var v = pw.value;
      var score = 0;
      if (v.length >= 8) score++;
      if (v.length >= 12) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      var idx = Math.min(score, LEVELS.length - 1);
      bar.style.width = v ? ((idx + 1) * 20) + '%' : '0';
      bar.dataset.level = v ? idx : '';
      var next = v ? 'Strength: ' + LEVELS[idx] : '';
      // Rewriting identical text still re-announces in some screen readers.
      if (strengthText.textContent !== next) strengthText.textContent = next;
    };
    pw.addEventListener('input', updateStrength);

    /* Character counts. The visible counter is the field's description; a
       separate hidden live region speaks only in the last 20 characters,
       debounced, so a fast typist is not talked over. */
    $$('textarea[maxlength]', form).forEach(function (t) {
      var max = parseInt(t.getAttribute('maxlength'), 10);
      var counter = document.getElementById(t.id + '-count');
      var live = document.createElement('p');
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      counter.after(live);
      var timer;
      t.addEventListener('input', function () {
        var left = max - t.value.length;
        counter.textContent = t.value.length
          ? (left === 0 ? 'Character limit reached (' + max + ')' : left + ' of ' + max + ' characters remaining')
          : 'You can enter up to ' + max + ' characters';
        counter.classList.toggle('is-near', left <= 20);
        clearTimeout(timer);
        timer = setTimeout(function () {
          live.textContent = left <= 20 ? (left === 0 ? 'Character limit reached' : left + ' characters remaining') : '';
        }, 600);
      });
    });
  }

  /* ── Accessibility inspector ────────────────────────────────── */
  var inspector = $('#a11yInspector');
  var toggles = $$('.fp-inspector-toggle');
  var lastToggle = null;

  var IMPLICIT_INPUT_ROLES = {
    text: 'textbox', email: 'textbox', tel: 'textbox', url: 'textbox', password: 'none (password field)',
    search: 'searchbox', number: 'spinbutton', range: 'slider', checkbox: 'checkbox', radio: 'radio',
    button: 'button', submit: 'button', reset: 'button', image: 'button',
    date: 'browser date control', time: 'browser time control', color: 'browser colour control', file: 'browser file control'
  };
  function roleOf(el) {
    var explicit = el.getAttribute('role');
    if (explicit) return explicit.split(/\s+/)[0] + ' (explicit)';
    var tag = el.tagName;
    if (tag === 'INPUT') {
      if (el.hasAttribute('list')) return 'combobox';
      return IMPLICIT_INPUT_ROLES[el.type] || 'textbox';
    }
    if (tag === 'SELECT') return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
    if (tag === 'TEXTAREA') return 'textbox (multi-line)';
    if (tag === 'BUTTON') return 'button';
    if (tag === 'A') return el.hasAttribute('href') ? 'link' : 'generic';
    if (/^H[1-6]$/.test(tag)) return 'heading, level ' + tag[1];
    if (tag === 'PRE' || tag === 'DIV' || tag === 'SECTION') return el.getAttribute('role') || 'generic';
    return tag.toLowerCase();
  }
  // Follows the accessible name computation's precedence for the markup on
  // this page; not a full implementation.
  function accName(el) {
    var byIds = idsToText(el.getAttribute('aria-labelledby'));
    if (byIds) return { name: byIds, from: 'aria-labelledby' };
    var label = (el.getAttribute('aria-label') || '').trim();
    if (label) return { name: label, from: 'aria-label' };
    if (el.labels && el.labels.length) {
      return { name: Array.prototype.map.call(el.labels, textOf).join(' '), from: '<label>' };
    }
    if (/^(BUTTON|A|H[1-6])$/.test(el.tagName)) {
      var content = textOf(el);
      if (content) return { name: content, from: 'content' };
    }
    if (el.title) return { name: el.title, from: 'title' };
    if (el.placeholder) return { name: el.placeholder, from: 'placeholder — not a label' };
    return { name: '', from: '' };
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  function inspect(el) {
    if (!el || el === document.body || el === document.documentElement || inspector.contains(el)) return;
    var tag = el.tagName.toLowerCase();
    setText('insp-tag', tag === 'input' ? 'input type="' + el.type + '"' : tag);
    var n = accName(el);
    setText('insp-name', n.name ? n.name + '  (from ' + n.from + ')' : 'None — no accessible name');
    setText('insp-role', roleOf(el));
    setText('insp-desc', idsToText(el.getAttribute('aria-describedby')) || '—');
    setText('insp-required', el.required || el.getAttribute('aria-required') === 'true' ? 'Yes' : 'No');
    setText('insp-invalid', el.getAttribute('aria-invalid') === 'true' ? 'Yes (aria-invalid="true")' : 'No');
    setText('insp-autocomplete', el.getAttribute('autocomplete') || '—');
    var aria = Array.prototype.filter.call(el.attributes, function (a) { return a.name.indexOf('aria-') === 0; })
      .map(function (a) { return a.name + '="' + a.value + '"'; });
    setText('insp-aria', aria.length ? aria.join(', ') : '—');
  }

  // Keep the focused element clear of the floating panel (2.4.11).
  function keepClearOfPanel(el) {
    if (inspector.hidden || !el.getBoundingClientRect) return;
    var a = el.getBoundingClientRect();
    var b = inspector.getBoundingClientRect();
    var overlaps = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    if (overlaps) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function setInspector(open, returnFocus) {
    inspector.hidden = !open;
    toggles.forEach(function (t) { t.setAttribute('aria-expanded', String(open)); });
    // Browsers honour scroll-padding when scrolling a newly focused control
    // into view, so fields are revealed above the panel rather than under it.
    document.documentElement.style.scrollPaddingBottom = open ? (inspector.offsetHeight + 24) + 'px' : '';
    if (open) inspect(document.activeElement);
    if (!open && returnFocus && lastToggle) lastToggle.focus();
  }

  if (inspector) {
    toggles.forEach(function (t) {
      t.addEventListener('click', function () { lastToggle = t; setInspector(inspector.hidden); });
    });
    $('#inspectorClose').addEventListener('click', function () { setInspector(false, true); });
    // Escape closes only while focus is in the panel: pressing Escape in a form
    // field (e.g. to clear a search box) must not yank focus somewhere else.
    inspector.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); setInspector(false, true); }
    });
    document.addEventListener('focusin', function (e) {
      if (inspector.hidden) return;   // closed: inspects nothing, announces nothing
      inspect(e.target);
      keepClearOfPanel(e.target);
    });
  }

  /* ── Live checker ───────────────────────────────────────────── */
  var active = {};
  var scopeSelect = $('#checkerScope');
  var results = $('#checkerResults');
  var checkerStatus = $('#checkerStatus');

  var CONTROL_SEL = 'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]), select, textarea';
  var TEXT_SEL = 'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]), select, textarea';

  function scopeRoot() {
    return scopeSelect && scopeSelect.value === 'page' ? $('main') : form;
  }
  function labelFor(el) { return accName(el).name || (el.name ? 'Field "' + el.name + '"' : 'Unnamed ' + el.tagName.toLowerCase()); }

  var CHECKS = {
    labels: {
      title: 'Missing labels',
      run: function (root) {
        return $$(CONTROL_SEL, root).filter(function (el) {
          var n = accName(el);
          return !n.name || n.from.indexOf('placeholder') === 0 || n.from === 'title';
        }).map(function (el) { return { el: el, msg: labelFor(el) + ' has no label (' + (accName(el).from || 'no name at all') + ')' }; });
      }
    },
    instructions: {
      title: 'Missing instructions',
      run: function (root) {
        return $$(TEXT_SEL, root).filter(function (el) {
          return !idsToText(el.getAttribute('aria-describedby'));
        }).map(function (el) { return { el: el, msg: labelFor(el) + ' has no associated help text' }; });
      }
    },
    grouping: {
      title: 'Missing grouping',
      run: function (root) {
        var byName = {};
        $$('input[type="radio"], input[type="checkbox"]', root).forEach(function (el) {
          if (!el.name) return;
          (byName[el.name] = byName[el.name] || []).push(el);
        });
        return Object.keys(byName).filter(function (name) {
          var set = byName[name];
          if (set.length < 2) return false;
          var group = set[0].closest('fieldset, [role="group"], [role="radiogroup"]');
          var named = group && (group.tagName === 'FIELDSET' ? $('legend', group) : (group.getAttribute('aria-label') || group.getAttribute('aria-labelledby')));
          return !named;
        }).map(function (name) {
          var set = byName[name];
          return { el: set[0].closest('.fp-choices') || set[0], focus: set[0], msg: set.length + ' ' + set[0].type + ' buttons named "' + name + '" are not in a fieldset with a legend' };
        });
      }
    },
    aria: {
      title: 'ARIA problems',
      run: function (root) {
        var found = [];
        $$('*', root).forEach(function (el) {
          ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-errormessage'].forEach(function (attr) {
            var val = el.getAttribute(attr);
            if (!val) return;
            val.split(/\s+/).forEach(function (id) {
              if (id && !document.getElementById(id)) found.push({ el: el, msg: labelFor(el) + ': ' + attr + ' points to "' + id + '", which does not exist' });
            });
          });
          if (el.getAttribute('aria-invalid') === 'true' && !idsToText(el.getAttribute('aria-describedby')) && !el.getAttribute('aria-errormessage')) {
            found.push({ el: el, msg: labelFor(el) + ' is marked invalid but no error message is associated with it' });
          }
          if (el.required && el.getAttribute('aria-required') === 'true') {
            found.push({ el: el, msg: labelFor(el) + ': aria-required is redundant with the native required attribute' });
          }
          if (el.hasAttribute('aria-label') && el.labels && el.labels.length) {
            found.push({ el: el, msg: labelFor(el) + ': aria-label overrides its visible <label> (2.5.3 risk)' });
          }
        });
        return found;
      }
    },
    errors: {
      title: 'Current errors',
      run: function (root) {
        return $$('[aria-invalid="true"]', root).map(function (el) {
          var desc = idsToText(el.getAttribute('aria-describedby'));
          return { el: el, msg: labelFor(el) + (desc ? ' — ' + desc : ' — invalid, with no message') };
        });
      }
    }
  };

  function runChecks() {
    if (!results) return;
    $$('.fp-flag').forEach(function (el) { el.classList.remove('fp-flag'); });
    var root = scopeRoot();
    var blocks = [];
    Object.keys(CHECKS).forEach(function (key) {
      if (!active[key]) return;
      var issues = CHECKS[key].run(root);
      var block = document.createElement('div');
      block.className = 'fp-result' + (issues.length ? ' has-issues' : '');
      var h = document.createElement('h4');
      h.textContent = CHECKS[key].title;
      var p = document.createElement('p');
      p.textContent = issues.length === 0 ? 'No issues found.' : issues.length + (issues.length === 1 ? ' issue found:' : ' issues found:');
      block.append(h, p);
      if (issues.length) {
        var ul = document.createElement('ul');
        issues.forEach(function (issue) {
          issue.el.classList.add('fp-flag');
          var target = issue.focus || issue.el;
          if (!target.id) target.id = 'fp-flag-' + Math.random().toString(36).slice(2, 8);
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#' + target.id;
          a.textContent = issue.msg;
          li.append(a);
          ul.append(li);
        });
        block.append(ul);
      }
      blocks.push(block);
    });
    results.replaceChildren.apply(results, blocks);
    return blocks;
  }

  $$('[data-check]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.check;
      active[key] = !active[key];
      btn.setAttribute('aria-pressed', String(active[key]));
      runChecks();
      if (active[key]) {
        var count = CHECKS[key].run(scopeRoot()).length;
        checkerStatus.textContent = CHECKS[key].title + ': ' + (count === 0 ? 'no issues found.' : count + (count === 1 ? ' issue found.' : ' issues found.'));
      } else {
        checkerStatus.textContent = CHECKS[key].title + ' check turned off.';
      }
    });
  });
  if (scopeSelect) {
    scopeSelect.addEventListener('change', function () {
      runChecks();
      var total = $$('.fp-result li', results).length;
      if (Object.keys(active).some(function (k) { return active[k]; })) {
        checkerStatus.textContent = 'Rescanned. ' + total + (total === 1 ? ' issue' : ' issues') + ' across active checks.';
      }
    });
  }
  // Result links: move focus to the flagged element, which may not be natively focusable.
  if (results) {
    results.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      if (target.tabIndex < 0 && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    });
  }

  /* ── Quiz ───────────────────────────────────────────────────────
     Native radios in a fieldset, plus an explicit Check button. Grading on
     `change` would reveal the answer as soon as an arrow key moved the
     selection, because arrows select as they move in a radio group. */
  var quizCards = $$('.fp-quiz-card');
  var quizState = {};
  function updateScore() {
    var ids = Object.keys(quizState);
    var right = ids.filter(function (k) { return quizState[k]; }).length;
    var score = $('#quizScore');
    if (score) score.textContent = ids.length + ' of ' + quizCards.length + ' answered · ' + right + ' correct';
  }
  function clearMarks(card) {
    $$('.fp-opt', card).forEach(function (o) {
      o.classList.remove('is-correct', 'is-wrong');
      var tag = $('.fp-opt-tag', o);
      if (tag) tag.remove();
    });
  }
  function tag(opt, text) {
    var s = document.createElement('span');
    s.className = 'fp-opt-tag';
    s.textContent = text;
    // The leading space keeps the accessible name "… Relationships Correct answer",
    // not "…RelationshipsCorrect answer" — margins do not create word breaks.
    $('span', opt).append(' ', s);
  }
  quizCards.forEach(function (card, i) {
    var correct = card.dataset.correct;
    var feedback = $('.fp-quiz-feedback', card);
    var explain = textOf($('.fp-quiz-explain', card));
    $('.fp-quiz-check', card).addEventListener('click', function () {
      var chosen = $('input:checked', card);
      clearMarks(card);
      if (!chosen) {
        feedback.textContent = 'Choose an answer first.';
        return;
      }
      var ok = chosen.value === correct;
      var right = $('input[value="' + correct + '"]', card).closest('.fp-opt');
      right.classList.add('is-correct');
      tag(right, 'Correct answer');
      if (!ok) { chosen.closest('.fp-opt').classList.add('is-wrong'); tag(chosen.closest('.fp-opt'), 'Your answer'); }
      var inner = document.createElement('div');
      inner.className = 'expl-inner';
      var lbl = document.createElement('p');
      lbl.className = 'expl-lbl';
      lbl.textContent = ok ? '✓ Correct' : '✗ Not quite — the answer is: ' + textOf(right).replace(/Correct answer$/, '').trim();
      var body = document.createElement('p');
      body.className = 'expl-text';
      body.textContent = explain;
      inner.append(lbl, body);
      feedback.replaceChildren(inner);
      quizState[i] = ok;
      updateScore();
    });
    // A new choice makes the old verdict stale.
    $$('input', card).forEach(function (r) {
      r.addEventListener('change', function () { clearMarks(card); feedback.replaceChildren(); });
    });
  });
  var quizReset = $('#quizReset');
  if (quizReset) {
    quizReset.addEventListener('click', function () {
      quizCards.forEach(function (card) {
        $$('input', card).forEach(function (r) { r.checked = false; });
        clearMarks(card);
        $('.fp-quiz-feedback', card).replaceChildren();
      });
      quizState = {};
      updateScore();
      var first = $('.fp-quiz-card input');
      if (first) first.focus();
    });
  }

  /* ── Final checklist (persisted per browser) ────────────────── */
  var CHECK_KEY = 'fp-checklist';
  var ticks = store(CHECK_KEY) || {};
  var groups = $$('.fp-checkgroup');
  function updateProgress(group) {
    var boxes = $$('input[type="checkbox"]', group);
    var done = boxes.filter(function (b) { return b.checked; }).length;
    $('.fp-check-progress', group).textContent = done + ' of ' + boxes.length + ' checked';
  }
  groups.forEach(function (group) {
    $$('input[type="checkbox"]', group).forEach(function (box) {
      box.checked = !!ticks[box.dataset.key];
      box.addEventListener('change', function () {
        ticks[box.dataset.key] = box.checked;
        store(CHECK_KEY, ticks);
        updateProgress(group);
      });
    });
    updateProgress(group);
  });
  var checklistReset = $('#checklistReset');
  if (checklistReset) {
    checklistReset.addEventListener('click', function () {
      ticks = {};
      store(CHECK_KEY, ticks);
      groups.forEach(function (g) {
        $$('input[type="checkbox"]', g).forEach(function (b) { b.checked = false; });
        updateProgress(g);
      });
      $('#checklistStatus').textContent = 'All checklist ticks cleared.';
    });
  }

  /* ── Back to top ────────────────────────────────────────────────
     Hidden (not just transparent) until needed, so it is never an invisible
     tab stop. On activation focus moves to the page heading first; otherwise
     the button would hide itself while focused and drop focus to <body>. */
  var btt = $('#backToTop');
  if (btt) {
    var ticking = false;
    var syncBtt = function () { btt.hidden = window.scrollY < 600; ticking = false; };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(syncBtt); }
    }, { passive: true });
    btt.addEventListener('click', function () {
      $('#fp-title').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });
    syncBtt();
  }

  syncScrollRegions();
}());
