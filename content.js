const token = localStorage.getItem('Token');
if (token) {
  // Save the token and a ready flag to extension storage
  chrome.storage.local.set({ token: token, isReady: true });
} else {
  // If user is not logged in, ensure the state is not ready
  chrome.storage.local.set({ isReady: false });
}