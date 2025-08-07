document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const startButton = document.getElementById('startButton');
    const logContainer = document.getElementById('log-container');
    const modeToggle = document.getElementById('mode-toggle');

    // Mode containers
    const singleAccountModeDiv = document.getElementById('single-account-mode');
    const multiAccountModeDiv = document.getElementById('multi-account-mode');

    // Input fields
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const accountJsonTextarea = document.getElementById('account-json');

    // --- Functions ---
    async function refreshUi() {
        try {
            const data = await chrome.storage.local.get([
                'isAutomating', 'sessionLogs', 'savedUsername', 'savedJson', 'savedMode'
            ]);
            const isAutomating = data.isAutomating || false;

            // Restore last used mode and inputs
            modeToggle.checked = data.savedMode || false;
            usernameInput.value = data.savedUsername || '';
            accountJsonTextarea.value = data.savedJson || '';
            toggleModeView();

            // Disable all inputs if automation is running
            const allInputs = [usernameInput, passwordInput, accountJsonTextarea, modeToggle, startButton];
            allInputs.forEach(input => input.disabled = isAutomating);

            // Render logs
            const logs = data.sessionLogs || [];
            if (logs.length > 0) {
                logContainer.textContent = logs.join('\n');
            } else if (isAutomating) {
                logContainer.textContent = "Automation in progress...";
            } else {
                logContainer.textContent = "Ready. Select a mode, enter credentials, and click start.";
            }
            logContainer.scrollTop = logContainer.scrollHeight;

        } catch (error) {
            console.error("Error refreshing UI:", error);
            logContainer.textContent = "Error loading state.";
        }
    }

    function toggleModeView() {
        if (modeToggle.checked) { // Multi-account mode
            singleAccountModeDiv.style.display = 'none';
            multiAccountModeDiv.style.display = 'block';
        } else { // Single-account mode
            singleAccountModeDiv.style.display = 'block';
            multiAccountModeDiv.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    modeToggle.addEventListener('change', toggleModeView);

    startButton.addEventListener('click', async () => {
        let accountsList = [];

        if (modeToggle.checked) { // Multi-Account Mode
            const jsonText = accountJsonTextarea.value.trim();
            if (!jsonText) {
                logContainer.textContent = "Error: Accounts JSON cannot be empty.";
                return;
            }
            try {
                console.log("JSON Text:", jsonText);
                const parsed = JSON.parse(jsonText);
                if (!parsed.accounts || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
                    throw new Error("JSON must have a non-empty 'accounts'.");
                }
                accountsList = parsed.accounts;
                await chrome.storage.local.set({ savedJson: jsonText, savedMode: true });

            } catch (e) {
                logContainer.textContent = `Error: Invalid JSON format.\n${e.message}`;
                return;
            }
        } else { // Single-Account Mode
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            if (!username || !password) {
                logContainer.textContent = "Error: Please enter both username and password.";
                return;
            }
            accountsList.push({ username, password });
            await chrome.storage.local.set({ savedUsername: username, savedMode: false });
        }

        // Disable UI and send command
        const allInputs = [usernameInput, passwordInput, accountJsonTextarea, modeToggle, startButton];
        allInputs.forEach(input => input.disabled = true);
        logContainer.textContent = "Sending start command to background process...";

        chrome.runtime.sendMessage({
            command: "start",
            accountsList: accountsList // Always send a list
        });
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'STATE_UPDATED') refreshUi();
        return true;
    });

    // Initial setup
    refreshUi();
});
