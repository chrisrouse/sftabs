// Paste this into the browser console to check what's in storage
// Firefox: Use browser.storage
// Chrome: Use chrome.storage

(async function() {
  const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

  // Check local storage
  try {
    const local = await storage.local.get(null);
  } catch (e) {
    console.error("Error reading local storage:", e);
  }

  // Check sync storage
  try {
    const sync = await storage.sync.get(null);
  } catch (e) {
    console.error("Error reading sync storage:", e);
  }
})();
