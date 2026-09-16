/**
 * Kira Enterprise V4 — Capital Allowance (LHDN rates, client-scoped)
 * Computes initial allowance from asset account balances in the Ledger.
 */
(function (global) {
  'use strict';

  function formatRM(num) {
    return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var ASSET_CLASSES = [
    { code: '1510', name: 'Motor Vehicles', rate: 20 },
    { code: '1520', name: 'Furniture & Fittings', rate: 15 },
    { code: '1530', name: 'Office Equipment', rate: 10 },
    { code: '1535', name: 'Computer & IT', rate: 20 }
  ];

  function generateCapitalAllowance(clientId) {
    return new Promise(function (resolve) {
      if (!global.Ledger || !global.Ledger.getAccountBalance) {
        return resolve({ html: '<p>Capital Allowance module tidak dimuat.</p>', rows: [], total: 0 });
      }
      var promises = ASSET_CLASSES.map(function (c) { return global.Ledger.getAccountBalance(clientId, c.code); });
      Promise.all(promises).then(function (amounts) {
        var rows = ASSET_CLASSES.map(function (c, i) {
          var cost = Math.abs(amounts[i] || 0);
          return { code: c.code, name: c.name, rate: c.rate, cost: cost, allowance: cost > 0 ? Math.round(cost * c.rate / 100) : 0 };
        });
        var total = rows.reduce(function (s, r) { return s + r.allowance; }, 0);

        var html = '<div class="report-header"><h2 class="report-company">CAPITAL ALLOWANCE</h2><p class="report-title">Initial Allowance — Client: ' + (clientId || '') + '</p></div>';
        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
        html += '<tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left" style="padding:6px;">Aset</th><th align="right" style="padding:6px;">Kos (RM)</th><th align="right" style="padding:6px;">Kadar IA</th><th align="right" style="padding:6px;">ELAUN (RM)</th></tr>';
        rows.forEach(function (r) {
          html += '<tr><td style="padding:6px;border-bottom:1px solid #334155;">' + r.name + ' (' + r.code + ')</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + formatRM(r.cost) + '</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + r.rate + '%</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + formatRM(r.allowance) + '</td></tr>';
        });
        html += '<tr style="font-weight:bold;background:#1e293b;"><td colspan="3" style="padding:6px;">TOTAL CAPITAL ALLOWANCE</td><td align="right" style="padding:6px;">' + formatRM(total) + '</td></tr>';
        html += '</table>';

        resolve({ html: html, rows: rows, total: total });
      }).catch(function () {
        resolve({ html: '<p>Gagal menjana Capital Allowance.</p>', rows: [], total: 0 });
      });
    });
  }

  var CapitalAllowance = {
    generateCapitalAllowance: generateCapitalAllowance,
    renderCA: function (opts) {
      // Backwards-compatible sync wrapper (renders placeholder; async version preferred)
      return '<p>Capital Allowance — guna App untuk paparan penuh.</p>';
    },
    formatRM: formatRM
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { CapitalAllowance: CapitalAllowance };
  global.CapitalAllowance = CapitalAllowance;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));