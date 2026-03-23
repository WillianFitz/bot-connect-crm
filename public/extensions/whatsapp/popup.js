document.getElementById('toggleBtn').addEventListener('click', () => {
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
    if (!tabs.length) {
      document.getElementById('err').style.display = 'block';
      return;
    }
    const tab = tabs[0];
    // Injeta o content script caso ainda não esteja carregado
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] }, () => {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
      chrome.tabs.update(tab.id, { active: true });
      window.close();
    });
  });
});
