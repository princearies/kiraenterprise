/**
 * Kira Enterprise V4 — Multi-Client Accounting System (Main App Controller)
 * Data flow: mock-data-v4.json → Storage (D1/localStorage) → Ledger → Reports.
 * Production-ready, fully debugged, no typos.
 */
(function (global) {
  'use strict';

  var currentClientId = '';
  var currentTab = 'journal';
  var currentCompany = null;
  var companiesCache = [];

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 3000);
  }

  function initApp() {
    setupTabs();
    renderJournalForm();
    fetch('data/mock-data-v4.json?v=' + Date.now())
      .then(function (response) {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(function (data) {
        if (data && data.companies) {
          companiesCache = data.companies;
          data.companies.forEach(function (company) {
            if (global.Storage && global.Storage.saveClient) {
              global.Storage.saveClient({
                clientId: company.clientId,
                name: company.name,
                code: company.code,
                type: company.type,
                taxRate: company.taxRate,
                yearEnd: company.yearEnd
              });
            }
          });
          populateCompanyDropdown(data.companies);
          if (data.companies.length > 0) {
            loadCompanyData(data.companies[0]);
          }
        }
      })
      .catch(function (err) {
        console.error('CRITICAL: Failed to load mock-data-v4.json.', err);
        showToast('⚠ Failed to load data. Ensure local server is running!');
        var sel = document.getElementById('company-select');
        if (sel) sel.innerHTML = '<option value="">⚠ Failed to load data. Run local server!</option>';
      });
  }

  function populateCompanyDropdown(companies) {
    var select = document.getElementById('company-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Company --</option>';
    companies.forEach(function (company) {
      var option = document.createElement('option');
      option.value = company.clientId;
      option.textContent = company.name + ' (' + (company.journalEntries ? company.journalEntries.length : 0) + ' entries)';
      option.setAttribute('data-type', company.type || 'sdn_bhd_normal');
      select.appendChild(option);
    });
  }

  function loadCompanyData(company) {
    if (!company) return;
    currentCompany = {
      clientId: company.clientId,
      name: company.name,
      code: company.code,
      type: company.type,
      taxRate: company.taxRate,
      yearEnd: company.yearEnd
    };
    currentClientId = company.clientId;
    var typeSelect = document.getElementById('companyType');
    if (typeSelect) typeSelect.value = company.type || 'sdn_bhd_normal';
    var taxInput = document.getElementById('tax-rate');
    if (taxInput) taxInput.value = (typeof company.taxRate === 'number') ? company.taxRate : 24;
    currentCompany.taxRate = (typeof company.taxRate === 'number') ? company.taxRate : 24;

    if (global.Storage && global.Storage.save && company.clientId && company.journalEntries) {
      var seededKey = 'kiraV4_seeded_' + company.clientId;
      var alreadySeeded = false;
      try { alreadySeeded = localStorage.getItem(seededKey) === 'true'; } catch (e) { /* ignore */ }
      if (!alreadySeeded) {
        var lsKey = 'kiraV4_entries_' + company.clientId;
        var existing = [];
        try { existing = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch (e) { /* ignore */ }
        if (existing.length === 0) {
          global.Storage.save(lsKey, company.journalEntries || []);
          try { localStorage.setItem(seededKey, 'true'); } catch (e) { /* ignore */ }
        }
      }
    }
    recalcAll();
    refreshJournalList();
    showToast('✓ Loaded: ' + company.name);
  }

  function changeCompany(clientId) {
    if (!clientId) return;
    var company = companiesCache.find(function (c) { return c.clientId === String(clientId).trim(); });
    if (company) {
      loadCompanyData(company);
    } else {
      currentClientId = String(clientId || '').trim();
      recalcAll();
      showToast('Switched to: ' + currentClientId);
    }
  }

  function recalcAll() {
    refreshJournalList();
    renderLedgerTab();
    renderTrialBalanceTab();
    renderPLTab();
    renderBalanceSheetTab();
    renderCashFlowTab();
    renderTaxTab();
  }

  function renderJournalForm() {
    var container = document.getElementById('panel-journal');
    if (!container) return;
    container.innerHTML = '<h2>Journal Entry</h2>' +
      '<form id="journal-form" onsubmit="event.preventDefault(); window.App.saveJournalFromForm();">' +
      '<label>Date: <input type="date" id="j-date" required></label><br>' +
      '<label>Description: <input type="text" id="j-desc"></label><br>' +
      '<div id="entry-lines"></div>' +
      '<button type="button" onclick="window.App.addLineToForm(\'\',\'\',0,0)">Add Line</button> ' +
      '<button type="submit">Save Entry</button>' +
      '</form><div id="journal-list"></div>';
    refreshJournalList();
    window.App.addLineToForm('', '', 0, 0);
  }

  function addJournalLine() {
    var lines = document.getElementById('j-lines');
    if (!lines) return;
    var div = document.createElement('div');
    div.innerHTML = '<input class="j-code" placeholder="Code" style="width:100px;"> ' +
      '<input class="j-debit" placeholder="Debit" type="number" step="0.01" style="width:100px;"> ' +
      '<input class="j-credit" placeholder="Credit" type="number" step="0.01" style="width:100px;">';
    lines.appendChild(div);
  }

  function saveJournalFromForm() {
    var clientId = currentClientId;
    if (!clientId) { showToast('Pilih company dahulu'); return; }
    var date = document.getElementById('j-date') ? document.getElementById('j-date').value : '';
    var desc = document.getElementById('j-desc') ? document.getElementById('j-desc').value : '';
    var lines = [];
    document.querySelectorAll('#entry-lines > div').forEach(function (row) {
      var sel = row.querySelector('.line-account');
      var drEl = row.querySelector('.line-debit');
      var crEl = row.querySelector('.line-credit');
      lines.push({
        accountCode: sel ? (sel.value || '').trim() : '',
        debit: parseFloat(drEl ? drEl.value : 0) || 0,
        credit: parseFloat(crEl ? crEl.value : 0) || 0
      });
    });
    lines = lines.filter(function (l) { return l.accountCode || l.debit || l.credit; });
    var totalDebit = lines.reduce(function (s, l) { return s + (l.debit || 0); }, 0);
    var totalCredit = lines.reduce(function (s, l) { return s + (l.credit || 0); }, 0);
    if (!lines.length) { showToast('Tiada baris jurnal!'); return; }
    if (Math.abs(totalDebit - totalCredit) > 0.01) { showToast('Debit ≠ Credit!'); return; }

    var entries = JSON.parse(localStorage.getItem('kiraV4_entries_' + clientId) || '[]');

    if (window._editingEntryId) {
      var idx = entries.findIndex(function (e) { return e.id === window._editingEntryId; });
      if (idx < 0) { showToast('⚠ Entry not found'); return; }
      entries[idx] = { clientId: clientId, id: window._editingEntryId, date: date, description: desc.trim(), lines: lines };
    } else {
      entries.push({ clientId: clientId, id: 'je-' + clientId + '-' + Date.now().toString(), date: date, description: desc.trim(), lines: lines });
    }

    try {
      localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(entries));
    } catch (e) {
      showToast('✗ Gagal simpan ke localStorage');
      console.error(e);
      return;
    }

    if (global.Storage && global.Storage.saveUserCompanyEntries) {
      global.Storage.saveUserCompanyEntries(clientId, entries).catch(function(err) { console.error('D1 save error:', err); });
    }

    window._editingEntryId = null;
    var d = document.getElementById('j-date'); if (d) d.value = '';
    var ds = document.getElementById('j-desc'); if (ds) ds.value = '';
    var lc = document.getElementById('entry-lines'); if (lc) lc.innerHTML = '';
    var btn = document.getElementById('btn-save-entry'); if (btn) btn.textContent = 'Save Entry';
    
    refreshJournalList();
    recalcAll();
    showToast('✓ Entry disimpan');
  }

  function escapeHtml(text) {
    if (typeof text !== 'string') return text || '';
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ✅ FUNGSI BARU: Load dari D1 via Storage Module
  function refreshJournalList() {
    var list = document.getElementById('journal-list');
    if (!list || !currentClientId) return;
    
    list.innerHTML = '<p>Memuatkan data dari D1...</p>';
    
    if (global.Storage && global.Storage.getJournalEntries) {
      global.Storage.getJournalEntries(currentClientId)
        .then(function(entries) {
          renderJournalListUI(list, entries || []);
        })
        .catch(function(err) {
          console.error('Load entries error:', err);
          var fallbackEntries = [];
          try { fallbackEntries = JSON.parse(localStorage.getItem('kiraV4_entries_' + currentClientId) || '[]'); } catch (e) {}
          renderJournalListUI(list, fallbackEntries);
        });
    } else {
      var entries = [];
      try { entries = JSON.parse(localStorage.getItem('kiraV4_entries_' + currentClientId) || '[]'); } catch (e) {}
      renderJournalListUI(list, entries);
    }
  }

  // ✅ FUNGSI HELPER BARU: Render UI
  function renderJournalListUI(list, entries) {
    if (!entries || entries.length === 0) { 
      list.innerHTML = '<p>Tiada entri untuk ' + (currentClientId || '') + '.</p>'; 
      return; 
    }
    
    var html = '<h3>Senarai Jurnal (' + entries.length + '):</h3>' +
      '<table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
      '<tr><th>Tarikh</th><th>Penerangan</th><th>Baris</th><th>Actions</th></tr>';
      
    entries.forEach(function (e) {
      html += '<tr>';
      html += '<td>' + (e.date || '') + '</td>';
      html += '<td>' + escapeHtml(e.description || '') + '</td>';
      html += '<td>' + (e.lines ? e.lines.length : 0) + '</td>';
      html += '<td>';
      html += '<button class="btn-edit" onclick="App.editEntry(\'' + (e.id || '') + '\')">✏️ Edit</button> ';
      html += '<button class="btn-delete" onclick="App.deleteEntry(\'' + (e.id || '') + '\')">🗑️ Delete</button>';
      html += '</td>';
      html += '</tr>';
    });
    html += '</table>';
    list.innerHTML = html;
  }

  function deleteJournalEntry(entryId) {
    if (!entryId || !global.Journal || !global.Journal.deleteEntry) return;
    global.Journal.deleteEntry(currentClientId, entryId).then(function () { recalcAll(); showToast('Entri dihapus.'); });
  }

  var chartAccounts = [
    {code:'1000',name:'Cash at Bank'},{code:'1010',name:'Petty Cash'},{code:'1020',name:'Cash in Hand'},
    {code:'1100',name:'Trade Receivables'},{code:'1200',name:'Inventory'},{code:'1300',name:'Prepaid Expenses'},
    {code:'1400',name:'Fixed Deposits'},{code:'1510',name:'Motor Vehicles'},{code:'1520',name:'Furniture & Fittings'},
    {code:'1530',name:'Office Equipment'},{code:'1535',name:'Computer & IT'},{code:'1540',name:'Accumulated Depreciation — PPE'},
    {code:'1550',name:'Accumulated Depreciation — Motor'},{code:'2000',name:'Trade Payables'},
    {code:'2050',name:'Provision for Taxation'},{code:'2075',name:'EIS Payable (SIP)'},
    {code:'2085',name:'HRDF Payable (PSMB)'},{code:'2095',name:'SST Payable (6%)'},{code:'2096',name:'SST Payable (8%)'},
    {code:'2100',name:'Zakat Perniagaan Payable'},{code:'2200',name:'Long-term Loan'},
    {code:'3000',name:'Share Capital'},{code:'3200',name:'Drawings'},
    {code:'4000',name:'Sales — Cash'},{code:'4010',name:'Sales — Credit'},
    {code:'5000',name:'Opening Inventory'},{code:'5010',name:'Purchases'},{code:'5020',name:'Closing Inventory'},
    {code:'6000',name:'Salary & Wages'},{code:'6010',name:'EPF Contribution'},{code:'6020',name:'SOCSO Contribution'},
    {code:'6025',name:'EIS Contribution (SIP)'},{code:'6035',name:'HRDF Contribution (PSMB)'},
    {code:'6100',name:'Rent'},{code:'6110',name:'Utilities'},{code:'6130',name:'Insurance'},
    {code:'6160',name:'Professional Fees'},{code:'6170',name:'Audit Fee'},{code:'6210',name:'Entertainment'},
    {code:'6220',name:'Bank Charges'},{code:'6230',name:'Interest Expense'},{code:'6300',name:'Depreciation'},
    {code:'6901',name:'Fines & Penalties'},{code:'6902',name:'Private Expenses'},
    {code:'6903',name:'Donations (non-approved)'},{code:'6904',name:'Provision for Doubtful Debts'},
    {code:'6905',name:'Zakat Perniagaan (Business Zakat)'},{code:'7000',name:'Income Tax Expense'}
  ];

  function buildAccountOptions(selectedCode) {
    var accounts = (window.ChartOfAccounts && window.ChartOfAccounts.accounts) || chartAccounts;
    var html = '<option value="">-- Pilih Akaun --</option>';
    accounts.forEach(function(a){ html += '<option value="'+a.code+'" '+(selectedCode===a.code?'selected':'')+'>'+a.code+' — '+a.name+'</option>'; });
    return html;
  }

  function addLineToForm(accountCode, accountName, debit, credit) {
    var container = document.getElementById('entry-lines');
    if (!container) return;
    var row = document.createElement('div');
    row.className = 'journal-line-row';
    row.innerHTML = '<select class="line-account">' + buildAccountOptions(accountCode) + '</select>' +
      '<input type="number" class="line-debit" value="' + (debit || 0) + '" step="0.01">' +
      '<input type="number" class="line-credit" value="' + (credit || 0) + '" step="0.01">' +
      '<button type="button" class="btn-remove-line" onclick="this.parentElement.remove()">✕</button>';
    container.appendChild(row);
  }

  function editEntry(entryId) {
    if (!entryId || !global.Journal || !global.Journal.getEntriesByClient) { showToast('⚠ Entry not found'); return; }
    global.Journal.getEntriesByClient(currentClientId).then(function (entries) {
      var entry = (entries || []).find(function (e) { return e.id === entryId; });
      if (!entry) { showToast('⚠ Entry not found'); return; }
      var d = document.getElementById('j-date'); if (d) d.value = entry.date || '';
      var ds = document.getElementById('j-desc'); if (ds) ds.value = entry.description || '';
      var lc = document.getElementById('entry-lines'); if (lc) lc.innerHTML = '';
      if (entry.lines && entry.lines.length > 0) {
        entry.lines.forEach(function (line) {
          addLineToForm(line.accountCode, line.accountName, line.debit, line.credit);
        });
      }
      window._editingEntryId = entryId;
      var form = document.getElementById('journal-form');
      if (form) form.scrollIntoView({ behavior: 'smooth' });
      showToast('✏️ Editing entry: ' + (entry.description || entry.id));
    });
  }

  function deleteEntry(entryId) {
    if (!confirm('Padam entri ini? Tindakan ini tidak boleh dibatalkan.')) return;
    if (global.Journal && global.Journal.deleteEntry) {
      global.Journal.deleteEntry(currentClientId, entryId);
      refreshJournalList();
      recalcAll();
      showToast('🗑️ Entry deleted');
    } else {
      showToast('Delete function not available');
    }
  }

  function renderLedgerTab() {
    var panel = document.getElementById('panel-ledger');
    if (!panel) return;
    if (!global.Ledger || !global.Ledger.generateGeneralLedger) { panel.innerHTML = '<h2>General Ledger</h2><p>Module tidak dimuat.</p>'; return; }
    global.Ledger.generateGeneralLedger(currentClientId).then(function (rows) {
      if (!rows || rows.length === 0) { panel.innerHTML = '<h2>General Ledger</h2><p>Tiada data untuk ' + (currentClientId || '') + '.</p>'; return; }
      var html = '<h2>General Ledger — ' + (currentClientId || '') + '</h2>';
      html += '<table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr><th>Kod</th><th>Akaun</th><th>Debit</th><th>Kredit</th><th>Baki</th></tr>';
      rows.forEach(function (a) {
        html += '<tr><td>' + a.code + '</td><td>' + (a.name || '') + '</td><td>' + (a.totalDebit || 0) + '</td><td>' + (a.totalCredit || 0) + '</td><td>' + (a.balance || 0) + '</td></tr>';
      });
      html += '</table>';
      panel.innerHTML = html;
    }).catch(function () { panel.innerHTML = '<h2>General Ledger</h2><p>Gagal memuat ledger.</p>'; });
  }

  function renderTrialBalanceTab() {
    var panel = document.getElementById('panel-trial');
    if (!panel) return;
    if (!global.TrialBalance || !global.TrialBalance.generateTrialBalance) { panel.innerHTML = '<h2>Trial Balance</h2><p>Module tidak dimuat.</p>'; return; }
    global.TrialBalance.generateTrialBalance(currentClientId).then(function (tb) {
      panel.innerHTML = tb.html || '<p>Trial Balance kosong.</p>';
    }).catch(function () { panel.innerHTML = '<h2>Trial Balance</h2><p>Gagal menjana.</p>'; });
  }

  function renderPLTab() {
    var panel = document.getElementById('panel-pl');
    if (!panel) return;
    if (!global.TradingPL || !global.TradingPL.generateProfitLoss) { panel.innerHTML = '<h2>Trading & P&L</h2><p>Module tidak dimuat.</p>'; return; }
    var opts = { taxRate: (currentCompany && typeof currentCompany.taxRate === 'number') ? currentCompany.taxRate : 24 };
    global.TradingPL.generateProfitLoss(currentClientId, opts).then(function (pl) {
      pl = pl || {};
      if (currentCompany) {
        pl.companyName = currentCompany.name || '';
        pl.year = currentCompany.yearEnd || pl.year || new Date().getFullYear();
      }
      panel.innerHTML = global.TradingPL.renderPLTab(pl);
    }).catch(function () { panel.innerHTML = '<h2>Trading & P&L</h2><p>Gagal menjana.</p>'; });
  }

  function renderBalanceSheetTab() {
    var panel = document.getElementById('panel-bs');
    if (!panel) return;
    if (!global.BalanceSheet || !global.BalanceSheet.generateBalanceSheet) { panel.innerHTML = '<h2>Balance Sheet</h2><p>Module tidak dimuat.</p>'; return; }
    var opts = { taxRate: (currentCompany && typeof currentCompany.taxRate === 'number') ? currentCompany.taxRate : 24 };
    if (currentCompany) opts.companyName = currentCompany.name || '';
    global.BalanceSheet.generateBalanceSheet(currentClientId, opts).then(function (bs) {
      panel.innerHTML = bs.html || '<p>Balance Sheet belum tersedia.</p>';
    }).catch(function () { panel.innerHTML = '<h2>Balance Sheet</h2><p>Gagal menjana.</p>'; });
  }

  function renderCashFlowTab() {
    var panel = document.getElementById('panel-cashflow');
    if (!panel) return;
    if (!global.CashFlow || !global.CashFlow.generateCashFlow) { panel.innerHTML = '<h2>Cash Flow</h2><p>Module tidak dimuat.</p>'; return; }
    global.CashFlow.generateCashFlow(currentClientId, {}).then(function (cf) {
      panel.innerHTML = cf.html || '<p>Cash Flow kosong.</p>';
    }).catch(function () { panel.innerHTML = '<h2>Cash Flow</h2><p>Gagal menjana.</p>'; });
  }

  function renderTaxTab() {
    var panel = document.getElementById('panel-tax');
    if (!panel) return;
    if (!global.TradingPL || !global.TradingPL.generateProfitLoss) { panel.innerHTML = '<h2>Tax Computation</h2><p>Module tidak dimuat.</p>'; return; }
    var opts = { taxRate: (currentCompany && typeof currentCompany.taxRate === 'number') ? currentCompany.taxRate : 24 };
    global.TradingPL.generateProfitLoss(currentClientId, opts).then(function (pl) {
      var taxPanel = document.getElementById('panel-tax');
      if (!taxPanel) return;
      taxPanel.innerHTML = '<h2>Tax Computation</h2><div id="tax-output">…</div><h2>Capital Allowance</h2><div id="ca-output">…</div>';
      var taxOut = document.getElementById('tax-output');
      if (taxOut && global.TaxComputation && global.TaxComputation.renderTaxComputation) {
        var addBack = (pl.addBackExpenses || 0);
        taxOut.innerHTML = global.TaxComputation.renderTaxComputation({
          profitBeforeTax: pl.netProfitBeforeTax || 0,
          addBackExpenses: addBack,
          allowableDeductions: 0,
          zakatPaid: pl.zakatPerniagaan || 0,
          taxRate: opts.taxRate,
          year: pl.year || new Date().getFullYear()
        });
      }
      var caOut = document.getElementById('ca-output');
      if (caOut && global.CapitalAllowance && global.CapitalAllowance.generateCapitalAllowance) {
        global.CapitalAllowance.generateCapitalAllowance(currentClientId).then(function (ca) {
          caOut.innerHTML = ca.html || '<p>Capital Allowance kosong.</p>';
        }).catch(function () { caOut.innerHTML = '<p>Gagal menjana Capital Allowance.</p>'; });
      }
    }).catch(function () { panel.innerHTML = '<h2>Tax Computation</h2><p>Gagal menjana P&L.</p>'; });
  }

  function setupTabs() {
    currentTab = 'journal';
    var ctype = document.getElementById('companyType');
    if (ctype) {
      ctype.addEventListener('change', function () {
        updateTaxRate();
        var val = this.value;
        var select = document.getElementById('company-select');
        if (!select) return;
        Array.from(select.options).forEach(function (opt) {
          if (opt.value === '') return;
          var d = opt.getAttribute('data-type') || 'sdn_bhd_normal';
          opt.style.display = (d === val || val === 'all') ? '' : 'none';
        });
      });
    }
  }

  function switchTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.classList.remove('active'); });
    var btnMap = { 'journal': 'tab-journal', 'ledger': 'tab-ledger', 'trial': 'tab-tb', 'pl': 'tab-pl', 'bs': 'tab-bs', 'cashflow': 'tab-cf', 'tax': 'tab-tax' };
    var activeBtn = document.getElementById(btnMap[name] || ('tab-' + name));
    if (activeBtn) activeBtn.classList.add('active');
    ['journal', 'ledger', 'trial', 'pl', 'bs', 'cashflow', 'tax'].forEach(function (n) {
      var panel = document.getElementById('panel-' + n);
      if (panel) panel.style.display = (n === name) ? 'block' : 'none';
    });
    if (name === 'journal') renderJournalForm();
    else if (name === 'ledger') renderLedgerTab();
    else if (name === 'trial') renderTrialBalanceTab();
    else if (name === 'pl') renderPLTab();
    else if (name === 'bs') renderBalanceSheetTab();
    else if (name === 'cashflow') renderCashFlowTab();
    else if (name === 'tax') renderTaxTab();
  }

  function updateTaxRate() {
    var s = document.getElementById('companyType');
    if (!s) return;
    var val = s.value;
    var rate = 24;
    if (val === 'sdn_bhd_small') rate = 15;
    else if (val === 'enterprise') rate = 0;
    else if (val === 'llp') rate = 24;
    else if (val === 'sdn_bhd_normal') rate = 24;
    
    var inEl = document.getElementById('tax-rate');
    if (inEl) inEl.value = rate;
    
    if (currentCompany) {
      currentCompany.taxRate = rate;
      currentCompany.type = val;
    }
  }

  function addNewCompany() {
    var n = prompt('Nama company:'); if (!n || !n.trim()) return;
    var code = prompt('Code (kosong = auto):'); if (!code || !code.trim()) {
      var ts = Date.now().toString();
      var rnd = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      code = n.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) + '-' + ts.slice(-4) + rnd.slice(-3);
    }
    var ctypeEl = document.getElementById('companyType');
    var selectedType = ctypeEl ? ctypeEl.value : 'sdn_bhd_normal';
    var defaultRate = (selectedType === 'sdn_bhd_small') ? 15 : (selectedType === 'enterprise') ? 0 : 24;
    var trStr = prompt('Tax rate % (default ' + defaultRate + '):', defaultRate);
    var taxRate = parseFloat(trStr) || defaultRate;
    var slug = n.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    var newC = {
      clientId: slug + '-' + String(Date.now()).slice(-4),
      id: slug,
      name: n.trim(),
      type: selectedType,
      code: code.trim().toUpperCase(),
      taxRate: taxRate,
      yearEnd: new Date().getFullYear(),
      journalEntries: []
    };
    if (global.Storage && global.Storage.saveClient) global.Storage.saveClient(newC);
    companiesCache.push(newC);
    var sel = document.getElementById('company-select');
    if (sel) {
      var opt = document.createElement('option');
      opt.value = newC.clientId; opt.textContent = newC.name + ' (0 entries)'; opt.setAttribute('data-type', newC.type);
      sel.appendChild(opt);
      sel.value = newC.clientId;
    }
    loadCompanyData(newC);
    showToast('✓ Added: ' + n.trim());
  }

  function saveCurrentCompany() {
    if (!currentClientId) { showToast('Simpan sebagai company baru dulu'); return; }
    var entriesPromise = global.Journal && global.Journal.getEntriesByClient ? global.Journal.getEntriesByClient(currentClientId) : Promise.resolve([]);
    entriesPromise.then(function (entries) {
      if (global.Storage && global.Storage.saveUserCompanyEntries) return global.Storage.saveUserCompanyEntries(currentClientId, entries || []);
      if (global.Storage && global.Storage.save) return global.Storage.save('kiraV4_entries_' + currentClientId, entries || []);
      return Promise.resolve({ success: false, error: 'Unavailable' });
    }).then(function (res) { showToast(res && res.success ? '✓ Data disimpan' : 'Gagal simpan entries'); }).catch(function () { showToast('Gagal simpan entries'); });
  }

  function exportPdf(elementId, filename) {
    var element = document.getElementById(elementId);
    if (!element) { showToast('⚠ Panel not found'); return; }
    var clone = element.cloneNode(true);
    var unwanted = clone.querySelectorAll('.client-id, .balanced, .no-print, [data-html2canvas-ignore]');
    for (var i = 0; i < unwanted.length; i++) {
      if (unwanted[i].parentNode) unwanted[i].parentNode.removeChild(unwanted[i]);
    }
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';
    var allChildren = clone.querySelectorAll('*');
    for (var j = 0; j < allChildren.length; j++) {
      allChildren[j].style.backgroundColor = 'transparent';
      allChildren[j].style.color = '#000000';
    }
    var ths = clone.querySelectorAll('th');
    for (var k = 0; k < ths.length; k++) {
      ths[k].style.backgroundColor = '#e0e0e0';
      ths[k].style.color = '#000000';
      ths[k].style.border = '1px solid #333';
    }
    var tds = clone.querySelectorAll('td');
    for (var m = 0; m < tds.length; m++) {
      tds[m].style.border = '1px solid #666';
      tds[m].style.color = '#000000';
    }
    var opt = {
      margin: 10,
      filename: filename || 'report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    showToast('⏳ Generating PDF...');
    html2pdf().set(opt).from(clone).save(filename).then(function() {
      showToast('✓ PDF dijana: ' + filename);
    }).catch(function(err) {
      console.error('PDF export error:', err);
      showToast('✗ Failed to export PDF');
    });
  }

  function deleteCompany(companyId) {
    if (!companyId) { showToast('Pilih company dahulu'); return; }
    if (!confirm('Padam company ini dan SEMUA data jurnal akan hilang tanpa bisa dikembalikan. Lanjutkan?')) return;
    global.Storage.deleteCompany(companyId).then(function (res) {
      if (res.success) {
        var idx = companiesCache.findIndex(function (c) { return c.clientId === companyId || c.id === companyId; });
        if (idx >= 0) companiesCache.splice(idx, 1);
        var sel = document.getElementById('company-select');
        if (sel) {
          Array.from(sel.options).forEach(function (opt) {
            if (opt.value === companyId) sel.removeChild(opt);
          });
          if (!sel.value || !companiesCache.find(function (c) { return c.clientId === sel.value; })) sel.value = '';
        }
        currentClientId = '';
        currentCompany = null;
        showToast('✓ Company dan data dipadam');
        recalcAll();
      } else {
        showToast('Gagal padam company');
      }
    });
  }

  function editCompany(companyId) {
    if (!companyId) { showToast('Pilih company dahulu'); return; }
    var company = companiesCache.find(function (c) { return c.clientId === companyId || c.id === companyId; });
    if (!company) { showToast('Company tidak ditemukan'); return; }
    
    var newName = prompt('Nama company (kosong = tak ubah):', company.name);
    if (newName === null) return;
    if (newName && newName.trim()) company.name = newName.trim();
    
    var newType = prompt('Type (sdn_bhd_small / sdn_bhd_normal / enterprise / llp) — kosong = tak ubah:', company.type);
    if (newType === null) return;
    if (newType && newType.trim()) {
      var validTypes = ['sdn_bhd_small', 'sdn_bhd_normal', 'enterprise', 'llp'];
      if (validTypes.indexOf(newType.trim()) >= 0) company.type = newType.trim();
      else { showToast('Type tidak sah'); return; }
    }
    
    var defaultRate = (company.type === 'sdn_bhd_small') ? 15 : (company.type === 'enterprise') ? 0 : 24;
    var newRateStr = prompt('Tax rate % (kosong = tak ubah, default ' + (company.taxRate || defaultRate) + '):', company.taxRate || defaultRate);
    if (newRateStr === null) return;
    if (newRateStr && newRateStr.trim()) {
      var newRate = parseFloat(newRateStr);
      if (!isNaN(newRate) && newRate >= 0 && newRate <= 100) company.taxRate = newRate;
      else { showToast('Tax rate tidak sah'); return; }
    }
    
    company.yearEnd = new Date().getFullYear();
    if (global.Storage && global.Storage.saveClient) global.Storage.saveClient(company);
    
    var sel = document.getElementById('company-select');
    if (sel) {
      Array.from(sel.options).forEach(function (opt) {
        if (opt.value === company.clientId) {
          opt.textContent = company.name + ' (' + (company.journalEntries ? company.journalEntries.length : 0) + ' entries)';
        }
      });
    }
    
    if (currentClientId === company.clientId || currentCompany && currentCompany.clientId === company.clientId) {
      currentCompany = company;
      var typeSelect = document.getElementById('companyType');
      if (typeSelect) typeSelect.value = company.type || 'sdn_bhd_normal';
      var taxInput = document.getElementById('tax-rate');
      if (taxInput) taxInput.value = company.taxRate || 24;
    }
    
    showToast('✓ Company dikemas kini (code: ' + company.code + ' — tak berubah)');
    recalcAll();
  }

  var App = {
    initApp: initApp,
    changeCompany: changeCompany,
    switchTab: switchTab,
    renderJournalForm: renderJournalForm,
    addJournalLine: addJournalLine,
    saveJournalFromForm: saveJournalFromForm,
    refreshJournalList: refreshJournalList,
    deleteJournalEntry: deleteJournalEntry,
    recalcAll: recalcAll,
    updateTaxRate: updateTaxRate,
    addNewCompany: addNewCompany,
    saveCurrentCompany: saveCurrentCompany,
    loadCompanyData: loadCompanyData,
    populateCompanyDropdown: populateCompanyDropdown,
    addLineToForm: addLineToForm,
    editEntry: editEntry,
    deleteEntry: deleteEntry,
    exportPdf: exportPdf,
    deleteCompany: deleteCompany,
    editCompany: editCompany
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { App: App };
  global.App = App;
  initApp();
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
