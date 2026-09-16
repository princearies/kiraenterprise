/**
 * Kira Enterprise V4 — Journal Engine (Promise-based, client-scoped)
 * Uses Cloudflare Worker API (D1 Database) for journal operations.
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

  /** Muat entries dari D1 Database */
  async function loadEntriesFromD1(clientId) {
    try {
      const res = await fetch('/api/load?clientId=' + encodeURIComponent(clientId));
      const data = await res.json();
      if (data.success) {
        return data.entries || [];
      }
      console.error('D1 load error:', data.error);
      return [];
    } catch (err) {
      console.error('Error loading from D1:', err);
      return [];
    }
  }

  /** Simpan entries ke D1 Database */
  async function saveEntriesToD1(clientId, entries, companyMeta) {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, entries, companyMeta })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
      console.error('D1 save error:', data.error);
      return { success: false, error: data.error || 'Ralat tidak diketahui' };
    } catch (err) {
      console.error('Error saving to D1:', err);
      return { success: false, error: err.message };
    }
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

    // Muat entries existing dari D1
    return loadEntriesFromD1(clientId).then(function (existingEntries) {
      // Add new entry
      existingEntries.push(entry);
      // Simpan kembali ke D1
      return saveEntriesToD1(clientId, existingEntries, null);
    }).then(function (res) {
      return { success: res.success ? true : false, entry: entry, error: res.error || null };
    });
  }

  function deleteEntry(clientId, entryId) {
    // Muat entries existing dari D1
    return loadEntriesFromD1(clientId).then(function (entries) {
      var newEntries = (entries || []).filter(function (e) { return e.id !== entryId; });
      // Simpan kembali ke D1
      return saveEntriesToD1(clientId, newEntries, null);
    }).then(function (res) {
      return { success: res.success ? true : false, error: res.error || null };
    });
  }

  function editEntry(clientId, entryId, newData) {
    // Muat entries existing dari D1
    return loadEntriesFromD1(clientId).then(function (entries) {
      var idx = (entries || []).findIndex(function (e) { return e.id === entryId; });
      if (idx < 0) return Promise.resolve({ success: false, error: 'Entry not found' });
      var updated = Object.assign({}, entries[idx], newData);
      var check = validateEntry(updated.lines || newData.lines);
      if (!check.success) return Promise.resolve(check);
      entries[idx] = updated;
      // Simpan kembali ke D1
      return saveEntriesToD1(clientId, entries, null);
    }).then(function (res) {
      return { success: res.success ? true : false, error: res.error || null };
    });
  }

  function getEntriesByClient(clientId) {
    return loadEntriesFromD1(String(clientId || '').trim());
  }

  var Journal = {
    addEntry: addEntry,
    deleteEntry: deleteEntry,
    editEntry: editEntry,
    validateEntry: validateEntry,
    getEntriesByClient: getEntriesByClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Journal: Journal };
  global.Journal = Journal;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
