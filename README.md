# Zupedia Task Automator

A Chrome extension designed to automate daily tasks on the Zupedia website. This extension will automatically log in, check your daily task progress, fetch new tasks, and submit them sequentially until your daily limit is reached.

## Features

- **Automatic Login:** Securely logs into your Zupedia account using predefined credentials.
- **Daily Progress Check:** Automatically checks how many tasks you've already completed for the day.
- **Task Fetching:** Intelligently fetches the exact number of tasks needed to meet your daily goal (up to 20).
- **Sequential Task Submission:** Submits tasks one by one at a controlled interval (15 seconds) to mimic human behavior and avoid overwhelming the server.
- **Real-time Logging:** Provides a live log in the extension popup, showing every step of the process, from login attempts to individual task submissions and completion status.
- **Smart State Management:** The "Start" button is disabled while the automation is running to prevent multiple instances. The state is saved, so even if you close the popup, the process continues in the background.
- **Session Renewal:** If the session expires during the process, the extension will automatically attempt to log in again and continue where it left off.
- **Error Handling:** The extension is built to handle common issues like login failures, API errors, or tasks being rejected, logging the outcome and continuing where possible.

## How to Install

Since this is a custom-built extension, you'll need to install it manually in developer mode.

1.  **Download the Extension Files:** Make sure you have all the extension files (`background.js`, `popup.html`, `popup.js`, `content.js`, `manifest.json`, etc.) in a single folder.
2.  **Open Chrome Extensions:** Open Google Chrome, click the three-dots menu in the top-right corner, select **Extensions**, and then **Manage Extensions**.
3.  **Enable Developer Mode:** In the top-right corner of the Extensions page, toggle the "Developer mode" switch to **On**.
4.  **Load the Extension:** Click the **Load unpacked** button that appears on the left.
5.  **Select the Folder:** In the file dialog, navigate to and select the folder containing your extension's files.
6.  **Done!** The "Zupedia Task Automator" extension should now appear in your list of extensions, and its icon will be added to your Chrome toolbar.

## How to Use

1.  **Pin the Extension:** Click the puzzle piece icon in your Chrome toolbar and pin the **Zupedia Task Automator** to make it easily accessible.
2.  **Open the Popup:** Click on the extension's icon to open the popup window.
3.  **Start the Process:** Click the **Start Automation** button.
4.  **Monitor the Progress:** The button will become disabled, and the "Live Logs" section will immediately start showing the automation's progress. You can watch as it logs in, fetches your user info, and starts submitting tasks.
5.  **Let it Run:** You can close the popup, and the extension will continue to run in the background. The process will stop automatically once all 20 tasks for the day are completed or if it runs out of available tasks. Re-opening the popup will show you the latest logs.

The log will inform you when the entire process is complete.

## Technical Overview

*   **`background.js` (Service Worker):** The core of the extension. It runs in the background and handles all the automation logic, including API calls for login, fetching tasks, and submitting them. It manages the automation state (`isAutomating`) and logs all actions to `chrome.storage`.
*   **`popup.js` / `popup.html`:** The user interface. This allows the user to start the process and view the real-time logs. It communicates with the background script and dynamically updates the UI based on the current state stored in `chrome.storage`.
*   **`content.js`:** A script designed to run on the Zupedia website. In this version, it's primarily used to read the `Token` from the website's `localStorage` if the user is already logged in, although the main automation flow relies on its own login process.
*   **`chrome.storage.local`:** Used to store the automation state (`isAutomating`) and the session logs (`sessionLogs`). This ensures that the state persists even if the popup is closed or the service worker goes inactive.
*   **`chrome.runtime.onMessage`:** Used for communication between the popup script (to send the "start" command) and the background script (to send "state updated" signals).

### Hardcoded Values

**Please Note:** The following values are hardcoded directly into `background.js`. To use this for a different account or with different settings, you will need to modify the source code.

*   **Username:** `phone number`
*   **Password:** `password`
*   **Max Daily Tasks:** `20`
*   **Submission Interval:** `15 seconds`

## Disclaimer

This extension is for personal use only. Automating interactions with a website may be against its terms of service. Use this tool responsibly and at your own risk. The developer is not responsible for any consequences of its use, including but not limited to account suspension.
