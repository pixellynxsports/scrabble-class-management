/* Banting Scrabble Academy appearance control — visual preferences only.
   No authentication, database, payment or class logic is changed. */
(function () {
  'use strict';
  var KEY = 'scms-appearance-v1';
  var preference = 'auto';
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') preference = saved;
  } catch (_) { /* Private browsing can disable storage. */ }

  function effectiveMode() {
    if (preference !== 'auto') return preference;
    var hour = new Date().getHours();
    return (hour >= 19 || hour < 7) ? 'dark' : 'light';
  }

  function paint() {
    var mode = effectiveMode();
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-setting', preference);
    document.documentElement.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#101d30' : '#f3f7fc');
    document.querySelectorAll('[data-appearance-picker]').forEach(function (picker) {
      if (picker.value !== preference) picker.value = preference;
    });
    document.querySelectorAll('[data-appearance-option]').forEach(function (button) {
      var active = button.getAttribute('data-appearance-option') === preference;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
      var group = button.closest('.appearance-control');
      button.setAttribute('aria-hidden', group && !group.classList.contains('is-expanded') && !active ? 'true' : 'false');
    });
  }
  function selectPreference(next) {
    if (next !== 'auto' && next !== 'light' && next !== 'dark') return;
    preference = next;
    try { window.localStorage.setItem(KEY, preference); } catch (_) {}
    paint();
  }
  // Apply preference before the page's CSS is parsed, avoiding a light-mode flash.
  paint();
  document.addEventListener('DOMContentLoaded', function () {
    paint();
    document.querySelectorAll('[data-appearance-picker]').forEach(function (picker) {
      picker.addEventListener('change', function () { selectPreference(picker.value); });
    });
    // A fixed-size circular control that opens leftwards without moving the header.
    // Mouse hover, keyboard focus and touch activation all expose the same three modes.
    function expandAppearance(group, expanded) {
      if (!group) return;
      group.classList.toggle('is-expanded', Boolean(expanded));
      group.querySelectorAll('[data-appearance-option]').forEach(function (option) {
        // Collapsed alternatives are visually hidden and not announced as choices.
        var exposed = Boolean(expanded) || option.classList.contains('is-active');
        option.setAttribute('aria-hidden', exposed ? 'false' : 'true');
      });
    }
    var lastInputWasKeyboard = false;
    document.addEventListener('keydown', function () { lastInputWasKeyboard = true; });
    document.addEventListener('pointerdown', function () { lastInputWasKeyboard = false; });
    document.querySelectorAll('.appearance-control').forEach(function (group) {
      expandAppearance(group, false);
      var lastPointerType = 'mouse';
      group.addEventListener('pointerenter', function (event) {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') expandAppearance(group, true);
      });
      group.addEventListener('pointerleave', function (event) {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') expandAppearance(group, false);
      });
      group.addEventListener('pointerdown', function (event) { lastPointerType = event.pointerType; });
      group.addEventListener('focusin', function () {
        if (lastInputWasKeyboard) expandAppearance(group, true);
      });
      group.addEventListener('focusout', function (event) {
        if (!group.contains(event.relatedTarget)) expandAppearance(group, false);
      });
      group.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        expandAppearance(group, false);
        var active = group.querySelector('[data-appearance-option].is-active');
        if (active) active.focus();
      });
      group.querySelectorAll('[data-appearance-option]').forEach(function (button) {
        button.addEventListener('click', function () {
          var next = button.getAttribute('data-appearance-option');
          if (!group.classList.contains('is-expanded')) {
            // First tap on the collapsed circle reveals the available modes.
            expandAppearance(group, true);
            return;
          }
          selectPreference(next);
          if (lastPointerType === 'touch') {
            expandAppearance(group, false);
            button.blur();
          }
        });
        button.addEventListener('keydown', function (event) {
          var key = event.key;
          if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'ArrowDown' && key !== 'ArrowUp') return;
          event.preventDefault();
          expandAppearance(group, true);
          var order = ['light','auto','dark'];
          var current = button.getAttribute('data-appearance-option');
          var index = order.indexOf(current);
          if (index === -1) return;
          if (key === 'ArrowRight' || key === 'ArrowDown') index = (index + 1) % order.length;
          else index = (index + order.length - 1) % order.length;
          selectPreference(order[index]);
          // Look only in this switch: avoid focusing a hidden login or parent switch.
          var nextButton = group.querySelector('[data-appearance-option="' + order[index] + '"]');
          if (nextButton) nextButton.focus();
        });
      });
    });
    document.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'touch' || event.target.closest('.appearance-control')) return;
      document.querySelectorAll('.appearance-control.is-expanded').forEach(function (group) {
        expandAppearance(group, false);
      });
    });
    // The Auto mode follows local clock even when the tab stays open overnight.
    window.setInterval(function () { if (preference === 'auto') paint(); }, 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && preference === 'auto') paint();
    });
  });
  window.ScrabbleAppearance = { set: selectPreference, refresh: paint };
}());
