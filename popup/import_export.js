let SFTabsUtils;


// DOM elements
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const fileInput = document.getElementById('import-file-input');
const statusMessage = document.getElementById('status-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('Import/Export page loaded');
  
	// Ensure utils are available
	SFTabsUtils = window.SFTabsUtils || {};
  
	// Set up event listeners
	exportButton.addEventListener('click', exportSettings);
	importButton.addEventListener('click', importSettings);
	fileInput.addEventListener('change', handleFileSelect);
  
	// Apply theme
	applyThemeFromStorage();
  });

// Apply theme based on saved user settings
function applyThemeFromStorage() {
	browser.storage.sync.get('userSettings')
	  .then((result) => {
		if (result.userSettings && result.userSettings.themeMode) {
		  const themeMode = result.userSettings.themeMode;
		  SFTabsUtils.uiHelpers.applyTheme(themeMode);
		}
	  })
	  .catch(error => {
		console.error('Error loading theme settings:', error);
	  });
  }

// Export settings function
function exportSettings() {
	console.log('Exporting settings');
	
	SFTabsUtils.storageHelpers.exportAll()
	  .then(jsonString => {
		// Create a Blob containing the data
		const blob = new Blob([jsonString], { type: 'application/json' });
  
		// Create an object URL for the blob
		const url = URL.createObjectURL(blob);
  
		// Generate timestamp for the filename
		const now = new Date();
		const timestamp = now.getFullYear() + '-' +
		  ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
		  ('0' + now.getDate()).slice(-2) + '_' +
		  ('0' + now.getHours()).slice(-2) + '-' +
		  ('0' + now.getMinutes()).slice(-2);
  
		// Create the filename with timestamp
		const filename = `sftabs_config_${timestamp}.json`;
  
		// Create a temporary anchor element
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
  
		// Append to the DOM
		document.body.appendChild(a);
  
		// Trigger the download
		a.click();
  
		// Clean up
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
  
		showStatus('Configuration exported successfully', false);
	  })
	  .catch(error => {
		console.error('Error exporting configuration:', error);
		showStatus('Error exporting configuration: ' + error.message, true);
	  });
  }
  

// Import settings function - simplified direct approach
function importSettings() {
	console.log('Import function started');
	fileInput.click();
}

// File selection handler
function handleFileSelect(event) {
	console.log('File selection handler triggered');
	const file = event.target.files[0];
  
	if (!file) {
	  console.log('No file selected');
	  return;
	}
  
	console.log('File selected:', file.name);
  
	const reader = new FileReader();
  
	reader.onload = function(e) {
	  try {
		console.log('File read successfully');
		const fileContent = e.target.result;
		
		SFTabsUtils.storageHelpers.importAll(fileContent)
		  .then(() => {
			console.log('Configuration imported successfully');
			showStatus('Configuration imported successfully. Changes will take effect when you reopen the extension.', false);
		  })
		  .catch(error => {
			console.error('Error saving configuration:', error);
			showStatus('Error saving configuration: ' + error.message, true);
		  });
	  } catch (error) {
		console.error('Error parsing file:', error);
		showStatus('Invalid configuration file: ' + error.message, true);
	  }
	};
  
	reader.onerror = function() {
	  console.error('Error reading file');
	  showStatus('Error reading file', true);
	};
  
	reader.readAsText(file);
  
	// Reset the file input to allow selecting the same file again
	fileInput.value = '';
  }

// Show status message
function showStatus(message, isError = false) {
	const statusMessage = document.getElementById('status-message');
	SFTabsUtils.uiHelpers.showStatus(message, isError, 'status-message');
  }