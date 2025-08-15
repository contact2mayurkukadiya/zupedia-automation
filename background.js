// background.js

// --- Constants ---
// const USERNAME = '7878333205';
// const USERNAME = '7283918897';
// const PASSWORD = 'demo@1234';
const MAX_DAILY_TASKS = 20;
const SUBMISSION_INTERVAL_MS = 15000;
let currentToken = null;
const baseURL = 'https://app.zupedia.com'

// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * NEW: Centralized logging and state update function.
 * This is the ONLY function that should modify logs or notify the UI.
 */
async function logToUI(message) {
  console.log(message); // Log for service worker debugging
  try {
    const result = await chrome.storage.local.get('sessionLogs');
    const logs = result.sessionLogs || [];
    logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    await chrome.storage.local.set({ sessionLogs: logs });
    // Send a generic state update message. The popup will handle refreshing.
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
  } catch (e) {
    console.error("Failed to write log or update state:", e);
  }
}

// --- API Functions (makeApiCall, doLogin, etc.) ---
// These are now lean and only report results. The main flow handles logic.
async function makeApiCall(url, body) { /* ... no changes ... */
  try {
    const response = await fetch(url, { method: 'POST', body: body });
    if (!response.ok) return { code: response.status, code_dec: `HTTP Error: ${response.status}` };
    return await response.json();
  } catch (error) {
    return null;
  }
}
async function doLogin(username, password) {
  await logToUI("Attempting to log in...");
  const formData = new FormData();
  formData.append('username', username); // Use argument
  formData.append('password', password); // Use argument
  // formData.append('username', USERNAME); formData.append('password', PASSWORD); 
  formData.append('lang', 'en');
  const resp = await makeApiCall(`${baseURL}/api/User/Login`, formData);
  if (resp?.code === 1 && resp.info?.token) {
    currentToken = resp.info.token;
    await logToUI("Login successful!");
    return true;
  }
  await logToUI(`Login failed: ${resp?.code_dec || 'Network error'}`);
  return false;
}

async function getUserDailyProgress() { /* ... no changes ... */
  if (!currentToken) return { success: false, reason: 'no_token_for_user_info' };
  const formData = new FormData();
  formData.append('lang', 'en'); formData.append('token', currentToken);
  const resp = await makeApiCall(`${baseURL}/api/user/getUserInfo`, formData);
  if (resp?.code === 1 && resp.info) {
    return { success: true, completed: resp.info.task_wc_num || 0 };
  }
  return { success: false, reason: (resp?.code === 204 ? 'session_expired' : 'api_error') };
}

async function fetchTasks(neededCount) { /* ... no changes ... */
  let allTasks = [];
  let page = 1;
  let hasMore = true;
  while (allTasks.length < neededCount && hasMore) {
    const formData = new FormData();
    formData.append('group_id', '29'); formData.append('task_level', '4'); formData.append('page_no', page);
    formData.append('is_u', '0'); formData.append('lang', 'en'); formData.append('token', currentToken);
    const resp = await makeApiCall(`${baseURL}/api/task/getTaskList`, formData);
    if (resp?.code === 1 && resp.info?.length > 0) {
      allTasks.push(...resp.info);
      if (parseInt(resp.data_current_page) >= parseInt(resp.data_total_page)) hasMore = false;
    } else {
      hasMore = false;
    }
    page++;
  }
  await logToUI(`Collected ${allTasks.length} available tasks.`);
  return allTasks;
}

/** UPDATED: submitOneTask to handle code 0 **/
async function submitOneTask(taskId) {
  const formData = new FormData();
  formData.append('order_id', taskId); formData.append('lang', 'en'); formData.append('token', currentToken);
  const resp = await makeApiCall(`${baseURL}/api/task/submitTask`, formData);
  if (resp?.code === 1) {
    await logToUI(`> Success submitting task ID: ${taskId}`);
    return { success: true };
  } else if (resp?.code === 0) { // Specific check for code 0
    await logToUI(`> FAILED (Code 0): Task ${taskId} rejected. Reason: "${resp.code_dec}". Moving on.`);
    return { success: false, reason: 'api_rejected' };
  } else if (resp?.code === 204) {
    return { success: false, reason: 'session_expired' };
  } else {
    await logToUI(`> FAILED submitting task ${taskId}. Details: ${resp?.code_dec || 'Unknown API error'}`);
    return { success: false, reason: 'api_error' };
  }
}


async function processSingleAccount(username, password) {
  // 1. LOGIN
  if (!await doLogin(username, password)) {
    await logToUI("Login failed for this account. Skipping to next.");
    return; // Stop processing this account
  }

  // 2. GET PROGRESS
  let progress = await getUserDailyProgress();
  if (!progress.success) {
    await logToUI("Could not get user progress. Skipping to next.");
    return;
  }

  // 3. CHECK IF DONE
  let tasksNeeded = MAX_DAILY_TASKS - progress.completed;
  if (tasksNeeded <= 0) {
    await logToUI(`All ${MAX_DAILY_TASKS} tasks already done for today. Finished with this account.`);
    await showCompletionNotification(username);
    return;
  }

  await logToUI(`${progress.completed}/${MAX_DAILY_TASKS} tasks done. Need to submit ${tasksNeeded}.`);

  // 4. FETCH TASKS
  const availableTasks = await fetchTasks(tasksNeeded);
  if (availableTasks.length === 0) {
    await logToUI("No tasks available from API. Finished with this account.");
    return;
  }
  const tasksToSubmit = availableTasks.slice(0, tasksNeeded);
  await logToUI(`Starting submission for ${tasksToSubmit.length} tasks...`);

  // 5. SUBMIT TASKS
  for (let i = 0; i < tasksToSubmit.length; i++) {
    const task = tasksToSubmit[i];
    await logToUI(`Submitting task ${i + 1}/${tasksToSubmit.length} (ID: ${task.task_id})...`);
    let submitResult = await submitOneTask(task.task_id);

    // Handle session expiry by re-logging in
    if (submitResult.reason === 'session_expired') {
      await logToUI("Session expired. Attempting to re-login...");
      if (await doLogin(username, password)) {
        await logToUI("Re-login successful. Retrying last task...");
        await submitOneTask(task.task_id); // Re-try submission
      } else {
        await logToUI("Re-login failed. Skipping to next account.");
        return; // Abort this account
      }
    }

    if (i < tasksToSubmit.length - 1) {
      await logToUI(`Waiting ${SUBMISSION_INTERVAL_MS / 1000} seconds...`);
      await sleep(SUBMISSION_INTERVAL_MS);
    }
  }

  await logToUI(`Finished processing all tasks for account ${username}.`);
  await showCompletionNotification(username);
}

// --- MASTER AUTOMATION CONTROLLER ---
// Manages the queue of accounts
async function startMultiAccountAutomation(accountsList) {
  const { isAutomating } = await chrome.storage.local.get('isAutomating');
  if (isAutomating) {
    logToUI("Automation is already in progress.");
    return;
  }

  // Set global automation state
  await chrome.storage.local.set({ isAutomating: true, sessionLogs: [] });
  await logToUI(`Automation started for ${accountsList.length} account(s).`);

  try {
    // Loop through each account in the list
    for (let i = 0; i < accountsList.length; i++) {
      const account = accountsList[i];
      if (!account.username || !account.password) {
        await logToUI(`Skipping account index ${i} due to missing credentials.`);
        continue;
      }

      await logToUI(`--- Starting Account ${i + 1}/${accountsList.length}: ${account.username} ---`);

      // Use a try/catch for each account to ensure one failure doesn't stop the whole batch
      try {
        await processSingleAccount(account.username, account.password);
      } catch (e) {
        await logToUI(`A critical error occurred while processing ${account.username}: ${e.message}`);
      }

      currentToken = null; // Clear token before next account
      await logToUI(`--- Finished with Account ${i + 1}/${accountsList.length} ---`);
    }
  } catch (e) {
    await logToUI(`A fatal error occurred : ${e.message}`);
  } finally {
    // This block runs after all accounts are processed
    await logToUI("All accounts have been processed. Automation finished.");
    if (accountsList.length > 0) {
      await showFinalNotification(accountsList.length);
    }
    await chrome.storage.local.set({ isAutomating: false });
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }); // Final UI update
  }
}

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "start" && request.accountsList) {
    startMultiAccountAutomation(request.accountsList);
    return true; // Indicates an async response
  }
});

// Clear logs on first install for a clean slate.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isAutomating: false,
    sessionLogs: [],
    savedUsername: '',
    savedJson: '',
    savedMode: false
  });
});

async function showCompletionNotification(username) {
  const notificationId = `account-complete-${username}-${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png', // Path to an icon in your extension's folder
    title: 'Zupedia: Account Complete',
    message: `Finished processing all available tasks for the account: ${username}`,
    priority: 2 // Ranges from -2 to 2. 2 is highest.
  });
  console.log(`Showing completion notification for account: ${username}`);
}

async function showFinalNotification(accountCount) {
  chrome.notifications.create(`automation-complete-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Zupedia: All Automation Finished',
    message: `The extension has finished processing all ${accountCount} accounts in the queue.`,
    priority: 1
  });
}
