/**
 * Kira Enterprise V4 — Unified Storage Engine
 * Handles persistence for clients and journal entries across local storage and workers.
 */
(function (global) {
  'use strict';

  var PREFIX_ENTRIES = 'kiraV4_entries_';
  var PREFIX_CLIENTS = 'kiraV4_clients';

  function getJournalEntries(clientId) {
    return new Promise(function (resolve) {
      if (!clientId) return resolve([]);
      var key = PREFIX_ENTRIES + String(clientId).trim();
      var entries = [];
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          entries = JSON.parse(raw);
        }
      } catch (e) {
        console.error('Storage getJournalEntries error:', e);
      }
      resolve(entries || []);
    });
  }

  function saveJournalEntries(clientId, entries) {
    return new Promise(function (resolve) {
      if (!clientId) return resolve(false);
      var key = PREFIX_ENTRIES + String(clientId).trim();
      try {
        localStorage.setItem(key, JSON.stringify(entries || []));
        resolve(true);
      } catch (e) {
        console.error('Storage saveJournalEntries error:', e);
        resolve(false);
      }
    });
  }

  function getClients() {
    return new Promise(function (resolve) {
      var clients = [];
      try {
        var raw = localStorage.getItem(PREFIX_CLIENTS);
        if (raw) clients = JSON.parse(raw);
      } catch (e) {
        console.error('Storage getClients error:', e);
      }
      resolve(clients || []);
    });
  }

  function saveClient(client) {
    return new Promise(function (resolve) {
      if (!client || !client.clientId) return resolve(false);
      getClients().then(function (clients) {
        var existingIdx = clients.findIndex(function (c) { return c.clientId === client.clientId; });
        if (existingIdx >= 0) {
          clients[existingIdx] = client;
        } else {
          clients.push(client);
        }
        try {
          localStorage.setItem(PREFIX_CLIENTS, JSON.stringify(clients));
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function clearClientEntries(clientId) {
    return new Promise(function (resolve) {
      if (!clientId) return resolve(false);
      try {
        localStorage.removeItem(PREFIX_ENTRIES + String(clientId).trim());
        resolve(true);
      } catch (e) {
        resolve(false);
      }
    });
  }

  var Storage = {
    getJournalEntries: getJournalEntries,
    saveJournalEntries: saveJournalEntries,
    getClients: getClients,
    saveClient: saveClient,
    clearClientEntries: clearClientEntries
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Storage: Storage };
  global.Storage = Storage;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
