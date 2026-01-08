// Set side panel behavior
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e) => console.error('Side panel error:', e));
}

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: "openSidePanel",
      title: "Open Side Panel",
      contexts: ["all"]
    });
  }
});

// Handle context menu clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openSidePanel" && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }
  });
}
