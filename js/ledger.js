/**
 * Kira Enterprise V4 — Ledger Engine (Promise-based, client-scoped)
 */
(function (global) {
  'use strict';

  function isCreditNormal(accountCode) {
    var c = parseInt(accountCode, 10);
    // Liabilities (2000s), Equity (3000s), Revenue (4000s), Closing Inventory (5020)
    return (c >= 2000 && c < 4000) || c === 4000 || c === 4010 || c === 5020;
  }

  function getAccountBalance(clientId, code) {
    return new Promise(function (resolve) {
      if (!global.Storage || !global.Storage.getJournalEntries) return resolve(0);
      var targetCode = String(code || '').trim();
      
      global.Storage.getJournalEntries(String(clientId || '').trim()).then(function (entries) {
        var bal = 0;
        (entries || []).forEach(function (e) {
          (e.lines || []).forEach(function (l) {
            var lineCode = String(l.accountCode || l.code || '').trim();
            if (lineCode === targetCode) {
              if (isCreditNormal(targetCode)) {
                bal += (parseFloat(l.credit) || 0) - (parseFloat(l.debit) || 0);
              } else {
                bal += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
              }
            }
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
            var c = String(l.accountCode || l.code || '').trim();
            if (!c) return;
            
            if (!mapAcc[c]) {
              var accName = l.accountName || l.name || '';
              if (!accName && global.ChartOfAccounts && global.ChartOfAccounts.getAccountName) {
                accName = global.ChartOfAccounts.getAccountName(c);
              }
              mapAcc[c] = { code: c, name: accName, totalDebit: 0, totalCredit: 0, balance: 0 };
            }
            mapAcc[c].totalDebit += (parseFloat(l.debit) || 0);
            mapAcc[c].totalCredit += (parseFloat(l.credit) || 0);
          });
        });

        var result = [];
        Object.keys(mapAcc).sort().forEach(function (k) {
          var a = mapAcc[k];
          if (isCreditNormal(a.code)) {
            a.balance = a.totalCredit - a.totalDebit;
          } else {
            a.balance = a.totalDebit - a.totalCredit;
          }
          result.push(a);
        });
        resolve(result);
      }).catch(function (e) { reject({ error: e.message || 'Ledger calculation error' }); });
    });
  }

  var Ledger = {
    generateGeneralLedger: generateGeneralLedger,
    getAccountBalance: getAccountBalance
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Ledger: Ledger };
  global.Ledger = Ledger;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
