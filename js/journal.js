/**
 * Kira Enterprise V4 — Journal Engine (Promise-based, client-scoped)
 */
(function (global) {
  'use strict';

  function validateEntry(lines) {
    if (!lines || !lines.length) return { success: false, error: 'No lines provided' };
    var totalDebit = 0, totalCredit = 0;
    for (var i = 0; i < lines.length; i++) {
      totalDebit += lines[i].debit || 0;
      totalCredit += lines[i].credit || 0;
      if (!lines[i].accountCode || !String(lines[i].accountCode).trim()) return { success: false, error: 'Account code missing' };
    }
    if (Math.abs(totalDebit - totalCredit) > 0.001) return { success: false, error: 'Debit and Credit must be equal' };
    return { success: true };
  }

  function addEntry(clientId, date, description, lines) {
    var check = validateEntry(lines);
    if (!check.success) return Promise.resolve(check);
    var entry = {
      clientId: String(clientId || '').trim(),
      id: 'je-' + (clientId || 'none') + '-' + String(Date.now()).slice(-6),
      date: String(date || '').trim(),
      description: String(description || '').trim(),
      lines: lines.map(function (l) {
        return {
          accountCode: String(l.accountCode || '').trim(),
          accountName: String(l.accountName || '').trim(),
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0
        };
      })
    };
    if (!global.Storage || !global.Storage.save) {
      return Promise.resolve({ success: false, error: 'Storage not available' });
    }
    return global.Storage.saveJournalEntry ? global.Storage.saveJournalEntry(clientId, entry).then(function (res) {
      return { success: res.success ? true : false, entry: entry, error: res.error || null };
    }) : Promise.resolve({ success: false, error: 'Storage saveJournalEntry not available' });
  }

  function deleteEntry(clientId, entryId) {
    return (global.Storage ? global.Storage.getJournalEntries(clientId) : Promise.resolve([])).then(function (entries) {
      var newEntries = (entries || []).filter(function (e) { return e.id !== entryId; });
      return (global.Storage ? global.Storage.save('kiraV4_entries_' + String(clientId || '').trim(), newEntries) : Promise.resolve({ success: false }));
    }).then(function () { return { success: true }; });
  }

  function editEntry(clientId, entryId, newData) {
    return (global.Storage ? global.Storage.getJournalEntries(clientId) : Promise.resolve([])).then(function (entries) {
      var idx = (entries || []).findIndex(function (e) { return e.id === entryId; });
      if (idx < 0) return Promise.resolve({ success: false, error: 'Entry not found' });
      var updated = Object.assign({}, entries[idx], newData);
      var check = validateEntry(updated.lines || newData.lines);
      if (!check.success) return Promise.resolve(check);
      entries[idx] = updated;
      return (global.Storage ? global.Storage.save('kiraV4_entries_' + String(clientId || '').trim(), entries) : Promise.resolve({ success: false }));
    });
  }

  var Journal = {
    addEntry: addEntry,
    deleteEntry: deleteEntry,
    editEntry: editEntry,
    validateEntry: validateEntry,
    getEntriesByClient: function (clientId) {
      return global.Storage ? global.Storage.getJournalEntries(String(clientId || '').trim()) : Promise.resolve([]);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Journal: Journal };
  global.Journal = Journal;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
