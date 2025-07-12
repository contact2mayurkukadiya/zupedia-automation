document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const statusDiv = document.getElementById('status');

    // Check if the token is available in storage and update UI
    chrome.storage.local.get(['token', 'isReady'], (result) => {
        if (result.isReady && result.token) {
            startButton.disabled = false;
            statusDiv.textContent = 'Ready to start the task process.';
        } else {
            startButton.disabled = true;
            statusDiv.textContent = 'Please navigate to or reload a zupedia.com page to enable.';
        }
    });

    // Handle button click
    startButton.addEventListener('click', () => {
        statusDiv.textContent = 'Process started! Check background logs for progress.';
        startButton.disabled = true;

        // Send a message to background script to start the tasks
        chrome.runtime.sendMessage({ command: "start" });
    });
});