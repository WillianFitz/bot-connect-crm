chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator Instagram instalada.");
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
