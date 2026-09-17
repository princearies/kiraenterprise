/**
 * Kira Enterprise V4 — Journal Engine (Promise-based, client-scoped)
 */
(function (global) {
  'use strict';

  function validateEntry(lines) {
    if (!lines || !lines.length) return { success: false, error: 'No lines provided' };
    var totalDebit = 0, totalCredit = 0;
    for (var i = 0; i < lines.length; i++) {
      totalDebit += parseFloat(lines[i].debit) || 0;
      totalCredit += parseFloat(lines[i].credit) || 0;
      if (!lines[i].accountCode || !String(lines[i].accountCode).trim()) {
        return { success: false, error: 'Account code missing' };
      }
    }
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return { success: false, error: 'Debit and Credit must be equal' };
    }
    return { success: true };
  }

  function addEntry(clientId, date, description, lines) {
    var check = validateEntry(lines);
    if (!check.success) return Promise.resolve(check);
    var entry = {
      clientId: String(clientId || '').trim(),
      id: 'je-' + (clientId || 'none') + '-' + String(Date.now()).slice(-6),
      date: String(date || '').trim(),
      description: String(description || '').trim(),
      lines: lines.map(function (l) {
        return {
          accountCode: String(l.accountCode || '').trim(),
          accountName: String(l.accountName || '').trim(),
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0
        };
      })
    };
    if (!global.Storage) {
      return Promise.resolve({ success: false, error: 'Storage module not available' });
    }
    return global.Storage.saveJournalEntry 
      ? global.Storage.saveJournalEntry(clientId, entry).then(function (res) {
          return { success: res.success ? true : false, entry: entry, error: res.error || null };
        })
      : Promise.resolve({ success: false, error: 'Storage saveJournalEntry method missing' });
  }

  function deleteEntry(clientId, entryId) {
    return (global.Storage ? global.Storage.getJournalEntries(clientId) : Promise.resolve([])).then(function (entries) {
      var newEntries = (entries || []).filter(function (e) { return e.id !== entryId; });
      return (global.Storage ? global.Storage.save('kiraV4_entries_' + String(clientId || '').trim(), newEntries) : Promise.resolve({ success: false }));
    }).then(function () { return { success: true }; });
  }

  function editEntry(clientId, entryId, newData) {
    return (global.Storage ? global.Storage.getJournalEntries(clientId) : Promise.resolve([])).then(function (entries) {
      var idx = (entries || []).findIndex(function (e) { return e.id === entryId; });
      if (idx < 0) return Promise.resolve({ success: false, error: 'Entry not found' });
      var updated = Object.assign({}, entries[idx], newData);
      var check = validateEntry(updated.lines || newData.lines);
      if (!check.success) return Promise.resolve(check);
      entries[idx] = updated;
      return (global.Storage ? global.Storage.save('kiraV4_entries_' + String(clientId || '').trim(), entries) : Promise.resolve({ success: false }));
    });
  }

  function renderJournalTable(clientId, containerId) {
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return Promise.resolve();

    return (global.Storage ? global.Storage.getJournalEntries(String(clientId || '').trim()) : Promise.resolve([])).then(function (entries) {
      if (!entries || entries.length === 0) {
        container.innerHTML = '<div style="padding:16px; color:#94a3b8; text-align:center;">No journal entries found for this client.</div>';
        return;
      }

      var html = '<div class="report-header"><h2 class="report-company">GENERAL JOURNAL</h2><p class="report-title">Client ID: ' + (clientId || 'N/A') + '</p></div>';
      html += '<table style="width:100%; border-collapse:collapse; font-family:inherit; font-size:13px;">';
      html += '<thead><tr style="background:#334155; color:#fbbf24; font-weight:bold;">';
      html += '<th style="padding:8px; border-bottom:2px solid #fbbf24;">Date</th>';
      html += '<th style="padding:8px; border-bottom:2px solid #fbbf24;">Ref / ID</th>';
      html += '<th style="padding:8px; border-bottom:2px solid #fbbf24;">Description</th>';
      html += '<th style="padding:8px; border-bottom:2px solid #fbbf24;">Account Details</th>';
      html += '<th align="right" style="padding:8px; border-bottom:2px solid #fbbf24;">Debit (RM)</th>';
      html += '<th align="right" style="padding:8px; border-bottom:2px solid #fbbf24;">Credit (RM)</th>';
      html += '<th class="no-print" style="padding:8px; border-bottom:2px solid #fbbf24; text-align:center;">Actions</th>';
      html += '</tr></thead><tbody>';

      entries.forEach(function (entry) {
        var lines = entry.lines || [];
        lines.forEach(function (line, idx) {
          html += '<tr style="border-bottom:1px solid #334155;">';
          if (idx === 0) {
            html += '<td rowspan="' + lines.length + '" style="padding:8px; vertical-align:top; border-right:1px solid #334155;">' + (entry.date || '') + '</td>';
            html += '<td rowspan="' + lines.length + '" style="padding:8px; vertical-align:top; border-right:1px solid #334155; font-family:monospace;">' + (entry.id || '') + '</td>';
            html += '<td rowspan="' + lines.length + '" style="padding:8px; vertical-align:top; border-right:1px solid #334155;">' + (entry.description || '') + '</td>';
          }
          
          var indent = (line.credit > 0 && line.debit === 0) ? 'padding-left: 20px;' : '';
          html += '<td style="padding:8px; ' + indent + '">' + line.accountCode + ' - ' + line.accountName + '</td>';
          html += '<td align="right" style="padding:8px;">' + (line.debit ? line.debit.toFixed(2) : '—') + '</td>';
          html += '<td align="right" style="padding:8px;">' + (line.credit ? line.credit.toFixed(2) : '—') + '</td>';

          if (idx === 0) {
            html += '<td class="no-print" rowspan="' + lines.length + '" style="padding:8px; text-align:center; vertical-align:top;">';
            html += '<button class="btn-delete" onclick="Journal.deleteEntry(\'' + clientId + '\', \'' + entry.id + '\').then(function(){ Journal.renderJournalTable(\'' + clientId + '\', \'' + (container.id || containerId) + '\'); })">Delete</button>';
            html += '</td>';
          }
          html += '</tr>';
        });
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    });
  }

  var Journal = {
    addEntry: addEntry,
    deleteEntry: deleteEntry,
    editEntry: editEntry,
    validateEntry: validateEntry,
    renderJournalTable: renderJournalTable,
    getEntriesByClient: function (clientId) {
      return global.Storage ? global.Storage.getJournalEntries(String(clientId || '').trim()) : Promise.resolve([]);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Journal: Journal };
  global.Journal = Journal;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
