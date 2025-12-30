// popup/js/shared/toast.js
// Toast notification system for showing temporary messages

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether this is an error message (red) or success (green)
 * @param {number} duration - How long to show the toast in milliseconds (default 3000)
 */
function showToast(message, isError = false, duration = 3000) {
  // Remove any existing toast
  const existingToast = document.querySelector('.sftabs-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `sftabs-toast ${isError ? 'error' : 'success'}`;
  toast.textContent = message;

  // Add to document
  document.body.appendChild(toast);

  // Trigger animation by adding 'show' class after a brief delay
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remove toast after duration
  setTimeout(() => {
    toast.classList.remove('show');
    // Wait for fade out animation before removing from DOM
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
