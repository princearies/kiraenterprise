/**
 * Kira Enterprise V4 — Trial Balance Generator
 * Reads ledger balances from Storage and builds a debit/credit trial balance.
 */
(function (global) {
  'use strict';

  function formatRM(num) {
    return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function generateTrialBalance(clientId) {
    return new Promise(function (resolve) {
      if (!global.Ledger || !global.Ledger.generateGeneralLedger) {
        return resolve({ html: '<p>Trial Balance module tidak dimuat.</p>', rows: [], totalDebit: 0, totalCredit: 0, balanced: false });
      }
      global.Ledger.generateGeneralLedger(clientId).then(function (ledger) {
        var rows = (ledger || []).map(function (a) {
          return { code: a.code, name: a.name || '', debit: a.totalDebit || 0, credit: a.totalCredit || 0, balance: a.balance || 0 };
        });
        rows.sort(function (x, y) { return x.code < y.code ? -1 : x.code > y.code ? 1 : 0; });
        var totalDebit = rows.reduce(function (s, r) { return s + r.debit; }, 0);
        var totalCredit = rows.reduce(function (s, r) { return s + r.credit; }, 0);
        var balanced = Math.abs(totalDebit - totalCredit) < 0.01;

        var html = '<div class="report-header"><h2 class="report-company">TRIAL BALANCE</h2><p class="report-title client-id">Client: ' + (clientId || '') + '</p></div>';
        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
        html += '<tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left" style="padding:6px;">Kod</th><th align="left" style="padding:6px;">Akaun</th><th align="right" style="padding:6px;">Debit (RM)</th><th align="right" style="padding:6px;">Kredit (RM)</th></tr>';
        rows.forEach(function (r) {
          html += '<tr><td style="padding:6px;border-bottom:1px solid #334155;">' + r.code + '</td><td style="padding:6px;border-bottom:1px solid #334155;">' + r.name + '</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + (r.debit ? formatRM(r.debit) : '') + '</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + (r.credit ? formatRM(r.credit) : '') + '</td></tr>';
        });
        html += '<tr class="total" style="font-weight:bold;background:#1e293b;"><td colspan="2" style="padding:6px;">TOTAL</td><td align="right" style="padding:6px;">' + formatRM(totalDebit) + '</td><td align="right" style="padding:6px;">' + formatRM(totalCredit) + '</td></tr>';
        html += '<tr><td colspan="4" class="' + (balanced ? 'balanced' : '') + '" style="padding:6px;font-weight:bold;color:' + (balanced ? '#4ade80' : '#f87171') + ';">' + (balanced ? '✓ Balanced' : '✗ Not balanced — Diff: ' + formatRM(totalDebit - totalCredit)) + '</td></tr>';
        html += '</table>';

        resolve({ html: html, rows: rows, totalDebit: totalDebit, totalCredit: totalCredit, balanced: balanced });
      }).catch(function () {
        resolve({ html: '<p>Gagal menjana Trial Balance.</p>', rows: [], totalDebit: 0, totalCredit: 0, balanced: false });
      });
    });
  }

  var TrialBalance = {
    generateTrialBalance: generateTrialBalance,
    formatRM: formatRM
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { TrialBalance: TrialBalance };
  global.TrialBalance = TrialBalance;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));