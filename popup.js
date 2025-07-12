// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const logContainer = document.getElementById('log-container');

    /**
     * The single source of truth for updating the UI.
     * Fetches the current state and logs from storage and renders them.
     */
    async function refreshUi() {
        try {
            const data = await chrome.storage.local.get(['isAutomating', 'sessionLogs']);
            const isAutomating = data.isAutomating || false;
            const logs = data.sessionLogs || [];

            // Update button state based on whether automation is running
            startButton.disabled = isAutomating;

            // Render the logs
            if (logs.length > 0) {
                logContainer.textContent = logs.join('\n');
            } else if (isAutomating) {
                logContainer.textContent = "Automation is starting, preparing logs...";
            } else {
                logContainer.textContent = "Ready. Click the 'Start Automation' button.";
            }

            // Always scroll to the bottom to show the latest entries
            logContainer.scrollTop = logContainer.scrollHeight;
        } catch (error) {
            console.error("Error refreshing UI:", error);
            logContainer.textContent = "Error loading state. Please check the extension's service worker console.";
        }
    }

    // Refresh the UI as soon as the popup opens
    refreshUi();

    // Listen for update messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // When a message comes in, it's a signal that state has changed.
        // We just need to re-render the UI from storage.
        if (request.type === 'STATE_UPDATED') {
            refreshUi();
        }
        return true;
    });

    // Handle the start button click
    startButton.addEventListener('click', () => {
        // Immediately disable the button and show feedback
        startButton.disabled = true;
        logContainer.textContent = "Sending start command to background process...";
        // Tell the background script to start the automation flow
        chrome.runtime.sendMessage({ command: "start" });
    });
});