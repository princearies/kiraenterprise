/**
 * Kira Enterprise V4 — Shared Utilities
 */
(function (global) {
  'use strict';

  function formatMoney(num) {
    return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  var Utils = {
    formatMoney: formatMoney,
    todayISO: todayISO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Utils: Utils };
  global.Utils = Utils;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));