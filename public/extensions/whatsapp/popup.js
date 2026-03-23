// Ao abrir o popup, já toggle o painel no WhatsApp Web automaticamente
chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, tabs => {
  if (!tabs.length) {
    document.getElementById('msg').style.display = 'none';
    document.getElementById('err').style.display = 'block';
    return;
  }
  const tab = tabs[0];
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] }, () => {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }, () => {
      chrome.tabs.update(tab.id, { active: true });
      window.close(); // Fecha o popup imediatamente
    });
  });
});
