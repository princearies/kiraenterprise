// js/app.js - Modul utama pengendalian syarikat & UI (D1 Integration)

var App = (function () {
  'use strict';

  var currentCompanyId = null;

  // 1. Muat dan Papar Senarai Syarikat ke Dropdown (#company-select) dari D1 Database
  async function renderCompanyOptions() {
    var selectEl = document.getElementById('company-select');
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">-- Loading companies... --</option>';

    try {
      var response = await fetch('/api/companies');
      var result = await response.json();

      selectEl.innerHTML = '<option value="">-- Select Company --</option>';

      if (!result.success || !result.companies || result.companies.length === 0) {
        selectEl.innerHTML = '<option value="">-- No Companies Found --</option>';
        return;
      }

      result.companies.forEach(function (company) {
        var opt = document.createElement('option');
        opt.value = company.clientId || company.code;
        opt.textContent = company.name + ' (' + (company.code || company.clientId) + ')';

        if (currentCompanyId && String(opt.value) === String(currentCompanyId)) {
          opt.selected = true;
        }

        selectEl.appendChild(opt);
      });
    } catch (err) {
      console.error('Ralat memuatkan syarikat dari D1:', err);
      selectEl.innerHTML = '<option value="">-- Error Loading Companies --</option>';
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Gagal memuatkan senarai syarikat dari pelayan.', 'error');
      }
    }
  }

  // 2. Tukar Syarikat Aktif & Muat Data Jurnal dari D1
  async function changeCompany(companyCode) {
    if (!companyCode) {
      currentCompanyId = null;
      if (typeof Journal !== 'undefined' && Journal.loadEntries) {
        Journal.loadEntries([]);
      }
      return;
    }

    try {
      var response = await fetch('/api/load?clientId=' + encodeURIComponent(companyCode));
      var result = await response.json();

      if (result.success) {
        currentCompanyId = companyCode;

        // Kemaskini jenis & kadar cukai syarikat jika wujud dalam companyMeta
        if (result.companyMeta) {
          if (result.companyMeta.type) {
            var typeEl = document.getElementById('companyType');
            if (typeEl) typeEl.value = result.companyMeta.type;
          }
          if (result.companyMeta.taxRate) {
            var taxRateEl = document.getElementById('tax-rate');
            if (taxRateEl) taxRateEl.value = result.companyMeta.taxRate;
          }
          updateTaxRate();
        }

        // Muatkan entri jurnal ke modul Journal
        if (typeof Journal !== 'undefined' && Journal.loadEntries) {
          Journal.loadEntries(result.entries || []);
        }

        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast('Data syarikat berjaya dimuatkan dari D1.');
        }
      } else {
        throw new Error(result.error || 'Gagal memuatkan data syarikat.');
      }
    } catch (err) {
      console.error('Ralat memuatkan data syarikat:', err);
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Ralat: ' + err.message, 'error');
      }
    }
  }

  // 3. Tambah Syarikat Baru dan Simpan Rekod Awal ke D1
  async function addNewCompany() {
    var name = prompt('Masukkan Nama Syarikat Baru:');
    if (!name || !name.trim()) return;

    var uniqueCode = 'CMP-' + Date.now().toString(36).toUpperCase();
    var companyType = document.getElementById('companyType') ? document.getElementById('companyType').value : 'sdn_bhd_normal';
    var taxRate = document.getElementById('tax-rate') ? parseFloat(document.getElementById('tax-rate').value) : 24;

    var payload = {
      clientId: uniqueCode,
      companyMeta: {
        code: uniqueCode,
        name: name.trim(),
        type: companyType,
        taxRate: taxRate
      },
      entries: []
    };

    try {
      var response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var result = await response.json();

      if (result.success) {
        currentCompanyId = uniqueCode;
        await renderCompanyOptions();
        await changeCompany(uniqueCode);
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast('Syarikat baru berjaya didaftarkan ke D1! Kod: ' + uniqueCode);
        }
      } else {
        throw new Error(result.error || 'Gagal menyimpan syarikat.');
      }
    } catch (err) {
      console.error('Ralat menambah syarikat:', err);
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Gagal mendaftar syarikat baru.', 'error');
      }
    }
  }

  // 4. Simpan Entri Semasa Syarikat ke D1
  async function saveCurrentCompany() {
    if (!currentCompanyId) {
      alert('Sila pilih syarikat terlebih dahulu.');
      return;
    }

    var entries = typeof Journal !== 'undefined' && Journal.getEntries ? Journal.getEntries() : [];
    var companyType = document.getElementById('companyType') ? document.getElementById('companyType').value : 'sdn_bhd_normal';
    var taxRate = document.getElementById('tax-rate') ? parseFloat(document.getElementById('tax-rate').value) : 24;

    var selectEl = document.getElementById('company-select');
    var companyName = selectEl && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0].text.split(' (')[0] : currentCompanyId;

    var payload = {
      clientId: currentCompanyId,
      companyMeta: {
        code: currentCompanyId,
        name: companyName,
        type: companyType,
        taxRate: taxRate
      },
      entries: entries
    };

    try {
      var response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var result = await response.json();

      if (result.success) {
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast('Semua rekod berjaya disimpan ke D1 Database!');
        }
      } else {
        throw new Error(result.error || 'Gagal menyimpan data.');
      }
    } catch (err) {
      console.error('Ralat menyimpan data:', err);
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Ralat semasa menyimpan ke D1.', 'error');
      }
    }
  }

  // 5. Kemaskini Kadar Cukai Pada UI
  function updateTaxRate() {
    var typeEl = document.getElementById('companyType');
    var taxEl = document.getElementById('tax-rate');
    if (!typeEl || !taxEl) return;

    var type = typeEl.value;
    if (type === 'sdn_bhd_small') {
      taxEl.value = 15;
    } else if (type === 'enterprise') {
      taxEl.value = 0;
    } else {
      taxEl.value = 24;
    }
  }

  // 6. Pertukaran Tab UI
  function switchTab(tabName) {
    var sections = document.querySelectorAll('section');
    sections.forEach(function (sec) {
      sec.style.display = 'none';
    });

    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.classList.remove('active');
    });

    var targetSection = document.getElementById('panel-' + tabName);
    var targetBtn = document.getElementById('tab-' + tabName);

    if (targetSection) targetSection.style.display = 'block';
    if (targetBtn) targetBtn.classList.add('active');
  }

  // 7. Inisialisasi Aplikasi (Init)
  function init() {
    renderCompanyOptions();
    updateTaxRate();
  }

  return {
    init: init,
    renderCompanyOptions: renderCompanyOptions,
    changeCompany: changeCompany,
    addNewCompany: addNewCompany,
    saveCurrentCompany: saveCurrentCompany,
    updateTaxRate: updateTaxRate,
    switchTab: switchTab
  };
})();

// Jalankan init apabila dokumen selesai dimuatkan
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
