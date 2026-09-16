/**
 * Kira Enterprise V4 — Trading & Profit & Loss (MPERS / MFRS Small SME)
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

  function generateProfitLoss(clientId, opts) {
    opts = opts || {};
    var taxRate = (opts.taxRate === undefined || opts.taxRate === null || isNaN(parseFloat(opts.taxRate))) ? 24 : parseFloat(opts.taxRate);
    return new Promise(function (resolve) {
      // If Ledger unavailable, return an empty structure
      if (!global.Ledger || !global.Ledger.generateGeneralLedger) {
        return resolve(emptyPL());
      }
      global.Ledger.generateGeneralLedger(clientId).then(function (ledger) {
        var bal = {};
        (ledger || []).forEach(function (a) { bal[a.code] = a.balance; });
        function b(code) { return bal[code] || 0; }
        function creditAmt(code) { return Math.abs(b(code)); }
        function sumAbs(codes) { return codes.reduce(function (s, c) { return s + Math.abs(b(c)); }, 0); }

        var sales = creditAmt('4000');
        var opening = sumAbs(['5000']);
        var purchases = sumAbs(['5010']);
        var closing = creditAmt('5020');
        var costOfSales = opening + purchases - closing;
        var grossProfit = sales - costOfSales;
        var expenses = sumAbs(['6000', '6010', '6020', '6025', '6035', '6100', '6110', '6130', '6160', '6170', '6210', '6220', '6230', '6300', '6901', '6902', '6903', '6904']);
        var zakat = sumAbs(['6905']);
        var operatingProfit = grossProfit - expenses;
        var netProfitBeforeTax = operatingProfit;
        var tax = 0;
        if (netProfitBeforeTax > 0) {
          if (taxRate <= 0) tax = 0;
          else if (global.TaxComputation && global.TaxComputation.calculateSmeTax) tax = global.TaxComputation.calculateSmeTax(netProfitBeforeTax);
          else tax = Math.round(netProfitBeforeTax * taxRate / 100);
        }
        var netProfitAfterTax = netProfitBeforeTax - tax - zakat;
        var addBack = sumAbs(['6300', '6901', '6902', '6903', '6904']); // depreciation + disallowables

        var pl = {
          clientId: clientId,
          year: new Date().getFullYear(),
          salesRevenue: sales,
          costOfSales: costOfSales,
          grossProfit: grossProfit,
          openingInventory: opening,
          purchases: purchases,
          closingInventory: closing,
          operatingExpenses: expenses,
          operatingProfit: operatingProfit,
          otherIncome: 0,
          otherExpenses: 0,
          netProfitBeforeTax: netProfitBeforeTax,
          zakatPerniagaan: zakat,
          incomeTaxExpense: tax,
          netProfitAfterTax: netProfitAfterTax,
          addBackExpenses: addBack,
          taxRate: taxRate
        };
        resolve(pl);
      }).catch(function () { resolve(emptyPL()); });
    });
  }

  function emptyPL() {
    return {
      clientId: '', year: new Date().getFullYear(),
      salesRevenue: 0, costOfSales: 0, grossProfit: 0,
      openingInventory: 0, purchases: 0, closingInventory: 0,
      operatingExpenses: 0, operatingProfit: 0, otherIncome: 0, otherExpenses: 0,
      netProfitBeforeTax: 0, zakatPerniagaan: 0, incomeTaxExpense: 0, netProfitAfterTax: 0,
      addBackExpenses: 0, taxRate: 24
    };
  }

  function generateTradingAccount() {
    return new Promise(function (resolve) {
      resolve({ grossSales: 0, costOfSales: 0, grossProfit: 0, grossLoss: false });
    });
  }

  function renderPLTab(plData) {
    if (!plData) plData = {};
    var companyName = plData.companyName || '';
    var year = plData.year || new Date().getFullYear();
    var sales = parseFloat(plData.salesRevenue || plData.grossSales || plData.sales || 0) || 0;
    var hasNetCOS = plData.costOfSales !== undefined && plData.costOfSales !== null;
    var invClose = parseFloat(plData.closingInventory || plData.endingInventory || 0) || 0;
    var netCOGS = hasNetCOS
      ? (parseFloat(plData.costOfSales) || 0)
      : ((parseFloat(plData.openingInventory || 0) || 0) + (parseFloat(plData.purchases || 0) || 0) - invClose);
    var gp = sales - netCOGS;
    var opEx = parseFloat(plData.operatingExpenses || plData.adminExpenses || 0) || 0;
    var opProfit = gp - opEx;
    var zakat = parseFloat(plData.zakatPerniagaan || plData.zakat || 0) || 0;
    var otherInc = parseFloat(plData.otherIncome || 0) || 0;
    var otherExp = parseFloat(plData.otherExpenses || 0) || 0;
    var pbt = opProfit + otherInc - otherExp;
    // CAREFUL: 0 is a valid tax rate (Enterprise/personal tax) — never fall back with || 24
    var isEnterprise = (plData.taxRate === 0 || plData.taxRate === '0');
    var taxRate = (plData.taxRate === undefined || plData.taxRate === null || isNaN(parseFloat(plData.taxRate))) ? 24 : parseFloat(plData.taxRate);
    var tax = isEnterprise ? 0 : Math.round(pbt > 0 ? pbt * taxRate / 100 : 0);
    // Enterprise: Net Profit After Tax = PBT - Zakat (no corporate tax)
    var final = pbt - tax - zakat;

    var html = '<div class="report-header">';
    if (companyName) html += '<h2>' + escapeHtml(companyName) + '</h2>';
    html += '<h2 class="report-company">TRADING & PROFIT & LOSS ACCOUNT</h2><p class="report-title">For Year Ended ' + year + '</p></div>';
    html += '<table style="width:100%;font-family:inherit;border-collapse:collapse;">';
    html += '<thead><tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left">Item</th><th align="right">RM</th></tr></thead>';
    html += '<tbody>';
    html += '<tr><td>Sales Revenue</td><td align="right">' + formatRM(sales) + '</td></tr>';
    html += '<tr><td>Less: Cost of Sales (Opening + Purchases - Closing)</td><td align="right">- ' + formatRM(netCOGS) + '</td></tr>';
    html += '<tr style="font-weight:bold;background:#1e293b;color:#fff;"><td>GROSS PROFIT</td><td align="right">' + formatRM(gp) + '</td></tr>';
    html += '<tr><td>Operating Expenses</td><td align="right">- ' + formatRM(opEx) + '</td></tr>';
    html += '<tr style="font-weight:bold;background:#1e293b;"><td>OPERATING PROFIT</td><td align="right">' + formatRM(opProfit) + '</td></tr>';
    html += '<tr><td>Other Income</td><td align="right">+ ' + formatRM(otherInc) + '</td></tr>';
    html += '<tr><td>Other Expenses</td><td align="right">- ' + formatRM(otherExp) + '</td></tr>';
    html += '<tr style="font-weight:bold;background:#0b1220;color:#fff;border-top:2px solid #fbbf24;"><td>NET PROFIT BEFORE TAX</td><td align="right">' + formatRM(pbt) + '</td></tr>';
    html += '<tr><td>Zakat Perniagaan (Business Zakat)</td><td align="right">- ' + formatRM(zakat) + '</td></tr>';
    if (isEnterprise) {
      html += '<tr><td style="font-style:italic;color:#94a3b8;">Enterprise — Personal Tax (not shown)</td><td align="right" style="font-style:italic;color:#94a3b8;">—</td></tr>';
    } else {
      html += '<tr><td>Income Tax (' + taxRate + '%)</td><td align="right">- ' + formatRM(tax) + '</td></tr>';
    }
    html += '<tr style="font-weight:bold;background:#0b1220;color:#4ade80;border-top:2px solid #4ade80;"><td>NET PROFIT AFTER TAX</td><td align="right">' + formatRM(final) + '</td></tr>';
    html += '</tbody></table>';
    return html;
  }

  var TradingPL = {
    generateProfitLoss: generateProfitLoss,
    generateTradingAccount: generateTradingAccount,
    renderPLTab: renderPLTab,
    renderTradingPL: renderPLTab, // alias mengikut API renderTradingPL(opts)
    formatRM: formatRM
  };
  global.TradingPL = TradingPL;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
