// Set panel behavior
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    // Check if contextMenus API is available
    if (chrome.contextMenus) {
        chrome.contextMenus.create({
            id: 'openSidePanel',
            title: 'Open Side Panel',
            contexts: ['all']
        });
    }
});

// Handle click - check if contextMenus API is available
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'openSidePanel' && tab?.windowId) {
            // Requires user interaction (click) which context menu provides
            chrome.sidePanel.open({ windowId: tab.windowId })
                .catch(console.error);
        }
    });
}
