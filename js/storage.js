// js/storage.js

var Storage = (function () {
  'use strict';

  var STORAGE_KEY = 'kira_enterprise_companies';

  // 1. Ambil semua senarai syarikat dari LocalStorage
  function getCompanies() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Ralat membaca storage:', e);
      return [];
    }
  }

  // 2. Simpan atau Kemaskini Syarikat
  function saveCompany(companyObj) {
    var companies = getCompanies();
    var index = companies.findIndex(function (c) {
      return String(c.code || c.id) === String(companyObj.code || companyObj.id);
    });

    if (index >= 0) {
      companies[index] = companyObj;
    } else {
      companies.push(companyObj);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  }

  // 3. Padam Syarikat
  function deleteCompany(companyCode) {
    var companies = getCompanies();
    var filtered = companies.filter(function (c) {
      return String(c.code || c.id) !== String(companyCode);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  // EXPORT FUNGSI KE GLOBAL STORAGE OBJECT
  return {
    getCompanies: getCompanies,
    saveCompany: saveCompany,
    deleteCompany: deleteCompany
  };
})();

// Eksport untuk sokongan Node/Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage: Storage };
}
