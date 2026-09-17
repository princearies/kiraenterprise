/**
 * Kira Enterprise V4 — Multi-Client Accounting System (Main App Controller)
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
      });
  }

  function populateCompanyDropdown(companies) {
    var select = document.getElementById('company-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Company --</option>';
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
      taxRate: (typeof company.taxRate === 'number') ? company.taxRate : 24,
      yearEnd: company.yearEnd
    };
    currentClientId = company.clientId;

    var select = document.getElementById('company-select');
    if (select) select.value = company.clientId;

    var typeSelect = document.getElementById('companyType');
    if (typeSelect) typeSelect.value = company.type || 'sdn_bhd_normal';
    
    var taxInput = document.getElementById('tax-rate');
    if (taxInput) taxInput.value = currentCompany.taxRate;

    // Seed data into LocalStorage for Ledger calculations
    if (company.clientId && company.journalEntries) {
      var lsKey = 'kiraV4_entries_' + company.clientId;
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch (e) {}
      if (existing.length === 0) {
        localStorage.setItem(lsKey, JSON.stringify(company.journalEntries || []));
      }
    }

    recalcAll();
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
    renderJournalForm();
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
      '<form id="journal-form" onsubmit="event.preventDefault(); App.saveJournalFromForm();">' +
      '<label>Date: <input type="date" id="j-date" required></label><br>' +
      '<label>Description: <input type="text" id="j-desc"></label><br>' +
      '<div id="entry-lines"></div><br>' +
      '<button type="button" onclick="App.addLineToForm(\'\',\'\',0,0)">+ Add Line</button> ' +
      '<button type="submit" id="btn-save-entry">Save Entry</button>' +
      '</form><div id="journal-list" style="margin-top:20px;"></div>';
    
    addLineToForm('', '', 0, 0);
    refreshJournalList();
  }

  function refreshJournalList() {
    var list = document.getElementById('journal-list');
    if (!list || !currentClientId) return;
    var entries = [];
    try {
      entries = JSON.parse(localStorage.getItem('kiraV4_entries_' + currentClientId) || '[]');
    } catch (e) { entries = []; }

    if (!entries || entries.length === 0) { 
      list.innerHTML = '<p style="color:#94a3b8;">No entries found for ' + (currentClientId || '') + '.</p>'; 
      return; 
    }

    var html = '<h3>Journal Entries (' + entries.length + '):</h3><table style="width:100%;border-collapse:collapse;"><tr><th>Date</th><th>Description</th><th>Lines</th><th>Actions</th></tr>';
    entries.forEach(function (e) {
      html += '<tr style="border-bottom:1px solid #334155;">';
      html += '<td style="padding:8px;">' + (e.date || '') + '</td>';
      html += '<td style="padding:8px;">' + (e.description || '') + '</td>';
      html += '<td style="padding:8px;">' + (e.lines ? e.lines.length : 0) + '</td>';
      html += '<td style="padding:8px;">';
      html += '<button class="btn-edit" onclick="App.editEntry(\'' + (e.id || '') + '\')">✏️ Edit</button> ';
      html += '<button class="btn-delete" onclick="App.deleteEntry(\'' + (e.id || '') + '\')">🗑️ Delete</button>';
      html += '</td></tr>';
    });
    html += '</table>';
    list.innerHTML = html;
  }

  function addLineToForm(accountCode, accountName, debit, credit) {
    var container = document.getElementById('entry-lines');
    if (!container) return;
    var row = document.createElement('div');
    row.style.margin = '4px 0';
    row.innerHTML = '<input type="text" class="line-code" placeholder="Account Code" value="' + (accountCode || '') + '" style="width:120px;padding:4px;margin-right:4px;"> ' +
      '<input type="number" class="line-debit" placeholder="Debit" value="' + (debit || 0) + '" step="0.01" style="width:100px;padding:4px;margin-right:4px;"> ' +
      '<input type="number" class="line-credit" placeholder="Credit" value="' + (credit || 0) + '" step="0.01" style="width:100px;padding:4px;margin-right:4px;"> ' +
      '<button type="button" onclick="this.parentElement.remove()" style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>';
    container.appendChild(row);
  }

  function saveJournalFromForm() {
    if (!currentClientId) { showToast('Select a company first'); return; }
    var date = document.getElementById('j-date') ? document.getElementById('j-date').value : '';
    var desc = document.getElementById('j-desc') ? document.getElementById('j-desc').value : '';
    var lines = [];
    document.querySelectorAll('#entry-lines > div').forEach(function (row) {
      var codeEl = row.querySelector('.line-code');
      var drEl = row.querySelector('.line-debit');
      var crEl = row.querySelector('.line-credit');
      lines.push({
        accountCode: codeEl ? (codeEl.value || '').trim() : '',
        debit: parseFloat(drEl ? drEl.value : 0) || 0,
        credit: parseFloat(crEl ? crEl.value : 0) || 0
      });
    });

    lines = lines.filter(function (l) { return l.accountCode || l.debit || l.credit; });
    var totalDebit = lines.reduce(function (s, l) { return s + l.debit; }, 0);
    var totalCredit = lines.reduce(function (s, l) { return s + l.credit; }, 0);

    if (!lines.length) { showToast('No journal lines!'); return; }
    if (Math.abs(totalDebit - totalCredit) > 0.01) { showToast('Debit ≠ Credit!'); return; }

    var entries = JSON.parse(localStorage.getItem('kiraV4_entries_' + currentClientId) || '[]');
    entries.push({
      clientId: currentClientId,
      id: 'je-' + currentClientId + '-' + Date.now(),
      date: date,
      description: desc,
      lines: lines
    });

    localStorage.setItem('kiraV4_entries_' + currentClientId, JSON.stringify(entries));
    showToast('✓ Entry saved');
    recalcAll();
  }

  function renderLedgerTab() {
    var panel = document.getElementById('panel-ledger');
    if (!panel) return;
    if (!global.Ledger || !global.Ledger.generateGeneralLedger) { panel.innerHTML = '<h2>General Ledger</h2><p>Module missing.</p>'; return; }
    global.Ledger.generateGeneralLedger(currentClientId).then(function (rows) {
      if (!rows || rows.length === 0) { panel.innerHTML = '<h2>General Ledger</h2><p>No ledger entries found for ' + currentClientId + '.</p>'; return; }
      var html = '<h2>General Ledger — ' + (currentCompany ? currentCompany.name : currentClientId) + '</h2>';
      html += '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#334155;color:#fbbf24;"><th style="padding:8px;">Code</th><th style="padding:8px;">Account</th><th style="padding:8px;text-align:right;">Debit</th><th style="padding:8px;text-align:right;">Credit</th><th style="padding:8px;text-align:right;">Balance</th></tr></thead><tbody>';
      rows.forEach(function (a) {
        html += '<tr style="border-bottom:1px solid #334155;"><td style="padding:8px;">' + a.code + '</td><td style="padding:8px;">' + (a.name || '') + '</td><td align="right" style="padding:8px;">' + a.totalDebit.toFixed(2) + '</td><td align="right" style="padding:8px;">' + a.totalCredit.toFixed(2) + '</td><td align="right" style="padding:8px;">' + a.balance.toFixed(2) + '</td></tr>';
      });
      html += '</tbody></table>';
      panel.innerHTML = html;
    });
  }

  function renderTrialBalanceTab() {
    var panel = document.getElementById('panel-trial');
    if (!panel) return;
    if (!global.TrialBalance || !global.TrialBalance.generateTrialBalance) { panel.innerHTML = '<h2>Trial Balance</h2><p>Module missing.</p>'; return; }
    global.TrialBalance.generateTrialBalance(currentClientId).then(function (tb) {
      panel.innerHTML = tb.html || '<p>Trial balance empty.</p>';
    });
  }

  function renderPLTab() {
    var panel = document.getElementById('panel-pl');
    if (!panel) return;
    if (!global.TradingPL || !global.TradingPL.generateProfitLoss) { panel.innerHTML = '<h2>Trading & P&L</h2><p>Module missing.</p>'; return; }
    var opts = { taxRate: currentCompany ? currentCompany.taxRate : 24 };
    global.TradingPL.generateProfitLoss(currentClientId, opts).then(function (pl) {
      pl = pl || {};
      if (currentCompany) {
        pl.companyName = currentCompany.name;
        pl.year = currentCompany.yearEnd || new Date().getFullYear();
      }
      panel.innerHTML = global.TradingPL.renderPLTab(pl);
    });
  }

  function renderBalanceSheetTab() {
    var panel = document.getElementById('panel-bs');
    if (!panel) return;
    if (!global.BalanceSheet || !global.BalanceSheet.generateBalanceSheet) { panel.innerHTML = '<h2>Balance Sheet</h2><p>Module missing.</p>'; return; }
    var opts = { taxRate: currentCompany ? currentCompany.taxRate : 24 };
    if (currentCompany) opts.companyName = currentCompany.name;
    global.BalanceSheet.generateBalanceSheet(currentClientId, opts).then(function (bs) {
      panel.innerHTML = bs.html || '<p>Balance sheet empty.</p>';
    });
  }

  function renderCashFlowTab() {
    var panel = document.getElementById('panel-cashflow');
    if (!panel) return;
    if (!global.CashFlow || !global.CashFlow.generateCashFlow) { panel.innerHTML = '<h2>Cash Flow</h2><p>Module missing.</p>'; return; }
    global.CashFlow.generateCashFlow(currentClientId, {}).then(function (cf) {
      panel.innerHTML = cf.html || '<p>Cash flow empty.</p>';
    });
  }

  function renderTaxTab() {
    var panel = document.getElementById('panel-tax');
    if (!panel) return;
    if (!global.TradingPL || !global.TradingPL.generateProfitLoss) return;
    var opts = { taxRate: currentCompany ? currentCompany.taxRate : 24 };
    global.TradingPL.generateProfitLoss(currentClientId, opts).then(function (pl) {
      var taxOut = document.getElementById('tax-output');
      if (taxOut && global.TaxComputation && global.TaxComputation.renderTaxComputation) {
        taxOut.innerHTML = global.TaxComputation.renderTaxComputation({
          profitBeforeTax: pl.netProfitBeforeTax || 0,
          addBackExpenses: pl.addBackExpenses || 0,
          allowableDeductions: 0,
          zakatPaid: pl.zakatPerniagaan || 0,
          taxRate: opts.taxRate,
          year: pl.year || new Date().getFullYear()
        });
      }
    });
  }

  function setupTabs() {
    currentTab = 'journal';
  }

  function switchTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.classList.remove('active'); });
    var activeBtn = document.getElementById('tab-' + name) || document.getElementById('tab-journal');
    if (activeBtn) activeBtn.classList.add('active');

    ['journal', 'ledger', 'trial', 'pl', 'bs', 'cashflow', 'tax'].forEach(function (n) {
      var panel = document.getElementById('panel-' + n);
      if (panel) panel.style.display = (n === name) ? 'block' : 'none';
    });
  }

  function updateTaxRate() {
    var s = document.getElementById('companyType');
    var rate = s ? ((s.value === 'sdn_bhd_small') ? 15 : (s.value === 'enterprise') ? 0 : 24) : 24;
    var inEl = document.getElementById('tax-rate');
    if (inEl) inEl.value = rate;
    if (currentCompany) currentCompany.taxRate = rate;
    recalcAll();
  }

  var App = {
    initApp: initApp,
    changeCompany: changeCompany,
    switchTab: switchTab,
    renderJournalForm: renderJournalForm,
    addLineToForm: addLineToForm,
    saveJournalFromForm: saveJournalFromForm,
    refreshJournalList: refreshJournalList,
    recalcAll: recalcAll,
    updateTaxRate: updateTaxRate,
    loadCompanyData: loadCompanyData
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', initApp);
})(typeof window !== 'undefined' ? window : this);
