/**
 * Kira Enterprise V4 — Storage Abstraction (Cloudflare D1 Worker Integrated - Complete Fix)
 */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    COMPANY: 'kiraV4_company',
    ENTRIES: 'kiraV4_entries',
    SETTINGS: 'kiraV4_settings',
    COMPANIES: 'kiraV4_userCompanies',
  };

  // Penjana ID Unik berasaskan Nama Syarikat
  function generateUniqueClientId(companyName) {
    if (!companyName) return 'client-' + Date.now();
    const cleanName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 10);
    const randomHash = Math.floor(1000 + Math.random() * 9000);
    return `${cleanName}-${randomHash}`;
  }

  // 1. Simpan Syarikat Ke D1 (Perlindungan Data Jurnal + Auto ID)
  function saveClient(company) {
    if (!company) return Promise.resolve({ success: false });

    if (!company.clientId && !company.id) {
      company.clientId = generateUniqueClientId(company.name);
      company.id = company.clientId;
    }
    const clientId = company.clientId || company.id;

    return loadUserCompanies().then(async function (companies) {
      var idx = companies.findIndex(function (c) { return (c.clientId || c.id) === clientId; });
      if (idx >= 0) {
        companies[idx] = Object.assign(companies[idx], company);
      } else {
        companies.push(company);
      }

      // Elak menimpa entri jurnal sedia ada dengan array kosong
      let entriesToSave = company.entries;
      if (!entriesToSave || !entriesToSave.length) {
        entriesToSave = await getJournalEntries(clientId);
      }

      return fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId,
          entries: entriesToSave || [],
          companyMeta: { companiesList: companies, activeCompany: company }
        })
      }).then(res => res.json())
        .then(data => {
          localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
          return { success: data.success, clientId: clientId };
        });
    });
  }

  // 2. Simpan Entri Jurnal Ke D1 Database
  function saveUserCompanyEntries(companyId, entries) {
    return fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: companyId,
        entries: entries || [],
        companyMeta: { updated: new Date().toISOString() }
      })
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('kiraV4_entries_' + companyId, JSON.stringify(entries));
        }
        return data;
      });
  }

  // 3. Muat Senarai Syarikat
  function loadUserCompanies() {
    return new Promise(function (resolve) {
      var raw = localStorage.getItem(STORAGE_KEYS.COMPANIES);
      try {
        resolve(raw ? JSON.parse(raw) : []);
      } catch (e) {
        resolve([]);
      }
    });
  }

  // 4. Muat Jurnal Syarikat dari D1
  function getJournalEntries(clientId) {
    if (!clientId) return Promise.resolve([]);
    return fetch(`/api/load?clientId=${encodeURIComponent(clientId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.entries) {
          localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(data.entries));
          return data.entries;
        }
        var raw = localStorage.getItem('kiraV4_entries_' + clientId);
        return raw ? JSON.parse(raw) : [];
      })
      .catch(() => {
        var raw = localStorage.getItem('kiraV4_entries_' + clientId);
        return raw ? JSON.parse(raw) : [];
      });
  }

  // 5. Padam Syarikat dari D1
  function deleteCompany(companyId) {
    return loadUserCompanies().then(function (companies) {
      var idx = companies.findIndex(function (c) { return c.clientId === companyId || c.id === companyId; });
      if (idx < 0) return Promise.resolve({ success: false, error: 'Company not found' });
      
      var removed = companies.splice(idx, 1)[0];
      
      return fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: companyId,
          entries: [],
          companyMeta: { deleted: true, companiesList: companies }
        })
      }).then(res => res.json()).then(data => {
        localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
        localStorage.removeItem('kiraV4_entries_' + companyId);
        return { success: true, removed: removed };
      });
    });
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    return Promise.resolve({ success: true, key: key });
  }

  function load(key, defaultValue) {
    var raw = localStorage.getItem(key);
    return Promise.resolve(raw ? JSON.parse(raw) : (defaultValue !== undefined ? defaultValue : null));
  }

  var Storage = {
    STORAGE_KEYS: STORAGE_KEYS,
    save: save,
    load: load,
    clearKey: key => Promise.resolve(localStorage.removeItem(key)),
    saveToLocalStorage: save,
    loadFromLocalStorage: load,
    generateUniqueClientId: generateUniqueClientId,
    saveUserCompanyEntries: saveUserCompanyEntries,
    loadUserCompanies: loadUserCompanies,
    saveJournalEntry: (clientId, entry) => getJournalEntries(clientId).then(entries => {
      entries.push(entry);
      return saveUserCompanyEntries(clientId, entries);
    }),
    getJournalEntries: getJournalEntries,
    saveClient: saveClient,
    deleteCompany: deleteCompany,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Storage: Storage };
  }
  global.Storage = Storage;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
