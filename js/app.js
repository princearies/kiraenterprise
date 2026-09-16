// js/app.js - Modul utama pengendalian syarikat & UI

var App = (function () {
  'use strict';

  var currentCompanyId = null;

  // 1. Muat dan Papar Senarai Syarikat ke Dropdown (#company-select)
  function renderCompanyOptions() {
    var selectEl = document.getElementById('company-select');
    if (!selectEl) return;

    // Dapatkan semua syarikat dari pangkalan data / storage
    var companies = Storage.getCompanies() || [];

    // Reset pilihan dropdown
    selectEl.innerHTML = '<option value="">-- Select Company --</option>';

    // Bina semula senarai <option> daripada pangkalan data
    companies.forEach(function (company) {
      var opt = document.createElement('option');
      // Gunakan kod unik (uniqueCode/id) sebagai nilai utama
      opt.value = company.code || company.id;
      
      var entryCount = company.entries ? company.entries.length : 0;
      opt.textContent = company.name + ' (' + entryCount + ' entries)';

      if (currentCompanyId && String(opt.value) === String(currentCompanyId)) {
        opt.selected = true;
      }

      selectEl.appendChild(opt);
    });
  }

  // 2. Tukar Syarikat Aktif Berdasarkan Kod Unik / ID
  function changeCompany(companyCode) {
    if (!companyCode) {
      currentCompanyId = null;
      // Reset paparan panel
      return;
    }

    // Pemadanan selamat (String comparison + trim)
    var cleanCode = String(companyCode).trim().toLowerCase();
    var companies = Storage.getCompanies() || [];
    
    var company = companies.find(function (c) {
      var code = String(c.code || c.id).trim().toLowerCase();
      return code === cleanCode;
    });

    if (company) {
      currentCompanyId = company.code || company.id;
      // Kemaskini kadar cukai mengikut jenis syarikat
      if (company.type) {
        var typeEl = document.getElementById('companyType');
        if (typeEl) typeEl.value = company.type;
        updateTaxRate();
      }
      // Muatkan data jurnal/buku besar syarikat berkenaan
      Journal.loadEntries(company.entries || []);
      Utils.showToast('Syarikat "' + company.name + '" berjaya dimuatkan.');
    } else {
      Utils.showToast('Ralat: Syarikat dengan kod tersebut tidak dijumpai!', 'error');
    }
  }

  // 3. Tambah Syarikat Baru (Dengan Penjanaan Kod Unik)
  function addNewCompany() {
    var name = prompt('Masukkan Nama Syarikat Baru:');
    if (!name || !name.trim()) return;

    // Penjanaan Kod Unik automatik (contoh: CMP-XXXX)
    var uniqueCode = 'CMP-' + Date.now().toString(36).toUpperCase();

    var newCompany = {
      id: uniqueCode,
      code: uniqueCode,
      name: name.trim(),
      type: document.getElementById('companyType').value || 'sdn_bhd_normal',
      entries: []
    };

    Storage.saveCompany(newCompany);
    currentCompanyId = uniqueCode;
    
    renderCompanyOptions();
    changeCompany(uniqueCode);
    Utils.showToast('Syarikat baru berjaya ditambah! Kod Unik: ' + uniqueCode);
  }

  // 4. Padam Syarikat
  function deleteCompany(companyCode) {
    if (!companyCode) {
      alert('Sila pilih syarikat untuk dipadam.');
      return;
    }

    if (confirm('Adakah anda pasti mahu memadam syarikat ini?')) {
      Storage.deleteCompany(companyCode);
      currentCompanyId = null;
      renderCompanyOptions();
      Utils.showToast('Syarikat berjaya dipadam.');
    }
  }

  // 5. Inisialisasi Aplikasi pada Tetapan Awal (Init)
  function init() {
    renderCompanyOptions();
    updateTaxRate();
  }

  return {
    init: init,
    renderCompanyOptions: renderCompanyOptions,
    changeCompany: changeCompany,
    addNewCompany: addNewCompany,
    deleteCompany: deleteCompany,
    updateTaxRate: function () { /* Logik cukai sedia ada */ }
  };
})();

// Jalankan init apabila dokumen selesai dimuatkan
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
