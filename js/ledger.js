/**
 * Kira Enterprise V4 — Ledger Engine (Promise-based, client-scoped)
 */
(function (global) {
  'use strict';

  function getAccountBalance(clientId, code) {
    return new Promise(function (resolve) {
      if (!global.Storage || !global.Storage.getJournalEntries) return resolve(0);
      global.Storage.getJournalEntries(String(clientId || '').trim()).then(function (entries) {
        var bal = 0;
        (entries || []).forEach(function (e) {
          (e.lines || []).forEach(function (l) {
            if (l.accountCode === code) bal += (l.debit || 0) - (l.credit || 0);
          });
        });
        resolve(bal);
      }).catch(function () { resolve(0); });
    });
  }

  function generateGeneralLedger(clientId) {
    return new Promise(function (resolve, reject) {
      if (!global.Storage || !global.Storage.getJournalEntries) return resolve([]);
      global.Storage.getJournalEntries(String(clientId || '').trim()).then(function (entries) {
        var mapAcc = {};
        (entries || []).forEach(function (e) {
          (e.lines || []).forEach(function (l) {
            var c = String(l.accountCode || '').trim();
            if (!c) return;
            if (!mapAcc[c]) mapAcc[c] = { code: c, name: l.accountName || '', totalDebit: 0, totalCredit: 0, balance: 0 };
            mapAcc[c].totalDebit += (l.debit || 0);
            mapAcc[c].totalCredit += (l.credit || 0);
          });
        });
        var result = [];
        Object.keys(mapAcc).sort().forEach(function (k) {
          var a = mapAcc[k];
          a.balance = a.totalDebit - a.totalCredit;
          result.push(a);
        });
        resolve(result);
      }).catch(function (e) { reject({ error: e.message || 'Ledger error' }); });
    });
  }

  var Ledger = {
    generateGeneralLedger: generateGeneralLedger,
    getAccountBalance: getAccountBalance
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Ledger: Ledger };
  global.Ledger = Ledger;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
