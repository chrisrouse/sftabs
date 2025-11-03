// Paste this into the browser console to check what's in storage
// Firefox: Use browser.storage
// Chrome: Use chrome.storage

(async function() {
  const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

  console.log("=== Checking ALL storage areas ===");

  // Check local storage
  console.log("\n1. LOCAL STORAGE:");
  try {
    const local = await storage.local.get(null);
    console.log("Local storage contents:", local);
    console.log("Keys in local:", Object.keys(local));
  } catch (e) {
    console.error("Error reading local storage:", e);
  }

  // Check sync storage
  console.log("\n2. SYNC STORAGE:");
  try {
    const sync = await storage.sync.get(null);
    console.log("Sync storage contents:", sync);
    console.log("Keys in sync:", Object.keys(sync));
  } catch (e) {
    console.error("Error reading sync storage:", e);
  }

  console.log("\n=== Done ===");
})();
