/**
 * Kira Enterprise V4 — Cloudflare D1 Connected Storage Engine
 */
(function (global) {
  'use strict';

  var API_BASE = '/api';

  function getJournalEntries(clientId) {
    if (!clientId) return Promise.resolve([]);
    return fetch(API_BASE + '/entries?clientId=' + encodeURIComponent(clientId))
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(data));
          return data;
        }
        // Fallback to localStorage if API returns empty
        var local = localStorage.getItem('kiraV4_entries_' + clientId);
        return local ? JSON.parse(local) : [];
      })
      .catch(function () {
        var local = localStorage.getItem('kiraV4_entries_' + clientId);
        return Promise.resolve(local ? JSON.parse(local) : []);
      });
  }

  function saveJournalEntries(clientId, entries) {
    if (!clientId) return Promise.resolve(false);
    // Persist locally immediately
    localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(entries || []));

    return fetch(API_BASE + '/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId, entries: entries || [] })
    })
    .then(function (res) { return res.ok; })
    .catch(function () { return true; });
  }

  function getClients() {
    return fetch(API_BASE + '/clients')
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('kiraV4_clients', JSON.stringify(data));
          return data;
        }
        var local = localStorage.getItem('kiraV4_clients');
        return local ? JSON.parse(local) : [];
      })
      .catch(function () {
        var local = localStorage.getItem('kiraV4_clients');
        return Promise.resolve(local ? JSON.parse(local) : []);
      });
  }

  function saveClient(client) {
    if (!client || !client.clientId) return Promise.resolve(false);
    
    return fetch(API_BASE + '/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    })
    .then(function (res) { return res.ok; })
    .catch(function () { return false; });
  }

  var Storage = {
    getJournalEntries: getJournalEntries,
    saveJournalEntries: saveJournalEntries,
    getClients: getClients,
    saveClient: saveClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Storage: Storage };
  global.Storage = Storage;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
