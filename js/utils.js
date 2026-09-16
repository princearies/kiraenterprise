/**
 * Kira Enterprise V4 — Utility Functions
 */
(function (global) {
  'use strict';

  var Utils = {
    showToast: function (msg) {
      var t = document.getElementById('toast');
      if (!t) {
        // Create toast if missing
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:#fff;padding:12px 20px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;display:none;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(function () { t.style.display = 'none'; }, 3000);
    },

    formatRM: function (num) {
      return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    escapeHtml: function (text) {
      if (typeof text !== 'string') return text || '';
      var d = document.createElement('div');
      d.textContent = text;
      return d.innerHTML;
    },

    generateId: function (prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    },

    parseNumber: function (val) {
      var n = parseFloat(val);
      return isNaN(n) ? 0 : n;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Utils: Utils };
  global.Utils = Utils;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
