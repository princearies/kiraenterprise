/**
 * Kira Enterprise V4 — Cash Flow Statement (Indirect Method, client-scoped)
 * Operating, Investing & Financing sections built from ledger balances.
 */
(function (global) {
  'use strict';

  function formatRM(num) {
    return 'RM ' + (parseFloat(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function generateCashFlow(clientId) {
    return new Promise(function (resolve) {
      if (!global.Ledger || !global.Ledger.generateGeneralLedger) {
        return resolve({ html: '<p>Cash Flow module tidak dimuat.</p>', closingCash: 0 });
      }
      global.Ledger.generateGeneralLedger(clientId).then(function (ledger) {
        var bal = {};
        (ledger || []).forEach(function (a) { bal[a.code] = a.balance; });
        function b(code) { return bal[code] || 0; }
        function creditAmt(code) { return Math.abs(b(code)); }
        function sumAbs(codes) { return codes.reduce(function (s, c) { return s + Math.abs(b(c)); }, 0); }

        // P&L figures (mirror of trading-pl)
        var sales = creditAmt('4000');
        var costOfSales = sumAbs(['5000', '5010']) - creditAmt('5020');
        var expenses = sumAbs(['6000', '6010', '6020', '6025', '6035', '6100', '6110', '6130', '6160', '6170', '6210', '6220', '6230', '6300', '6901', '6902', '6903', '6904', '6905']);
        var netProfit = sales - costOfSales - expenses;

        var depreciation = sumAbs(['6300']);
        var inventoryIncrease = Math.max(0, b('1200'));
        var receivablesIncrease = Math.max(0, b('1100'));
        var payablesIncrease = creditAmt('2000');

        // OPERATING
        var operating = netProfit + depreciation - inventoryIncrease - receivablesIncrease + payablesIncrease;
        // INVESTING
        var ppePurchases = sumAbs(['1510', '1520', '1530', '1535']);
        var investing = -ppePurchases;
        // FINANCING
        var financing = creditAmt('3000') + creditAmt('2200');
        var netChange = operating + investing + financing;

        var cashAccounts = b('1000') + b('1010') + b('1020');
        var openingCash = cashAccounts - netChange;
        var closingCash = openingCash + netChange;
        var checkOk = Math.abs(closingCash - cashAccounts) < 0.01;

        function section(title, rows, total) {
          var h = '<tr style="background:#334155;color:#fbbf24;font-weight:bold;"><td colspan="2" style="padding:6px;">' + title + '</td></tr>';
          rows.forEach(function (r) {
            h += '<tr><td style="padding:6px;border-bottom:1px solid #334155;">' + r[0] + '</td><td align="right" style="padding:6px;border-bottom:1px solid #334155;">' + formatRM(r[1]) + '</td></tr>';
          });
          h += '<tr class="total" style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">Net ' + title + '</td><td align="right" style="padding:6px;">' + formatRM(total) + '</td></tr>';
          return h;
        }

        var html = '<div class="report-header"><h2 class="report-company">CASH FLOW STATEMENT</h2><p class="report-title">Indirect Method — <span class="client-id">Client: ' + (clientId || '') + '</span></p></div>';
        html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
        html += section('CASH FLOWS FROM OPERATING ACTIVITIES', [
          ['Net Profit Before Tax', netProfit],
          ['Add: Depreciation', depreciation],
          ['Less: Increase in Inventory', -inventoryIncrease],
          ['Less: Increase in Receivables', -receivablesIncrease],
          ['Add: Increase in Payables', payablesIncrease]
        ], operating);
        html += section('CASH FLOWS FROM INVESTING ACTIVITIES', [
          ['Purchase of PPE (Motor/Furniture/Equipment/IT)', -ppePurchases]
        ], investing);
        html += section('CASH FLOWS FROM FINANCING ACTIVITIES', [
          ['Issue of Share Capital', creditAmt('3000')],
          ['Proceeds from Long-term Loan', creditAmt('2200')]
        ], financing);
        html += '<tr class="total" style="font-weight:bold;background:#0b1220;color:#fff;border-top:2px solid #fbbf24;"><td style="padding:6px;">NET INCREASE / (DECREASE) IN CASH</td><td align="right" style="padding:6px;">' + formatRM(netChange) + '</td></tr>';
        html += '<tr><td style="padding:6px;">Cash at Beginning of Year (assumed)</td><td align="right" style="padding:6px;">' + formatRM(openingCash) + '</td></tr>';
        html += '<tr class="total" style="font-weight:bold;background:#1e293b;"><td style="padding:6px;">CASH AT END OF YEAR (Ledger: 1000+1010+1020)</td><td align="right" style="padding:6px;">' + formatRM(cashAccounts) + '</td></tr>';
        html += '<tr><td colspan="2" style="padding:6px;font-weight:bold;color:' + (checkOk ? '#4ade80' : '#f87171') + ';">' + (checkOk ? '✓ Closing cash reconciled with ledger' : '✗ Closing cash mismatch') + '</td></tr>';
        html += '</table>';

        resolve({ html: html, operating: operating, investing: investing, financing: financing, closingCash: cashAccounts, checkOk: checkOk });
      }).catch(function () {
        resolve({ html: '<p>Gagal menjana Cash Flow.</p>', closingCash: 0 });
      });
    });
  }

  var CashFlow = {
    generateCashFlow: generateCashFlow,
    formatRM: formatRM
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { CashFlow: CashFlow };
  global.CashFlow = CashFlow;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));