export const openExpandedView = (route: string) => {
    /* The popup is the one view that cannot grow; the side panel and a full tab
       both already have the room. Read the marker the page was opened with
       rather than guessing from the width — the popup is 400px wide by design
       and a narrow side panel measures the same. An unmarked view is not
       assumed to be the popup: it already has room, so there is nothing to
       expand into. */
    const isPopup = new URLSearchParams(window.location.search).get('view') === 'popup';

    if (isPopup && chrome.tabs) {
        const url = chrome.runtime.getURL(`index.html?view=tab#${route}`);
        chrome.tabs.create({ url });
        window.close(); // Close the popup
    } else {
        // Already expanded or cannot open tab, just navigate normally
        // This assumes the caller will handle the internal React Router navigation
        // or we can use window.location.hash = '#' + route;
        window.location.hash = '#' + route;
    }
};
