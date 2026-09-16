// js/storage.js - API Service & Browser Cache Layer

var Storage = (function () {
  'use strict';

  var CACHE_PREFIX = 'kira_cache_';

  // Helper: Simpan data ke LocalStorage
  function setLocal(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage penuh atau disekat:', e);
    }
  }

  // Helper: Ambil data dari LocalStorage
  function getLocal(key) {
    try {
      var data = localStorage.getItem(CACHE_PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // 1. Ambil Senarai Syarikat (Fast Cache-First)
  async function getCompanies() {
    var cached = getLocal('companies');
    
    // Kemaskini data secara senyap di latar belakang
    fetch('/api/companies')
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.success) {
          setLocal('companies', result.companies);
        }
      })
      .catch(function (err) { console.error('Background fetch failed:', err); });

    // Pulangkan cache serta-merta jika wujud
    if (cached) return cached;

    // Jika tiada cache, tunggu hasil fetch pertama
    try {
      var res = await fetch('/api/companies');
      var result = await res.json();
      if (result.success) {
        setLocal('companies', result.companies);
        return result.companies;
      }
    } catch (err) {
      console.error('Ralat fetch companies:', err);
    }
    return [];
  }

  // 2. Muat Data Syarikat Khusus (Cache-First)
  async function loadCompany(clientId) {
    if (!clientId) return null;
    var cached = getLocal('company_' + clientId);

    // Fetch data terkini di latar belakang
    fetch('/api/load?clientId=' + encodeURIComponent(clientId))
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.success) {
          setLocal('company_' + clientId, result);
        }
      });

    if (cached) return cached;

    try {
      var res = await fetch('/api/load?clientId=' + encodeURIComponent(clientId));
      var result = await res.json();
      if (result.success) {
        setLocal('company_' + clientId, result);
        return result;
      }
    } catch (err) {
      console.error('Ralat load company:', err);
    }
    return null;
  }

  // 3. Simpan Syarikat & Padam Cache Supaya Data Sentiasa Tepat
  async function saveCompany(clientId, companyMeta, entries) {
    var payload = {
      clientId: clientId,
      companyMeta: companyMeta || {},
      entries: entries || []
    };

    // Kemaskini cache tempatan dengan serta-merta
    setLocal('company_' + clientId, {
      success: true,
      companyMeta: companyMeta,
      entries: entries
    });

    try {
      var res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return {
    getCompanies: getCompanies,
    loadCompany: loadCompany,
    saveCompany: saveCompany
  };
})();
