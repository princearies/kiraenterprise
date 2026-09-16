/**
 * Kira Enterprise V4 — Storage Abstraction (Promise-based)
 * Semua read/write melalui sini. Sekarang gunakan Cloudflare Worker API (D1).
 */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    COMPANY: 'kiraV4_company',
    ENTRIES: 'kiraV4_entries',
    SETTINGS: 'kiraV4_settings',
    COMPANIES: 'kiraV4_userCompanies',
  };

  /** Simpan ke D1 Database */
  async function saveToD1(key, data) {
    try {
      // Gunakan key sebagai clientId untuk simpan ke D1
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: key, entries: data, companyMeta: {} })
      });
      const result = await res.json();
      if (result.success) {
        return { success: true, key: key };
      }
      return { success: false, error: result.error || 'Ralat simpan', key: key };
    } catch (e) {
      return { success: false, error: e.message, key: key };
    }
  }

  /** Muat dari D1 Database */
  async function loadFromD1(key, defaultValue) {
    try {
      const res = await fetch('/api/load?clientId=' + encodeURIComponent(key));
      const data = await res.json();
      if (data.success) {
        return data.entries || (defaultValue !== undefined ? defaultValue : []);
      }
      return defaultValue !== undefined ? defaultValue : [];
    } catch (e) {
      return defaultValue !== undefined ? defaultValue : [];
    }
  }

  function save(key, data) {
    return saveToD1(key, data);
  }

  function load(key, defaultValue) {
    return loadFromD1(key, defaultValue);
  }

  function clearKey(key) {
    // Hapus entries untuk key tertentu dari D1 dengan masukkan empty array
    return saveToD1(key, []);
  }

  async function saveUserCompanyEntries(companyId, entries) {
    // Muat companies dari D1
    const companies = await load(STORAGE_KEYS.COMPANIES, []);
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
      await save(STORAGE_KEYS.COMPANIES, companies);
      return { success: true };
    }
    return { success: false, error: 'Company not found' };
  }

  async function saveJournalEntry(clientId, entry) {
    const entries = await load('kiraV4_entries_' + clientId, []);
    entries.push(entry);
    await save('kiraV4_entries_' + clientId, entries);
    return { success: true };
  }

  async function getJournalEntries(clientId) {
    return load('kiraV4_entries_' + clientId, []);
  }

  async function saveClient(company) {
    if (company && !company.id) company.id = company.clientId || ('c-' + Date.now());
    const companies = await load(STORAGE_KEYS.COMPANIES, []);
    var idx = companies.findIndex(function (c) { return (c.clientId || c.id) === (company ? (company.clientId || company.id) : company.id); });
    if (idx >= 0) {
      companies[idx] = Object.assign(companies[idx], company);
    } else {
      companies.push(company);
    }
    await save(STORAGE_KEYS.COMPANIES, companies);
    return { success: true };
  }

  async function loadUserCompanies() {
    return load(STORAGE_KEYS.COMPANIES, []);
  }

  async function deleteCompany(companyId) {
    const companies = await load(STORAGE_KEYS.COMPANIES, []);
    var idx = companies.findIndex(function (c) { return c.clientId === companyId || c.id === companyId; });
    if (idx < 0) return { success: false, error: 'Company not found' };
    var removed = companies.splice(idx, 1)[0];
    await save(STORAGE_KEYS.COMPANIES, companies);
    // Also delete all journal entries for this company
    if (removed && removed.clientId) {
      await save('kiraV4_entries_' + removed.clientId, []);
    }
    return { success: true, removed: removed };
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
