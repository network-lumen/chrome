// Set panel behavior
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: false })
        .catch((error) => console.error(error));
}

// Create context menu on install
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
        if (typeof chrome !== 'undefined' && chrome.contextMenus) {
            chrome.contextMenus.create({
                id: 'openSidePanel',
                title: 'Open Side Panel',
                contexts: ['all']
            });
        }
    });
}

// Handle click
if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'openSidePanel' && tab?.windowId) {
            if (chrome.sidePanel && chrome.sidePanel.open) {
                chrome.sidePanel.open({ windowId: tab.windowId })
                    .catch(console.error);
            }
        }
    });
}
