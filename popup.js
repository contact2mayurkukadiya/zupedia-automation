// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const logContainer = document.getElementById('log-container');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    /**
     * The single source of truth for updating the UI.
     * Fetches the current state, logs, and saved username from storage.
     */
    async function refreshUi() {
        try {
            // Fetch username along with other state
            const data = await chrome.storage.local.get(['isAutomating', 'sessionLogs', 'savedUsername']);
            const isAutomating = data.isAutomating || false;
            const logs = data.sessionLogs || [];

            // Populate username field if it exists
            if (data.savedUsername) {
                usernameInput.value = data.savedUsername;
            }

            // Update button and input field state
            startButton.disabled = isAutomating;
            usernameInput.disabled = isAutomating;
            passwordInput.disabled = isAutomating;

            // Render the logs
            if (logs.length > 0) {
                logContainer.textContent = logs.join('\n');
            } else if (isAutomating) {
                logContainer.textContent = "Automation in progress...";
            } else {
                logContainer.textContent = "Ready. Enter your credentials and click 'Start Automation'.";
            }

            logContainer.scrollTop = logContainer.scrollHeight;
        } catch (error) {
            console.error("Error refreshing UI:", error);
            logContainer.textContent = "Error loading state. Please check the extension's console.";
        }
    }

    refreshUi();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'STATE_UPDATED') {
            refreshUi();
        }
        return true;
    });

    // Handle the start button click
    startButton.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value; // Don't trim password

        // Validate input
        if (!username || !password) {
            logContainer.textContent = "Error: Please enter both a username and password.";
            return;
        }

        // Save username for convenience (password is not saved for security)
        await chrome.storage.local.set({ savedUsername: username });

        // Immediately disable the UI and show feedback
        startButton.disabled = true;
        usernameInput.disabled = true;
        passwordInput.disabled = true;
        logContainer.textContent = "Sending start command to background process...";

        // Tell the background script to start, now with credentials
        chrome.runtime.sendMessage({
            command: "start",
            credentials: {
                username: username,
                password: password
            }
        });
    });
});