/**
 * Kira Enterprise V4 — Journal Module (D1 + localStorage)
 */
(function (global) {
  'use strict';

  var Journal = {
    // Alias untuk keserasian dengan app_2.js
    loadEntries: function (clientId) {
      return this.getEntriesByClient(clientId);
    },

    getEntriesByClient: function (clientId) {
      if (!clientId) return Promise.resolve([]);
      if (global.Storage && global.Storage.getJournalEntries) {
        return global.Storage.getJournalEntries(clientId);
      }
      // Fallback ke localStorage
      return new Promise(function (resolve) {
        try {
          var raw = localStorage.getItem('kiraV4_entries_' + clientId);
          resolve(raw ? JSON.parse(raw) : []);
        } catch (e) { resolve([]); }
      });
    },

    saveEntry: function (clientId, entry) {
      return this.getEntriesByClient(clientId).then(function (entries) {
        entries.push(entry);
        if (global.Storage && global.Storage.saveUserCompanyEntries) {
          return global.Storage.saveUserCompanyEntries(clientId, entries);
        }
        localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(entries));
        return Promise.resolve({ success: true });
      });
    },

    updateEntry: function (clientId, entryId, updatedEntry) {
      return this.getEntriesByClient(clientId).then(function (entries) {
        var idx = entries.findIndex(function (e) { return e.id === entryId; });
        if (idx < 0) return Promise.resolve({ success: false, error: 'Entry not found' });
        entries[idx] = updatedEntry;
        if (global.Storage && global.Storage.saveUserCompanyEntries) {
          return global.Storage.saveUserCompanyEntries(clientId, entries);
        }
        localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(entries));
        return Promise.resolve({ success: true });
      });
    },

    deleteEntry: function (clientId, entryId) {
      return this.getEntriesByClient(clientId).then(function (entries) {
        var filtered = entries.filter(function (e) { return e.id !== entryId; });
        if (global.Storage && global.Storage.saveUserCompanyEntries) {
          return global.Storage.saveUserCompanyEntries(clientId, filtered);
        }
        localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(filtered));
        return Promise.resolve({ success: true });
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Journal: Journal };
  global.Journal = Journal;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
