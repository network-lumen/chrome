export const openExpandedView = (route: string) => {
    // Check if running in a popup (small window)
    const isPopup = window.innerWidth < 600; // Arbitrary threshold for popup vs full tab/sidepanel

    if (isPopup && chrome.tabs) {
        const url = chrome.runtime.getURL(`index.html#${route}`);
        chrome.tabs.create({ url });
        window.close(); // Close the popup
    } else {
        // Already expanded or cannot open tab, just navigate normally
        // This assumes the caller will handle the internal React Router navigation
        // or we can use window.location.hash = '#' + route;
        window.location.hash = '#' + route;
    }
};
