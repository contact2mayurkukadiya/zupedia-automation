// background.js

// --- Constants ---
const USERNAME = '7878333205';
const PASSWORD = 'demo@1234';
const MAX_DAILY_TASKS = 20;
const SUBMISSION_INTERVAL_MS = 15000;
let currentToken = null;

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
async function doLogin() {
  await logToUI("Attempting to log in...");
  const formData = new FormData();
  formData.append('username', USERNAME); formData.append('password', PASSWORD); formData.append('lang', 'en');
  const resp = await makeApiCall('https://zucode.zuqedia.com/api/User/Login', formData);
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
  const resp = await makeApiCall('https://zucode.zuqedia.com/api/user/getUserInfo', formData);
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
    const resp = await makeApiCall('https://zucode.zuqedia.com/api/task/getTaskList', formData);
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
  const resp = await makeApiCall('https://zucode.zuqedia.com/api/task/submitTask', formData);
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

// --- Main Automation Flow (Wrapped in try...finally) ---
async function startAutomationFlow() {
  const { isAutomating } = await chrome.storage.local.get('isAutomating');
  if (isAutomating) {
    logToUI("Automation is already in progress.");
    return;
  }

  // Setup state and start the process
  await chrome.storage.local.set({ isAutomating: true, sessionLogs: [] });

  try {
    await logToUI("Automation started.");

    if (!await doLogin()) {
      await logToUI("Initial login failed. Halting process.");
      return;
    }

    let progress = await getUserDailyProgress();
    if (!progress.success) {
      await logToUI("Could not get user progress. Halting.");
      return;
    }

    let tasksNeeded = MAX_DAILY_TASKS - progress.completed;
    if (tasksNeeded <= 0) {
      await logToUI(`All ${MAX_DAILY_TASKS} tasks already done for today.`);
      return;
    }

    await logToUI(`${progress.completed}/${MAX_DAILY_TASKS} tasks done. Need to submit ${tasksNeeded}.`);
    const availableTasks = await fetchTasks(tasksNeeded);

    if (availableTasks.length === 0) {
      await logToUI("No tasks available from API.");
      return;
    }

    const tasksToSubmit = availableTasks.slice(0, tasksNeeded);
    await logToUI(`Starting submission for ${tasksToSubmit.length} tasks...`);

    for (let i = 0; i < tasksToSubmit.length; i++) {
      const task = tasksToSubmit[i];
      await logToUI(`Submitting task ${i + 1}/${tasksToSubmit.length} (ID: ${task.task_id})...`);

      let submitResult = await submitOneTask(task.task_id);

      if (submitResult.reason === 'session_expired') {
        await logToUI("Session expired. Attempting to re-login...");
        if (await doLogin()) {
          await logToUI("Re-login successful. Retrying last task...");
          submitResult = await submitOneTask(task.task_id);
        } else {
          await logToUI("Re-login failed. Stopping automation.");
          break;
        }
      }

      if (!submitResult.success) {
        // If the submission failed for any reason (including code 0 or re-login failure),
        // the error is already logged. We simply continue to the next task.
      }

      if (i < tasksToSubmit.length - 1) {
        await logToUI(`Waiting ${SUBMISSION_INTERVAL_MS / 1000} seconds...`);
        await sleep(SUBMISSION_INTERVAL_MS);
      }
    }
  } catch (error) {
    await logToUI(`A critical error occurred: ${error.message}`);
    console.error("CRITICAL FLOW ERROR:", error);
  } finally {
    // This block will ALWAYS run, whether the process succeeded or failed.
    await logToUI("Automation process finished.");
    await chrome.storage.local.set({ isAutomating: false });
    // Send a final update to re-enable the button in the UI
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
  }
}

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "start") {
    startAutomationFlow();
    return true;
  }
});

// Clear logs on first install for a clean slate.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isAutomating: false, sessionLogs: [] });
});