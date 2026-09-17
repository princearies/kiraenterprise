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
        return resolve({ 
          html: '<p style="color:#f87171;">Trial Balance module is not loaded.</p>', 
          rows: [], 
          totalDebit: 0, 
          totalCredit: 0, 
          balanced: false 
        });
      }

      global.Ledger.generateGeneralLedger(clientId).then(function (ledger) {
        var rows = (ledger || []).map(function (a) {
          var accName = a.name || '';
          if (!accName && global.ChartOfAccounts && global.ChartOfAccounts.getAccountName) {
            accName = global.ChartOfAccounts.getAccountName(a.code);
          }
          return { 
            code: a.code, 
            name: accName, 
            debit: a.totalDebit || 0, 
            credit: a.totalCredit || 0, 
            balance: a.balance || 0 
          };
        });

        rows.sort(function (x, y) { return x.code < y.code ? -1 : x.code > y.code ? 1 : 0; });
        
        var totalDebit = rows.reduce(function (s, r) { return s + r.debit; }, 0);
        var totalCredit = rows.reduce(function (s, r) { return s + r.credit; }, 0);
        var balanced = Math.abs(totalDebit - totalCredit) < 0.01;

        var html = '<div class="report-header" style="margin-bottom:16px;">' +
          '<h2 class="report-company" style="margin:0;color:#f3f4f6;">TRIAL BALANCE</h2>' +
          '<p class="report-title client-id" style="margin:4px 0 0 0;color:#9ca3af;">Client ID: ' + (clientId || '') + '</p>' +
          '</div>';

        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;background:#0f172a;border-radius:6px;overflow:hidden;">';
        html += '<thead><tr style="background:#334155;color:#fbbf24;font-weight:bold;">' +
          '<th align="left" style="padding:10px;">Code</th>' +
          '<th align="left" style="padding:10px;">Account Name</th>' +
          '<th align="right" style="padding:10px;">Debit (RM)</th>' +
          '<th align="right" style="padding:10px;">Credit (RM)</th>' +
          '</tr></thead><tbody>';

        if (rows.length === 0) {
          html += '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">No entries available for Trial Balance.</td></tr>';
        } else {
          rows.forEach(function (r) {
            html += '<tr style="border-bottom:1px solid #1e293b;">' +
              '<td style="padding:8px 10px;color:#e2e8f0;">' + r.code + '</td>' +
              '<td style="padding:8px 10px;color:#e2e8f0;">' + r.name + '</td>' +
              '<td align="right" style="padding:8px 10px;color:#e2e8f0;">' + (r.debit ? formatRM(r.debit) : '-') + '</td>' +
              '<td align="right" style="padding:8px 10px;color:#e2e8f0;">' + (r.credit ? formatRM(r.credit) : '-') + '</td>' +
              '</tr>';
          });
        }

        html += '</tbody><tfoot>';
        html += '<tr class="total" style="font-weight:bold;background:#1e293b;color:#f3f4f6;">' +
          '<td colspan="2" style="padding:10px;">TOTAL</td>' +
          '<td align="right" style="padding:10px;">' + formatRM(totalDebit) + '</td>' +
          '<td align="right" style="padding:10px;">' + formatRM(totalCredit) + '</td>' +
          '</tr>';

        html += '<tr><td colspan="4" class="' + (balanced ? 'balanced' : '') + '" style="padding:10px;font-weight:bold;text-align:center;color:' + (balanced ? '#4ade80' : '#f87171') + ';">' + 
          (balanced ? '✓ Balanced' : '✗ Unbalanced — Difference: ' + formatRM(Math.abs(totalDebit - totalCredit))) + 
          '</td></tr>';
        html += '</tfoot></table>';

        resolve({ 
          html: html, 
          rows: rows, 
          totalDebit: totalDebit, 
          totalCredit: totalCredit, 
          balanced: balanced 
        });
      }).catch(function () {
        resolve({ 
          html: '<p style="color:#f87171;">Failed to generate Trial Balance.</p>', 
          rows: [], 
          totalDebit: 0, 
          totalCredit: 0, 
          balanced: false 
        });
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
