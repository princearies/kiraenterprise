function saveUserCompanyEntries(clientId, entries) {
  if (!clientId) {
    return Promise.resolve({ success: false, error: 'Missing clientId' });
  }
  
  // Ensure entries is an array
  if (!Array.isArray(entries)) {
    entries = [];
  }
  
  // Save to localStorage first (instant feedback)
  try {
    localStorage.setItem('kiraV4_entries_' + clientId, JSON.stringify(entries));
  } catch (e) {
    console.error('localStorage save failed:', e);
  }
  
  // Then save to D1 via API
  return fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      clientId: clientId, 
      entries: entries,
      company_meta: { updated: new Date().toISOString() }
    })
  })
  .then(function(res) { 
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json(); 
  })
  .then(function(data) { 
    console.log('D1 save success:', data);
    return { success: true }; 
  })
  .catch(function(err) {
    console.error('D1 save failed:', err);
    return { success: false, error: err.message, warning: 'Saved to localStorage only' };
  });
}
