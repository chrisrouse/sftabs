// Run this in the browser console on the popup to see what's in storage
(async () => {
  const local = await browser.storage.local.get(null);
  const sync = await browser.storage.sync.get(null);
  console.log('=== LOCAL STORAGE ===');
  console.log(JSON.stringify(local, null, 2));
  console.log('=== SYNC STORAGE ===');
  console.log(JSON.stringify(sync, null, 2));
})();
