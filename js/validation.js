/**
 * Kira Enterprise V4 — Entry Validation helpers (Enhanced)
 */
(function (global) {
  'use strict';

  function validateEntry(lines) {
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return { success: false, error: 'Sila masukkan sekurang-kurangnya satu baris transaksi.' };
    }

    var totalDebit = 0;
    var totalCredit = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Semak kod akaun
      if (!line.accountCode || !String(line.accountCode).trim()) {
        return { success: false, error: 'Kod akaun diperlukan untuk setiap baris transaksi (Baris ' + (i + 1) + ').' };
      }

      // Tentukan nilai debit & kredit secara selamat (convert string to float jika perlu)
      var debit = parseFloat(line.debit) || 0;
      var credit = parseFloat(line.credit) || 0;

      totalDebit += debit;
      totalCredit += credit;
    }

    // Semak ketidakseimbangan akaun (Double-Entry Balance)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { 
        success: false, 
        error: 'Jumlah Debit (RM ' + totalDebit.toFixed(2) + ') dan Kredit (RM ' + totalCredit.toFixed(2) + ') mesti sama.' 
      };
    }

    return { 
      success: true, 
      totalDebit: Number(totalDebit.toFixed(2)), 
      totalCredit: Number(totalCredit.toFixed(2)) 
    };
  }

  var Validation = {
    validateEntry: validateEntry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validation: Validation };
  }
  global.Validation = Validation;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
