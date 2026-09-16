/**
 * Kira Enterprise V4 — Entry Validation helpers
 */
(function (global) {
  'use strict';

  function validateEntry(lines) {
    if (!lines || !lines.length) return { success: false, error: 'Tiada baris' };
    var totalDebit = 0, totalCredit = 0;
    for (var i = 0; i < lines.length; i++) {
      totalDebit += lines[i].debit || 0;
      totalCredit += lines[i].credit || 0;
      if (!lines[i].accountCode || !String(lines[i].accountCode).trim()) return { success: false, error: 'Kod akaun hilang' };
    }
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return { success: false, error: 'Debit dan Kredit mesti sama' };
    }
    return { success: true, totalDebit: totalDebit, totalCredit: totalCredit };
  }

  var Validation = {
    validateEntry: validateEntry
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Validation: Validation };
  global.Validation = Validation;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));