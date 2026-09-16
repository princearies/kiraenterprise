/**
 * Kira Enterprise V4 — Tax Computation Engine (LHDN SME Rules, YA 2024-2026)
 * All data keys strictly trimmed — no trailing spaces.
 */
(function (global) {
  'use strict';

  function calculateSmeTax(chargeableIncome) {
    var ci = Math.max(0, parseFloat(chargeableIncome) || 0);
    var tax = 0;
    if (ci <= 150000) {
      tax = ci * 0.15;
    } else if (ci <= 600000) {
      tax = 150000 * 0.15 + (ci - 150000) * 0.17;
    } else {
      tax = 150000 * 0.15 + (600000 - 150000) * 0.17 + (ci - 600000) * 0.24;
    }
    return Math.round(tax);
  }

  function calculateWithZakatRebate(chargeableIncome, zakatPaid) {
    var zt = Math.max(0, parseFloat(zakatPaid) || 0);
    var baseTax = calculateSmeTax(chargeableIncome);
    var finalTax = Math.max(0, baseTax - zt);
    return {
      chargeableIncome: chargeableIncome,
      calculatedTax: baseTax,
      zakatPaid: zt,
      finalTaxPayable: finalTax,
      rebateUsed: zt
    };
  }

  function renderTaxComputation(plData) {
    if (!plData) plData = {};
    // Enterprise (taxRate 0) = personal tax — NO corporate tax at all
    var isEnterprise = (plData.taxRate === 0 || plData.taxRate === '0');
    var pbt = parseFloat(plData.profitBeforeTax || plData.netProfitBeforeTax || 0) || 0;
    var addBack = parseFloat(plData.addBackExpenses || plData.disallowable || 0) || 0;
    var lessDed = parseFloat(plData.allowableDeductions || plData.deductions || 0) || 0;
    var statutory = pbt + addBack - lessDed;
    var zakat = parseFloat(plData.zakatPaid || plData.zakat || 0) || 0;
    // Non-Enterprise: tiered SME tax (15%/17%/24%). Enterprise: never taxed at corporate level.
    var baseTax = isEnterprise ? 0 : calculateSmeTax(statutory);
    var final = Math.max(0, baseTax - zakat);

    var rows = [];
    if (isEnterprise) {
      rows.push({ label: 'Net Profit Before Tax', value: pbt.toFixed(2) });
      rows.push({ label: 'Enterprise (Personal Tax — No Corporate Tax)', value: '—', note: true });
      rows.push({ label: 'Tax Payable (before Zakat)', value: '0.00' });
      rows.push({ label: 'Less: Zakat Rebate (Zakat Sabah)', value: '-' + zakat.toFixed(2) });
      rows.push({ label: 'FINAL TAX PAYABLE TO LHDN', value: '0.00', highlight: true });
    } else {
      rows.push(
        { label: 'Net Profit Before Tax', value: pbt.toFixed(2) },
        { label: 'Add: Disallowable Expenses', value: '+' + addBack.toFixed(2) },
        { label: 'Less: Allowable Deductions', value: '-' + lessDed.toFixed(2) },
        { label: 'Statutory Business Income', value: statutory.toFixed(2) },
        { label: 'Chargeable Income', value: statutory.toFixed(2) },
        { label: 'Tax Payable (before Zakat)', value: baseTax.toFixed(2) },
        { label: 'Less: Zakat Rebate (Zakat Sabah)', value: '-' + zakat.toFixed(2) },
        { label: 'FINAL TAX PAYABLE TO LHDN', value: final.toFixed(2), highlight: true }
      );
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-family:inherit;">';
    html += '<thead><tr style="background:#334155;color:#fbbf24;font-weight:bold;"><th align="left" style="padding:8px;border-bottom:2px solid #fbbf24;">Item</th><th align="right" style="padding:8px;border-bottom:2px solid #fbbf24;">Amount (RM)</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var style;
      if (r.highlight) style = 'background:#0f172a;color:#4ade80;font-weight:bold;border-top:2px solid #4ade80;';
      else if (r.note) style = 'background:#1e293b;color:#fbbf24;font-style:italic;';
      else style = 'background:#1e293b;color:#e2e8f0;';
      html += '<tr style="' + style + '"><td style="padding:8px;border-bottom:1px solid #334155;">' + r.label + '</td><td align="right" style="padding:8px;border-bottom:1px solid #334155;">' + r.value + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  var TaxComputation = {
    calculateSmeTax: calculateSmeTax,
    calculateWithZakatRebate: calculateWithZakatRebate,
    renderTaxComputation: renderTaxComputation
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaxComputation: TaxComputation };
  }
  global.TaxComputation = TaxComputation;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
