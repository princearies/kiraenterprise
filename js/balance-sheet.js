/**
 * Kira Enterprise V4 — Balance Sheet Generator (MPERS / MFRS Small SME)
 * Computes real balances from the Ledger, retained earnings from P&L accounts,
 * and flags whether Assets = Liabilities + Equity.
 */
(function (global) {
  'use strict';

  function formatRM(num) {
    return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function generateBalanceSheet(clientId, opts) {
    opts = opts || {};
    var taxRate = (opts.taxRate === undefined || opts.taxRate === null || isNaN(parseFloat(opts.taxRate))) ? 24 : parseFloat(opts.taxRate);
    return new Promise(function (resolve, reject) {
      if (!global.Ledger || !global.Ledger.generateGeneralLedger) {
        return resolve({ rendered: false, html: '<p>Ledger module tidak dimuat.</p>', balanced: false });
      }
      global.Ledger.generateGeneralLedger(clientId).then(function (ledger) {
        var bal = {};
        (ledger || []).forEach(function (a) { bal[a.code] = a.balance; }); // debit - credit
        function b(code) { return bal[code] || 0; }
        function creditAmt(code) { return Math.abs(b(code)); }

        // ---- ASSETS ----
        var cashAtBank = b('1000');
        var bankOverdraft = cashAtBank < 0 ? -cashAtBank : 0;
        var cashDisplay = Math.max(0, cashAtBank);
        var petty = b('1010');
        var cashInHand = b('1020');
        var receivables = b('1100');
        var inventory = b('1200');
        var prepaid = b('1300');
        var fixedDeposits = b('1400');
        var motor = b('1510');
        var furniture = b('1520');
        var officeEquip = b('1530');
        var computerIT = b('1535');
        var accDep = creditAmt('1540') + creditAmt('1550');

        // ---- LIABILITIES & EQUITY ----
        var tradePayables = creditAmt('2000');
        var eis = creditAmt('2075');
        var hrdf = creditAmt('2085');
        var sst6 = creditAmt('2095');
        var sst8 = creditAmt('2096');
        var zakatPayable = creditAmt('2100');
        var longTermLoan = creditAmt('2200');
        var shareCapital = creditAmt('3000');

        // ---- Retained Earnings from P&L accounts ----
        function sumAbs(codes) {
          return codes.reduce(function (s, c) { return s + Math.abs(b(c)); }, 0);
        }
        var sales = creditAmt('4000');
        var costOfSales = sumAbs(['5000', '5010']) - creditAmt('5020');
        var grossProfit = sales - costOfSales;
        var expenses = sumAbs(['6000', '6010', '6020', '6025', '6035', '6100', '6110', '6130', '6160', '6170', '6210', '6220', '6230', '6300', '6901', '6902', '6903', '6904']);
        var zakatExp = sumAbs(['6905']);
        var netProfitBeforeTax = grossProfit - expenses;
        var tax = 0;
        if (netProfitBeforeTax > 0) {
          if (taxRate <= 0) tax = 0;
          else if (global.TaxComputation && global.TaxComputation.calculateSmeTax) tax = global.TaxComputation.calculateSmeTax(netProfitBeforeTax);
          else tax = Math.round(netProfitBeforeTax * taxRate / 100);
        }
        var retainedEarnings = netProfitBeforeTax - tax - zakatExp;

        // ---- Totals ----
        var currentAssets = [
          ['Cash at Bank (1000)', cashDisplay],
          ['Petty Cash (1010)', petty],
          ['Cash in Hand (1020)', cashInHand],
          ['Trade Receivables (1100)', receivables],
          ['Inventory (1200)', inventory],
          ['Prepaid Expenses (1300)', prepaid],
          ['Fixed Deposits (1400)', fixedDeposits]
        ];
        var totalCA = currentAssets.reduce(function (s, r) { return s + r[1]; }, 0);

        var nonCurrentAssets = [
          ['Motor Vehicles (1510)', motor],
          ['Furniture & Fittings (1520)', furniture],
          ['Office Equipment (1530)', officeEquip],
          ['Computer & IT (1535)', computerIT],
          ['Less: Accumulated Depreciation', -accDep]
        ];
        var totalNCA = nonCurrentAssets.reduce(function (s, r) { return s + r[1]; }, 0);
        var totalAssets = totalCA + totalNCA;

        var currentLiabilities = [
          ['Trade Payables (2000)', tradePayables],
          ['EIS Payable (2075)', eis],
          ['HRDF Payable (2085)', hrdf],
          ['SST Payable 6% (2095)', sst6],
          ['SST Payable 8% (2096)', sst8],
          ['Zakat Perniagaan Payable (2100)', zakatPayable]
        ];
        if (tax > 0) currentLiabilities.push(['Provision for Taxation (2050)', tax]);
        if (bankOverdraft > 0) currentLiabilities.push(['Bank Overdraft (1000)', bankOverdraft]);
        var totalCL = currentLiabilities.reduce(function (s, r) { return s + r[1]; }, 0);

        var nonCurrentLiabilities = [
          ['Long-term Loan (2200)', longTermLoan]
        ];
        var totalNCL = nonCurrentLiabilities.reduce(function (s, r) { return s + r[1]; }, 0);

        var equityItems = [
          ['Share Capital (3000)', shareCapital],
          ['Retained Earnings', retainedEarnings]
        ];
        var totalEquity = equityItems.reduce(function (s, r) { return s + r[1]; }, 0);
        var totalLiabEq = totalCL + totalNCL + totalEquity;
        var balanced = Math.abs(totalAssets - totalLiabEq) < 0.01;

        // ---- Build HTML ----
        function rowsHtml(rows) {
          var h = '';
          rows.forEach(function (r) {
            h += '<tr><td style="padding:6px;border-bottom:1px solid #334155;">' + r[0] + '</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + formatRM(r[1]) + '</td></tr>';
          });
          return h;
        }
        var companyName = opts.companyName || '';
        var html = '<div class="report-header">';
        if (companyName) html += '<h2>' + escapeHtml(companyName) + '</h2>';
        html += '<h2 class="report-company">BALANCE SHEET</h2><p class="report-title">As at ' + new Date().toLocaleDateString('en-GB') + '</p><p class="client-id">Client: ' + (clientId || '') + '</p></div>';
        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
        html += '<caption style="text-align:center;font-weight:bold;color:#fbbf24;margin:8px 0;font-size:1.1em;">ASSETS</caption>';
        html += '<tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left" style="padding:6px;">Item</th><th align="right" style="padding:6px;">RM</th></tr>';
        html += rowsHtml(currentAssets);
        html += '<tr style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Total Current Assets</td><td align="right" style="padding:6px;">' + formatRM(totalCA) + '</td></tr>';
        html += rowsHtml(nonCurrentAssets);
        html += '<tr style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Total Non-Current Assets</td><td align="right" style="padding:6px;">' + formatRM(totalNCA) + '</td></tr>';
        html += '<tr class="grand-total" style="font-weight:bold;background:#0b1220;color:#fff;border-top:2px solid #fbbf24;"><td style="padding:6px;">TOTAL ASSETS</td><td align="right" style="padding:6px;">' + formatRM(totalAssets) + '</td></tr>';
        html += '</table><br>';
        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
        html += '<caption style="text-align:center;font-weight:bold;color:#fbbf24;margin:8px 0;font-size:1.1em;">LIABILITIES & EQUITY</caption>';
        html += '<tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left" style="padding:6px;">Item</th><th align="right" style="padding:6px;">RM</th></tr>';
        html += rowsHtml(currentLiabilities);
        html += '<tr style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Total Current Liabilities</td><td align="right" style="padding:6px;">' + formatRM(totalCL) + '</td></tr>';
        html += rowsHtml(nonCurrentLiabilities);
        html += '<tr style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Total Non-Current Liabilities</td><td align="right" style="padding:6px;">' + formatRM(totalNCL) + '</td></tr>';
        html += rowsHtml(equityItems);
        html += '<tr style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Total Equity</td><td align="right" style="padding:6px;">' + formatRM(totalEquity) + '</td></tr>';
        html += '<tr class="grand-total" style="font-weight:bold;background:#0b1220;color:#fff;border-top:2px solid #fbbf24;"><td style="padding:6px;">TOTAL LIABILITIES & EQUITY</td><td align="right" style="padding:6px;">' + formatRM(totalLiabEq) + '</td></tr>';
        html += '<tr><td colspan="2" class="no-print ' + (balanced ? 'balanced' : '') + '" data-html2canvas-ignore="true" style="padding:6px;font-weight:bold;color:' + (balanced ? '#4ade80' : '#f87171') + ';">' + (balanced ? '✓ BALANCED (Assets = Liabilities + Equity)' : '✗ NOT BALANCED — Diff: ' + formatRM(totalAssets - totalLiabEq)) + '</td></tr>';
        html += '</table>';

        resolve({
          rendered: true,
          html: html,
          balanced: balanced,
          totalAssets: totalAssets,
          totalLiabilitiesEquity: totalLiabEq,
          retainedEarnings: retainedEarnings,
          netProfitBeforeTax: netProfitBeforeTax,
          ledger: ledger
        });
      }).catch(function (e) {
        reject({ error: e.message || 'Balance sheet error' });
      });
    });
  }

  var BalanceSheet = {
    generateBalanceSheet: generateBalanceSheet,
    formatRM: formatRM
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { BalanceSheet: BalanceSheet };
  global.BalanceSheet = BalanceSheet;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));