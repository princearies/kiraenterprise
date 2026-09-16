/**
 * Kira Enterprise V4 — Storage Abstraction (Promise-based)
 * All read/write go through here so we can swap localStorage for Cloudflare Workers later.
 */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    COMPANY: 'kiraV4_company',
    ENTRIES: 'kiraV4_entries',
    SETTINGS: 'kiraV4_settings',
    COMPANIES: 'kiraV4_userCompanies',
  };

  function save(key, data) {
    return new Promise(function (resolve, reject) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        resolve({ success: true, key: key });
      } catch (e) {
        reject({ success: false, error: e.message, key: key });
      }
    });
  }

  function load(key, defaultValue) {
    return new Promise(function (resolve) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) {
          resolve(defaultValue !== undefined ? defaultValue : null);
        } else {
          resolve(JSON.parse(raw));
        }
      } catch (e) {
        resolve(defaultValue !== undefined ? defaultValue : null);
      }
    });
  }

  function clearKey(key) {
    return new Promise(function (resolve) {
      try {
        localStorage.removeItem(key);
        resolve({ success: true });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  function saveUserCompanyEntries(companyId, entries) {
    return load(STORAGE_KEYS.COMPANIES, []).then(function (companies) {
      var idx = companies.findIndex(function (c) { return c.clientId === companyId || c.id === companyId; });
      if (idx >= 0) {
        // Merge: keep existing entries, append new ones (avoid duplicates by id if present)
        var existing = companies[idx].entries || [];
        var newEntries = (entries || []).filter(function (e) {
          // If entry has an id, check for duplicates; if no id, always add
          if (!e.id) return true;
          var existingIds = existing.map(function (ex) { return ex.id; });
          return existingIds.indexOf(e.id) < 0;
        });
        companies[idx].entries = existing.concat(newEntries);
        return save(STORAGE_KEYS.COMPANIES, companies);
      }
      return Promise.resolve({ success: false, error: 'Company not found' });
    });
  }

  function saveJournalEntry(clientId, entry) {
    return load('kiraV4_entries_' + clientId, []).then(function (entries) {
      entries.push(entry);
      return save('kiraV4_entries_' + clientId, entries);
    });
  }

  function getJournalEntries(clientId) {
    return load('kiraV4_entries_' + clientId, []);
  }

  function saveClient(company) {
    if (company && !company.id) company.id = company.clientId || ('c-' + Date.now());
    return load(STORAGE_KEYS.COMPANIES, []).then(function (companies) {
      var idx = companies.findIndex(function (c) { return (c.clientId || c.id) === (company ? (company.clientId || company.id) : company.id); });
      if (idx >= 0) {
        companies[idx] = Object.assign(companies[idx], company);
      } else {
        companies.push(company);
      }
      return save(STORAGE_KEYS.COMPANIES, companies);
    });
  }

  function loadUserCompanies() {
    return load(STORAGE_KEYS.COMPANIES, []);
  }

  function deleteCompany(companyId) {
    return load(STORAGE_KEYS.COMPANIES, []).then(function (companies) {
      var idx = companies.findIndex(function (c) { return c.clientId === companyId || c.id === companyId; });
      if (idx < 0) return Promise.resolve({ success: false, error: 'Company not found' });
      var removed = companies.splice(idx, 1)[0];
      return save(STORAGE_KEYS.COMPANIES, companies).then(function () {
        // Also delete all journal entries for this company
        var clientId = removed.clientId;
        if (clientId) {
          localStorage.removeItem('kiraV4_entries_' + clientId);
        }
        return { success: true, removed: removed };
      });
    });
  }

  var Storage = {
    STORAGE_KEYS: STORAGE_KEYS,
    save: save,
    load: load,
    clearKey: clearKey,
    saveToLocalStorage: function (key, data) { return save(key, data); },
    loadFromLocalStorage: function (key, defaultValue) { return load(key, defaultValue); },
    saveUserCompanyEntries: saveUserCompanyEntries,
    loadUserCompanies: loadUserCompanies,
    saveJournalEntry: saveJournalEntry,
    getJournalEntries: getJournalEntries,
    saveClient: saveClient,
    deleteCompany: deleteCompany,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Storage: Storage };
  }
  global.Storage = Storage;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
