// popup/js/popup-shared.js
// Shared utilities for popup UI components

/**
 * Create a standardized list action button
 * @param {string} type - Button type: 'edit', 'delete', 'promote', or 'default'
 * @param {Object} options - Button options
 * @param {string} options.text - Button text content
 * @param {string} options.title - Button title/tooltip
 * @param {Function} options.onClick - Click handler function
 * @param {boolean} options.isActive - For default button, whether it's the active state
 * @returns {HTMLButtonElement}
 */
function createListActionButton(type, options) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = `list-action-button ${type}`;
	button.textContent = options.text;
	button.title = options.title;

	// Add active class for default buttons
	if (type === 'default' && options.isActive) {
		button.classList.add('active');
	}

	// Attach click handler
	if (options.onClick) {
		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			options.onClick(e);
		});
	}

	return button;
}

/**
 * Create a drag handle element
 * @returns {HTMLSpanElement}
 */
function createDragHandle() {
	const dragHandle = document.createElement('span');
	dragHandle.textContent = '⋮⋮';
	dragHandle.style.marginRight = '8px';
	dragHandle.style.color = '#706e6b';
	dragHandle.style.cursor = 'grab';
	dragHandle.style.fontSize = '14px';
	return dragHandle;
}

/**
 * Create a button container div
 * @returns {HTMLDivElement}
 */
function createButtonContainer() {
	const buttonContainer = document.createElement('div');
	buttonContainer.style.display = 'flex';
	buttonContainer.style.gap = '4px';
	buttonContainer.style.alignItems = 'center';
	return buttonContainer;
}

// Export to SFTabs namespace
window.SFTabs = window.SFTabs || {};
window.SFTabs.shared = {
	createListActionButton,
	createDragHandle,
	createButtonContainer
};
