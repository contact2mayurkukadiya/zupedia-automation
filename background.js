// Function to create a delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main logic for fetching and submitting tasks
async function handleTasks(token) {
  console.log("Starting task automation process...");

  const getTasksByPage = (pageNo) => {
    const formData = new FormData();
    formData.append('group_id', '29');
    formData.append('task_level', '4');
    formData.append('page_no', pageNo);
    formData.append('is_u', '0');
    formData.append('lang', 'en');
    formData.append('token', token);
    return fetch('https://zucode.zuqedia.com/api/task/getTaskList', { method: 'POST', body: formData })
      .then(response => response.json());
  };

  try {
    let allTasks = [], currentPage = 1, hasMorePages = true;
    console.log("Fetching tasks. Goal: at least 20 tasks.");

    while (allTasks.length < 20 && hasMorePages) {
      const result = await getTasksByPage(currentPage);
      if (result.code === 1 && result.info && result.info.length > 0) {
        allTasks = allTasks.concat(result.info);
        console.log(`Found ${result.info.length} tasks. Total: ${allTasks.length}`);
        if (result.data_current_page >= result.data_total_page) hasMorePages = false;
      } else {
        hasMorePages = false;
      }
      currentPage++;
    }

    if (allTasks.length === 0) {
      console.log("No tasks found to submit.");
      return;
    }

    const tasksToSubmit = allTasks.slice(0, 20);
    console.log(`Starting submission of ${tasksToSubmit.length} tasks.`);

    for (let i = 0; i < tasksToSubmit.length; i++) {
      const task = tasksToSubmit[i];
      const submitFormData = new FormData();
      submitFormData.append('order_id', task.task_id);
      submitFormData.append('lang', 'en');
      submitFormData.append('token', token);

      console.log(`Submitting task ${i + 1}/${tasksToSubmit.length} (ID: ${task.task_id})...`);

      const submitResponse = await fetch('https://zucode.zuqedia.com/api/task/submitTask', { method: 'POST', body: submitFormData }).then(res => res.json());
      console.log(`Task ${task.task_id} submitted. Response:`, submitResponse);

      if (i < tasksToSubmit.length - 1) {
        console.log("Waiting 15 seconds...");
        await sleep(15000);
      }
    }

    console.log("All tasks for this cycle submitted.");

  } catch (error) {
    console.error('An error occurred during automation:', error);
  }
}

// Listen for the "start" command from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "start") {
    // Retrieve the token from storage and start the process
    chrome.storage.local.get('token', (result) => {
      if (result.token) {
        handleTasks(result.token);
      } else {
        console.error("Could not start: token not found in storage.");
      }
    });
    // Return true to indicate an async response, although we don't send one here.
    return true;
  }
});