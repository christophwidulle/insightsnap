chrome.runtime.onInstalled.addListener((details) => {
  console.log('[InsightSnap] installed', details.reason);
});
