// content/tab-renderer.js
// Tab rendering in Salesforce pages

// Flag to prevent concurrent renders
let isRenderingTabs = false;

/**
 * Get storage preference from settings
 * @returns {Promise<boolean>} true for sync storage, false for local
 */
async function getStoragePreference() {
  try {
    const result = await browser.storage.sync.get('userSettings');
    if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
      return result.userSettings.useSyncStorage;
    }
    return true; // Default to sync
  } catch (error) {
    return true;
  }
}

/**
 * Read tabs from chunked sync storage
 */
async function readChunkedSync(baseKey) {
  try {
    const metadataKey = `${baseKey}_metadata`;
    const metadataResult = await browser.storage.sync.get(metadataKey);
    const metadata = metadataResult[metadataKey];

    if (!metadata || !metadata.chunked) {
      const directResult = await browser.storage.sync.get(baseKey);
      return directResult[baseKey] || null;
    }

    const chunkCount = metadata.chunkCount;
    const chunkKeys = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkKeys.push(`${baseKey}_chunk_${i}`);
    }

    const chunksResult = await browser.storage.sync.get(chunkKeys);
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      if (!chunksResult[chunkKey]) {
        throw new Error(`Missing chunk ${i} of ${chunkCount}`);
      }
      chunks.push(chunksResult[chunkKey]);
    }

    const jsonString = chunks.join('');
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Get tabs from storage (sync or local based on preference)
 */
async function getTabsFromStorage() {
  try {
    const useSyncStorage = await getStoragePreference();

    // Get user settings
    const settingsKey = 'userSettings';
    let settings;
    if (useSyncStorage) {
      const settingsData = await readChunkedSync(settingsKey);
      settings = settingsData || {};
    } else {
      const result = await browser.storage.local.get(settingsKey);
      settings = result[settingsKey] || {};
    }

    // Always load from profile storage if activeProfileId exists
    // (profiles are used internally even if UI is disabled)
    if (settings.activeProfileId) {
      const profileTabsKey = `profile_${settings.activeProfileId}_tabs`;

      if (useSyncStorage) {
        const tabs = await readChunkedSync(profileTabsKey);
        return tabs || [];
      } else {
        const result = await browser.storage.local.get(profileTabsKey);
        return result[profileTabsKey] || [];
      }
    }

    // Fallback to legacy customTabs key (for very old installations)
    if (useSyncStorage) {
      const tabs = await readChunkedSync('customTabs');
      return tabs || [];
    } else {
      const result = await browser.storage.local.get('customTabs');
      return result.customTabs || [];
    }
  } catch (error) {
    return [];
  }
}

/**
 * Initialize tabs in the given container
 */
async function initTabs(tabContainer) {
  if (!tabContainer) {
    return;
  }

  // Prevent concurrent renders
  if (isRenderingTabs) {
    return;
  }

  isRenderingTabs = true;

  try {
    let tabsToUse = await getTabsFromStorage();

    // Get user settings to check if we should use defaults
    const useSyncStorage = await getStoragePreference();
    const settingsKey = 'userSettings';
    let settings;
    if (useSyncStorage) {
      const settingsData = await readChunkedSync(settingsKey);
      settings = settingsData || {};
    } else {
      const result = await browser.storage.local.get(settingsKey);
      settings = result[settingsKey] || {};
    }

    // Check display mode - if floating-only, don't render Setup tabs
    if (settings.floatingButton && settings.floatingButton.displayMode === 'floating-only') {
      isRenderingTabs = false;
      return;
    }

    if (!tabsToUse || tabsToUse.length === 0) {
      // If activeProfileId exists, respect empty profiles (don't use defaults)
      // This means profiles system is active internally even if UI is disabled
      if (settings.activeProfileId) {
        tabsToUse = [];
      } else {
        // No profile system - get default tabs from constants if available, otherwise use fallback
        if (window.SFTabs && window.SFTabs.constants && window.SFTabs.constants.DEFAULT_TABS) {
          tabsToUse = window.SFTabs.constants.DEFAULT_TABS;
        } else {
          // Fallback default tabs
          tabsToUse = [
            {
              id: 'default_tab_flows',
              label: 'Flows',
              path: 'Flows',
              openInNewTab: false,
              isObject: false,
              isCustomUrl: false,
              isSetupObject: false,
              position: 0
            },
            {
              id: 'default_tab_packages',
              label: 'Installed Packages',
              path: 'ImportedPackage',
              openInNewTab: false,
              isObject: false,
              isCustomUrl: false,
              isSetupObject: false,
              position: 1
            },
            {
              id: 'default_tab_users',
              label: 'Users',
              path: 'ManageUsers',
              openInNewTab: false,
              isObject: false,
              isCustomUrl: false,
              isSetupObject: false,
              position: 2
            },
            {
              id: 'default_tab_profiles',
              label: 'Profiles',
              path: 'EnhancedProfiles',
              openInNewTab: false,
              isObject: false,
              isCustomUrl: false,
              isSetupObject: false,
            position: 3
          },
          {
            id: 'default_tab_permsets',
            label: 'Permission Sets',
            path: 'PermSets',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 4
          }
        ];
        }
      }
    }

    // Sort tabs by position (only top-level tabs)
    const topLevelTabs = getTopLevelTabs(tabsToUse);

    // Remove any existing custom tabs and overflow button
    const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
    existingTabs.forEach(tab => tab.remove());
    const existingOverflow = tabContainer.querySelector('.sf-tabs-overflow-button');
    if (existingOverflow) existingOverflow.remove();

    // Add tabs to the container
    for (const tab of topLevelTabs) {
      const tabElement = createTabElementWithDropdown(tab);
      tabContainer.appendChild(tabElement);
    }

    // Add click event listeners
    addTabClickListeners(topLevelTabs);
    highlightActiveTab();
    monitorNativeTabActiveState();

    // Check for overflow and handle it (use longer timeout for accurate measurement)
    setTimeout(() => {
      handleTabOverflow(tabContainer, topLevelTabs);
      // Reset flag after overflow handling completes
      isRenderingTabs = false;
    }, 200);

    // Re-run highlightActiveTab after a delay to catch any Salesforce DOM updates
    // This is especially important for Salesforce Starter Edition where native tabs need to be de-highlighted
    setTimeout(() => {
      highlightActiveTab();
      monitorNativeTabActiveState();
    }, 300);

  } catch (error) {
    // Reset flag on error
    isRenderingTabs = false;
  }
}

/**
 * Get top-level tabs only (no parents)
 */
function getTopLevelTabs(allTabs) {
  return allTabs.filter(tab => !tab.parentId).sort((a, b) => a.position - b.position);
}

/**
 * Create tab element with dropdown functionality
 */
function createTabElementWithDropdown(tab) {
  // Get the base URL for the current org
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  // Determine the full URL based on tab type
  const fullUrl = buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject);
  
  // Create the tab element
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
  // Add dropdown indicator classes if tab has dropdown functionality
  if (tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0) {
    li.classList.add('has-dropdown');

    // Add navigation count
    li.setAttribute('data-nav-count', tab.dropdownItems.length);
  }
  
  // Create the anchor element
  const a = document.createElement('a');
  a.setAttribute('role', 'tab');
  a.setAttribute('tabindex', '-1');
  a.setAttribute('title', tab.label);
  a.setAttribute('aria-selected', 'false');
  a.setAttribute('href', fullUrl);

  // For folder-style tabs (no path), make them appear as buttons for opening dropdowns
  const isFolder = !tab.path || !tab.path.trim();
  if (isFolder) {
    // Keep pointer cursor if folder has dropdown, otherwise default
    const hasDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;
    a.style.cursor = hasDropdown ? 'pointer' : 'default';
  }

  // Set target based on openInNewTab property
  if (tab.openInNewTab) {
    a.setAttribute('target', '_blank');
  } else {
    a.setAttribute('target', '_self');
  }
  
  // Add appropriate classes
  a.classList.add('tabHeader', 'slds-context-bar__label-action');
  
  // Create span for tab title
  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.textContent = tab.label;

  // Assemble the tab label first
  a.appendChild(span);
  li.appendChild(a);

  // Add dropdown button as separate sibling element (not nested in label)
  if (tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0) {
    // Create wrapper div matching native Salesforce structure
    const dropdownWrapper = document.createElement('div');
    dropdownWrapper.className = 'slds-context-bar__label-action slds-p-left--none uiMenu oneNavItemDropdown';
    dropdownWrapper.setAttribute('data-aura-rendered-by', `sftabs-dropdown-wrapper-${tab.id}`);
    dropdownWrapper.setAttribute('data-aura-class', 'uiMenu oneNavItemDropdown');

    // Create inner trigger wrapper
    const triggerWrapper = document.createElement('div');
    triggerWrapper.className = 'uiPopupTrigger';
    triggerWrapper.setAttribute('id', `dropdown-trigger-${tab.id}`);
    triggerWrapper.setAttribute('data-aura-rendered-by', `sftabs-trigger-${tab.id}`);
    triggerWrapper.setAttribute('data-aura-class', 'uiPopupTrigger');

    // Create dropdown button with proper ARIA attributes
    const dropdownButton = document.createElement('a');
    dropdownButton.className = 'slds-button slds-button--icon';
    dropdownButton.setAttribute('id', `dropdown-arrow-${tab.id}`);
    dropdownButton.setAttribute('role', 'button');
    dropdownButton.setAttribute('aria-disabled', 'false');
    dropdownButton.setAttribute('tabindex', '0');
    dropdownButton.setAttribute('aria-expanded', 'false');
    dropdownButton.setAttribute('aria-haspopup', 'true');
    dropdownButton.setAttribute('aria-controls', `dropdown-menu-${tab.id}`);
    dropdownButton.setAttribute('href', 'javascript:void(0)');
    dropdownButton.setAttribute('title', `${tab.label} List`);
    dropdownButton.innerHTML = `
    <svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" class="slds-icon slds-icon_xx-small slds-button__icon slds-button__icon--hint">
      <path d="M476 178L271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21z"></path>
    </svg>
    `;

    // Assemble dropdown structure
    triggerWrapper.appendChild(dropdownButton);
    dropdownWrapper.appendChild(triggerWrapper);
    li.appendChild(dropdownWrapper);

    // Create dropdown menu using dropdownItems
    const dropdown = createInlineDropdownMenu(tab);
    li.appendChild(dropdown);

    // Add dropdown toggle handler
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleInlineDropdown(dropdown, dropdownButton);
    });
  }
  
  return li;
}

/**
 * Recursively render dropdown items with nesting support
 * @param {Array} items - Dropdown items to render
 * @param {HTMLElement} container - Container to append items to
 * @param {Object} parentTab - The parent tab object
 * @param {HTMLElement} menu - The menu element (for closing after navigation)
 * @param {number} level - Nesting level (0 = top level, 1 = nested)
 */
function renderDropdownItemsRecursive(items, container, parentTab, menu, level) {
  items.forEach((navItem, index) => {
    const itemLi = document.createElement('li');
    itemLi.setAttribute('role', 'presentation');
    itemLi.className = 'uiMenuItem';

    // Add nesting level class for styling
    if (level > 0) {
      itemLi.classList.add(`nested-level-${level}`);
    }

    itemLi.setAttribute('data-aura-rendered-by', `sftabs-item-${level}-${index}`);
    itemLi.setAttribute('data-aura-class', 'uiMenuItem');

    const link = document.createElement('a');
    link.setAttribute('role', 'menuitem');
    link.setAttribute('href', 'javascript:void(0)');
    link.setAttribute('title', navItem.label);
    link.setAttribute('data-aura-rendered-by', `sftabs-link-${level}-${index}`);

    // Check if this item has nested children
    const hasNestedItems = navItem.dropdownItems && navItem.dropdownItems.length > 0;

    // Create label container
    const labelContainer = document.createElement('span');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.justifyContent = 'space-between';
    labelContainer.style.width = '100%';

    // Create text node for label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'uiOutputText';
    labelSpan.setAttribute('data-aura-rendered-by', `sftabs-text-${level}-${index}`);
    labelSpan.setAttribute('data-aura-class', 'uiOutputText');
    labelSpan.textContent = navItem.label;

    // Style nested item labels
    if (level > 0) {
      labelSpan.style.fontSize = '13px';
      labelSpan.style.color = '#706e6b';
    }

    labelContainer.appendChild(labelSpan);

    if (hasNestedItems) {
      // Add right-pointing caret for items with submenus
      const caretIcon = document.createElement('span');
      caretIcon.className = 'submenu-caret';
      caretIcon.style.fontSize = '10px';
      caretIcon.style.color = '#706e6b';
      caretIcon.style.marginLeft = 'auto';
      caretIcon.textContent = '▶';
      labelContainer.appendChild(caretIcon);
    }

    link.appendChild(labelContainer);

    // Add click/hover handlers
    if (hasNestedItems) {
      // Items with children: show submenu on hover, navigate on click if item has URL
      // Note: The actual mouseenter handler will be set up after submenu is created below
      itemLi.needsSubmenuHandler = true;

      // If parent item has a URL, allow clicking to navigate
      if (navItem.path || navItem.url) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigateToNavigationItem(navItem, parentTab);
          menu.classList.remove('visible');
          menu.style.display = 'none';
        });
      } else {
        // Prevent default click behavior for parent items without URLs
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      }
    } else {
      // Items without children: navigate on click
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToNavigationItem(navItem, parentTab);
        menu.classList.remove('visible');
        menu.style.display = 'none';
      });
    }

    itemLi.appendChild(link);
    container.appendChild(itemLi);

    // Recursively render nested items as flyout submenu if they exist
    if (hasNestedItems && level < 2) { // Support up to 3 levels (0, 1, 2)
      const submenuContainer = document.createElement('div');
      submenuContainer.className = 'submenu-container popupTargetContainer uiPopupTarget uiMenuList uiMenuList--default';
      // Calculate z-index: base 10000 + (level * 100) to ensure deeper levels appear on top
      const zIndex = 10000 + (level * 100);
      submenuContainer.style.cssText = `
        display: none !important;
        position: fixed !important;
        min-width: 200px !important;
        width: 240px !important;
        z-index: ${zIndex} !important;
        background-color: rgb(255, 255, 255) !important;
        border: 1px solid rgb(221, 219, 218) !important;
        border-radius: 0.25rem !important;
        box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.16) !important;
        padding: 0.5rem 0 !important;
        transform: none !important;
        margin: 0 !important;
      `;

      // Create nested menu inner wrapper
      const submenuInner = document.createElement('div');
      submenuInner.setAttribute('role', 'menu');

      // Create nested ul
      const nestedUl = document.createElement('ul');
      nestedUl.setAttribute('role', 'presentation');
      nestedUl.className = 'scrollable';
      nestedUl.style.listStyle = 'none';
      nestedUl.style.margin = '0';
      nestedUl.style.padding = '0';

      renderDropdownItemsRecursive(navItem.dropdownItems, nestedUl, parentTab, menu, level + 1);

      submenuInner.appendChild(nestedUl);
      submenuContainer.appendChild(submenuInner);

      // Clean up any existing submenu for this item before creating new one
      if (itemLi.submenuElement) {
        itemLi.submenuElement.remove();
      }

      // Store parent-child relationship for hover logic
      // The menu parameter is the parent submenu container
      const parentSubmenuId = menu?.dataset?.submenuId || 'root';
      submenuContainer.dataset.parentSubmenu = parentSubmenuId;
      submenuContainer.dataset.submenuId = `submenu-${Date.now()}-${Math.random()}`;

      // Append submenu to document body to avoid overflow clipping
      document.body.appendChild(submenuContainer);

      // Create invisible bridge element between parent item and submenu
      const bridge = document.createElement('div');
      bridge.className = 'submenu-bridge';
      // Bridge should be just below its submenu in z-index
      const bridgeZIndex = zIndex - 1;
      bridge.style.cssText = `
        position: fixed !important;
        background: transparent !important;
        pointer-events: auto !important;
        z-index: ${bridgeZIndex} !important;
        display: none !important;
      `;
      document.body.appendChild(bridge);

      // Store references for cleanup
      itemLi.submenuElement = submenuContainer;
      itemLi.bridgeElement = bridge;

      // Function to position submenu next to parent item with smart positioning
      const positionSubmenu = () => {
        const itemRect = itemLi.getBoundingClientRect();

        // Get the parent menu's bounding box (the actual dropdown menu, not just the ul)
        const parentMenu = menu;
        const parentMenuRect = parentMenu.getBoundingClientRect();

        const submenuWidth = 240;
        const gap = 2;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Check if parent menu has a preferred direction (stored from its own positioning)
        const parentDirection = parentMenu.dataset.openDirection; // 'left' or 'right'

        let left;
        let openRight;

        if (parentDirection === 'left') {
          // Parent opened to the left, so continue opening to the left
          left = parentMenuRect.left - submenuWidth - gap;
          openRight = false;
        } else {
          // Default: try positioning to the right first (preferred for regular menus)
          left = parentMenuRect.right + gap;
          openRight = true;

          // Check if it would go off the right edge
          if (left + submenuWidth > viewportWidth) {
            // Flip to the left side instead
            left = parentMenuRect.left - submenuWidth - gap;
            openRight = false;
          }

          // Check if opening left would go off the left edge
          if (!openRight && left < 0) {
            // Force right positioning even if it clips slightly
            left = Math.min(viewportWidth - submenuWidth, parentMenuRect.right + gap);
            openRight = true;
          }
        }

        // Calculate top position aligned with hovered item
        let top = itemRect.top;

        // Check if menu would go off bottom of viewport
        // Temporarily show to get actual height
        submenuContainer.style.setProperty('display', 'block', 'important');
        submenuContainer.style.setProperty('visibility', 'hidden', 'important');
        const submenuHeight = submenuContainer.offsetHeight;
        submenuContainer.style.setProperty('display', 'none', 'important');
        submenuContainer.style.setProperty('visibility', 'visible', 'important');

        // Adjust top if would go off bottom
        if (top + submenuHeight > viewportHeight) {
          top = Math.max(0, viewportHeight - submenuHeight - 10);
        }

        // Store the direction this submenu opened for child submenus
        submenuContainer.dataset.openDirection = openRight ? 'right' : 'left';

        // Apply positioning
        submenuContainer.style.setProperty('left', `${left}px`, 'important');
        submenuContainer.style.setProperty('top', `${top}px`, 'important');
        submenuContainer.style.setProperty('right', 'auto', 'important');
        submenuContainer.style.setProperty('bottom', 'auto', 'important');

        // Position the bridge between parent item and submenu
        // Make it taller to cover the area between parent menu and submenu
        const bridgeTop = Math.min(itemRect.top, top);
        const bridgeBottom = Math.max(itemRect.bottom, top + submenuHeight);
        const bridgeHeight = bridgeBottom - bridgeTop;
        let bridgeLeft, bridgeWidth;

        if (openRight) {
          // Bridge from parent right edge to submenu left edge
          bridgeLeft = parentMenuRect.right;
          bridgeWidth = left - parentMenuRect.right;
        } else {
          // Bridge from submenu right edge to parent left edge
          bridgeLeft = left + submenuWidth;
          bridgeWidth = parentMenuRect.left - (left + submenuWidth);
        }

        bridge.style.setProperty('left', `${bridgeLeft}px`, 'important');
        bridge.style.setProperty('top', `${bridgeTop}px`, 'important');
        bridge.style.setProperty('width', `${bridgeWidth}px`, 'important');
        bridge.style.setProperty('height', `${bridgeHeight}px`, 'important');
      };

      // Add hover delay management
      // Store timeout on submenu element so children can access it
      let hideTimeout;

      // Set up mouseenter handler to show and position submenu
      itemLi.addEventListener('mouseenter', () => {
        // Clear any pending hide timeout for this submenu
        clearTimeout(hideTimeout);
        clearTimeout(submenuContainer.hideTimeout);

        // Also clear parent's hide timeout to prevent parent from closing
        const parentSubmenuId = submenuContainer.dataset.parentSubmenu;
        if (parentSubmenuId && parentSubmenuId !== 'root') {
          const parentSubmenu = document.querySelector(`.submenu-container[data-submenu-id="${parentSubmenuId}"]`);
          if (parentSubmenu && parentSubmenu.hideTimeout) {
            clearTimeout(parentSubmenu.hideTimeout);
          }
        }

        // Close other submenus at the same level
        const siblings = container.querySelectorAll(':scope > li');
        siblings.forEach(sibling => {
          if (sibling !== itemLi && sibling.submenuElement) {
            sibling.submenuElement.style.setProperty('display', 'none', 'important');
            if (sibling.bridgeElement) {
              sibling.bridgeElement.style.setProperty('display', 'none', 'important');
            }
          }
        });

        // Position and show this submenu and bridge
        positionSubmenu();
        submenuContainer.style.setProperty('display', 'block', 'important');
        bridge.style.setProperty('display', 'block', 'important');
      });

      // Hide submenu when mouse leaves the parent item
      itemLi.addEventListener('mouseleave', () => {
        // Only hide if not moving to the submenu or bridge
        hideTimeout = setTimeout(() => {
          submenuContainer.style.setProperty('display', 'none', 'important');
          bridge.style.setProperty('display', 'none', 'important');
        }, 300);
      });

      // Keep submenu visible when hovering over it or the bridge
      submenuContainer.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        clearTimeout(submenuContainer.hideTimeout);

        // Also clear parent's hide timeout
        const parentSubmenuId = submenuContainer.dataset.parentSubmenu;
        if (parentSubmenuId && parentSubmenuId !== 'root') {
          const parentSubmenu = document.querySelector(`.submenu-container[data-submenu-id="${parentSubmenuId}"]`);
          if (parentSubmenu && parentSubmenu.hideTimeout) {
            clearTimeout(parentSubmenu.hideTimeout);
          }
        }
      });

      bridge.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        clearTimeout(submenuContainer.hideTimeout);

        // Also clear parent's hide timeout
        const parentSubmenuId = submenuContainer.dataset.parentSubmenu;
        if (parentSubmenuId && parentSubmenuId !== 'root') {
          const parentSubmenu = document.querySelector(`.submenu-container[data-submenu-id="${parentSubmenuId}"]`);
          if (parentSubmenu && parentSubmenu.hideTimeout) {
            clearTimeout(parentSubmenu.hideTimeout);
          }
        }
      });

      // Hide submenu when leaving the submenu (with delay)
      submenuContainer.addEventListener('mouseleave', (e) => {
        // Check if we're moving to a child submenu
        const relatedTarget = e.relatedTarget;
        if (relatedTarget) {
          // Check if the target is inside this menu (including nested children)
          const isInsideThisMenu = submenuContainer.contains(relatedTarget);

          // Check if we're moving to the parent item
          const isParentItem = itemLi.contains(relatedTarget);

          // Check if we're moving to a child submenu (by checking parent relationship)
          let isMovingToChildSubmenu = false;
          const targetSubmenu = relatedTarget.closest?.('.submenu-container');
          if (targetSubmenu) {
            // Check if this target submenu is a logical child of the current submenu
            const currentSubmenuId = submenuContainer.dataset.submenuId;
            if (targetSubmenu.dataset.parentSubmenu === currentSubmenuId) {
              isMovingToChildSubmenu = true;
            }
          }

          // Check if we're moving to a bridge
          const isMovingToBridge = relatedTarget.closest?.('.submenu-bridge');

          if (isInsideThisMenu || isParentItem || isMovingToChildSubmenu || isMovingToBridge) {
            // Moving to child, staying inside, back to parent, or to bridge - don't hide
            return;
          }
        }

        hideTimeout = setTimeout(() => {
          submenuContainer.style.setProperty('display', 'none', 'important');
          bridge.style.setProperty('display', 'none', 'important');
        }, 300);

        // Store timeout on submenu element so children can cancel it
        submenuContainer.hideTimeout = hideTimeout;
      });

      bridge.addEventListener('mouseleave', (e) => {
        // Check if we're not entering the submenu
        const clientX = e.clientX;
        const clientY = e.clientY;
        setTimeout(() => {
          const hoveredElement = document.elementFromPoint(clientX, clientY);
          if (!submenuContainer.contains(hoveredElement) && !itemLi.contains(hoveredElement)) {
            submenuContainer.style.setProperty('display', 'none', 'important');
            bridge.style.setProperty('display', 'none', 'important');
          }
        }, 50);
      });

      // Clean up submenu and bridge when menu is hidden
      const observer = new MutationObserver(() => {
        if (menu.style.display === 'none') {
          submenuContainer.style.setProperty('display', 'none', 'important');
          bridge.style.setProperty('display', 'none', 'important');
        }
      });
      observer.observe(menu, { attributes: true, attributeFilter: ['style'] });
    }
  });
}

/**
 * Create inline dropdown menu with SLDS native styling
 */
function createInlineDropdownMenu(tab) {
  // Main container with SLDS classes (hidden by default - will use 'visible' class to show)
  const menu = document.createElement('div');
  menu.className = 'popupTargetContainer menu--nubbin-top uiPopupTarget uiMenuList uiMenuList--default positioned sftabs-custom-dropdown';
  menu.setAttribute('id', `dropdown-menu-${tab.id}`);
  menu.setAttribute('data-tab-id', tab.id);
  menu.setAttribute('data-aura-rendered-by', 'sftabs-dropdown');
  menu.setAttribute('data-aura-class', 'uiPopupTarget uiMenuList uiMenuList--default');

  // Add explicit display control (hidden by default, shown with 'visible' class)
  menu.style.display = 'none';
  menu.style.position = 'absolute';
  menu.style.zIndex = '9999';
  menu.style.width = '240px'; // Match Object Manager dropdown width

  // Inner menu wrapper
  const menuInner = document.createElement('div');
  menuInner.setAttribute('role', 'menu');
  menuInner.setAttribute('data-aura-rendered-by', 'sftabs-dropdown-inner');

  // Scrollable list container
  const ul = document.createElement('ul');
  ul.setAttribute('role', 'presentation');
  ul.className = 'scrollable';
  ul.setAttribute('data-aura-rendered-by', 'sftabs-dropdown-list');

  // Add navigation items recursively (supports nested dropdownItems)
  const navigationItems = tab.dropdownItems || [];
  renderDropdownItemsRecursive(navigationItems, ul, tab, menu, 0);

  menuInner.appendChild(ul);
  menu.appendChild(menuInner);
  return menu;
}

/**
 * Toggle inline dropdown visibility using SLDS visible class
 */
function toggleInlineDropdown(dropdown, dropdownButton) {
  // Close all other SF Tabs custom dropdowns first (not native Salesforce dropdowns)
  document.querySelectorAll('.sftabs-custom-dropdown').forEach(d => {
    if (d !== dropdown) {
      d.classList.remove('visible');
      d.style.display = 'none';
      // Reset aria-expanded on other buttons
      const otherButtonId = d.getAttribute('aria-labelledby') || d.id.replace('dropdown-menu-', 'dropdown-arrow-');
      const otherButton = document.getElementById(otherButtonId);
      if (otherButton) {
        otherButton.setAttribute('aria-expanded', 'false');
      }
    }
  });

  const isCurrentlyVisible = dropdown.classList.contains('visible');

  // Position the dropdown relative to the button before showing
  if (!isCurrentlyVisible && dropdownButton) {
    // Get the button's position relative to the page
    const buttonRect = dropdownButton.getBoundingClientRect();
    const parentLi = dropdown.parentElement;
    const parentRect = parentLi.getBoundingClientRect();

    // Calculate center of button relative to parent li
    const topOffset = buttonRect.bottom - parentRect.top + 4; // 4px gap below button
    const buttonCenterX = buttonRect.left + (buttonRect.width / 2) - parentRect.left;

    // Position dropdown with center aligned to button center (nubbin will align with button)
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${topOffset}px`;
    dropdown.style.left = `${buttonCenterX}px`;
    dropdown.style.right = 'auto';
    dropdown.style.transform = 'translateX(-50%)'; // Center the dropdown under the button
    dropdown.style.display = 'block';
    dropdown.classList.add('visible');

    // Update aria-expanded state
    dropdownButton.setAttribute('aria-expanded', 'true');
  } else {
    dropdown.style.display = 'none';
    dropdown.classList.remove('visible');

    // Update aria-expanded state
    if (dropdownButton) {
      dropdownButton.setAttribute('aria-expanded', 'false');
    }
  }
}

/**
 * Navigate to main tab
 */
function navigateToMainTab(tab) {
  
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  const fullUrl = buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject);
  
  if (tab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      window.location.href = fullUrl;
    }
  }
}

/**
 * Navigate to a navigation item from dropdown
 */
function navigateToNavigationItem(navItem, parentTab) {
  const baseUrl = window.location.origin;

  let fullUrl = '';
  let path = navItem.path || navItem.url || '';

  // Check if path already includes full Lightning URL (nested navigation items)
  if (path.startsWith('/lightning/')) {
    // Path already has full Lightning path, just add origin
    fullUrl = `${baseUrl}${path}`;
  } else if (navItem.isObject) {
    // Object paths: /lightning/o/{objectName}/list or /lightning/o/{objectName}/view/{recordId}
    fullUrl = `${baseUrl}/lightning/o/${path}`;
  } else if (navItem.isCustomUrl) {
    // Custom URLs: ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    fullUrl = `${baseUrl}${path}`;
  } else {
    // Setup paths: /lightning/setup/{setupPath}
    fullUrl = `${baseUrl}/lightning/setup/${path}`;
  }

  if (parentTab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      window.location.href = fullUrl;
    }
  }
}

/**
 * Build full URL from tab configuration
 */
function buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject) {
  // Check if this is a folder-style tab (no path)
  if (!tab.path || !tab.path.trim()) {
    // For folder tabs, return a javascript:void(0) to prevent navigation
    return 'javascript:void(0)';
  }

  let fullUrl = '';
  const isObject = tab.hasOwnProperty('isObject') ? tab.isObject : false;
  const isCustomUrl = tab.hasOwnProperty('isCustomUrl') ? tab.isCustomUrl : false;

  if (isCustomUrl) {
    // For custom URLs, ensure there's a leading slash
    let formattedPath = tab.path;

    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }

    fullUrl = `${baseUrlRoot}${formattedPath}`;
  } else if (isObject) {
    // Object URLs: don't add /home suffix - use the path as is
    fullUrl = `${baseUrlObject}${tab.path}`;
  } else if (tab.path.includes('ObjectManager/')) {
    // ObjectManager URLs don't need /home
    fullUrl = `${baseUrlSetup}${tab.path}`;
  } else {
    // Setup URLs need /home at the end
    fullUrl = `${baseUrlSetup}${tab.path}/home`;
  }

  return fullUrl;
}

/**
 * Add click event listeners for tabs with Lightning navigation support
 */
function addTabClickListeners(tabs) {
  tabs.forEach(tab => {
    const links = document.querySelectorAll(`li[data-tab-id="${tab.id}"] a`);
    links.forEach(link => {
      // Use capture phase to ensure our listener runs before any other listeners
      link.addEventListener('click', event => {
        // FIRST: Check if this tab has an empty or missing path - if so, prevent navigation immediately
        const hasPath = tab.path && tab.path.trim();

        if (!hasPath) {
          // Folder-style tab without URL - block navigation immediately
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const hasDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;

          // If it has a dropdown, open it
          if (hasDropdown) {
            const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
            const dropdown = tabElement?.querySelector('.sftabs-custom-dropdown');
            const dropdownArrow = tabElement?.querySelector(`#dropdown-arrow-${tab.id}`);

            if (dropdown && dropdownArrow) {
              toggleInlineDropdown(dropdown, dropdownArrow);
            }
          }
          return;
        }

        // If clicking on dropdown button or its wrapper, don't navigate
        if (event.target.closest('.oneNavItemDropdown') ||
            event.target.closest('.uiPopupTrigger') ||
            event.target.closest(`#dropdown-arrow-${tab.id}`)) {
          return;
        }

        // If clicking within the dropdown menu, don't navigate
        if (event.target.closest('.sftabs-custom-dropdown')) {
          return;
        }

        const hasDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;

        // Additional safety check: also check the href pattern
        const isJsVoidHref = link.href && link.href.includes('javascript:void(0)');
        const hasEmptyPathPattern = link.href && link.href.includes('//home');

        if (isJsVoidHref || hasEmptyPathPattern) {
          // Folder-style tab detected by href - block navigation
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          // If it has a dropdown, open it
          if (hasDropdown) {
            const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
            const dropdown = tabElement?.querySelector('.sftabs-custom-dropdown');
            const dropdownArrow = tabElement?.querySelector(`#dropdown-arrow-${tab.id}`);

            if (dropdown && dropdownArrow) {
              toggleInlineDropdown(dropdown, dropdownArrow);
            }
          }
          // If no dropdown and no path, just do nothing (it's a folder/placeholder)
          return;
        }

        const lightningEnabled = isLightningNavigationEnabled();

        if (tab.openInNewTab) {
          // For new tab, always use window.open
          event.preventDefault();
          window.open(link.href, '_blank');
        } else {
          // For same tab, check if Lightning navigation is enabled
          if (lightningEnabled) {
            // Use Lightning navigation
            event.preventDefault();
            lightningNavigate({
              navigationType: "url",
              url: link.href
            }, link.href);
          } else {
            // Lightning navigation is disabled, use regular navigation
            event.preventDefault();
            window.location.href = link.href;
          }
        }
      });
    });
  });
}

/**
 * Check if Lightning Navigation is enabled
 * Always returns true as Lightning Navigation is now standard
 */
function isLightningNavigationEnabled() {
  return true;
}

/**
 * Lightning navigation function
 */
function lightningNavigate(details, fallbackURL) {
  if (!isLightningNavigationEnabled()) {
    window.location.href = fallbackURL;
    return;
  }

  
  // Try inject.js window function approach first
  if (window.sfTabsLightningNav) {
    const success = window.sfTabsLightningNav({
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null
    });
    
    if (success) {
      return;
    }
  }
  
  // Final fallback
  window.location.href = fallbackURL;
}

/**
 * Highlight active custom tab and show current section
 */
async function highlightActiveTab() {
  const currentUrl = window.location.href;

  try {
    const tabs = await getTabsFromStorage();
    const topLevelTabs = getTopLevelTabs(tabs);
    let matchedTab = null;

    for (const tab of topLevelTabs) {
      const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
      if (tabElement) {
        const tabUrl = tabElement.getAttribute('data-url');
        const baseTabUrl = tabUrl ? tabUrl.split('/Details')[0] : null;
        const matches = tabUrl && currentUrl.startsWith(baseTabUrl);
        if (matches) { // Match base ObjectManager URL
          matchedTab = tab;
          break;
        }
      }
    }

    if (matchedTab) {

      // Remove active state from all tabs in tabBarItems
      const allTabs = document.querySelectorAll('.tabBarItems .tabItem');
      allTabs.forEach(tabEl => {
        tabEl.classList.remove('slds-is-active');
        const anchor = tabEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'false');
      });

      // Also remove active state from native pinned tabs (Salesforce Starter Edition)
      const pinnedTabs = document.querySelectorAll('.pinnedItems .tabItem');
      pinnedTabs.forEach(tabEl => {
        tabEl.classList.remove('slds-is-active', 'active');
        const anchor = tabEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'false');
      });

      // Add active state to matched tab
      const activeEl = document.querySelector(`li[data-tab-id="${matchedTab.id}"]`);
      if (activeEl) {
        activeEl.classList.add('slds-is-active');
        const anchor = activeEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'true');
      }

    }
  } catch (error) {
    // Error highlighting active tab
  }
}

/**
 * Monitor native tabs and prevent them from showing active state when custom tab is active
 * This is necessary because Salesforce continuously re-applies active state to native tabs
 */
async function monitorNativeTabActiveState() {
  const currentUrl = window.location.href;

  try {
    const tabs = await getTabsFromStorage();
    const topLevelTabs = getTopLevelTabs(tabs);
    let customTabIsActive = false;

    // Check if any custom tab matches the current URL
    for (const tab of topLevelTabs) {
      const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
      if (tabElement) {
        const tabUrl = tabElement.getAttribute('data-url');
        const baseTabUrl = tabUrl ? tabUrl.split('/Details')[0] : null;
        const matches = tabUrl && currentUrl.startsWith(baseTabUrl);
        if (matches) {
          customTabIsActive = true;
          break;
        }
      }
    }

    // If a custom tab is active, watch native tabs and remove their active state
    if (customTabIsActive) {
      const removeNativeActiveState = () => {
        // Remove from tabBarItems (all native tabs)
        const allTabs = document.querySelectorAll('.tabBarItems .tabItem:not(.sf-tabs-custom-tab)');
        allTabs.forEach(tabEl => {
          if (tabEl.classList.contains('slds-is-active')) {
            tabEl.classList.remove('slds-is-active');
            const anchor = tabEl.querySelector('a');
            if (anchor) anchor.setAttribute('aria-selected', 'false');
          }
        });

        // Remove from pinnedItems (Home, Object Manager, etc.)
        const pinnedTabs = document.querySelectorAll('.pinnedItems .tabItem');
        pinnedTabs.forEach(tabEl => {
          if (tabEl.classList.contains('slds-is-active') || tabEl.classList.contains('active')) {
            tabEl.classList.remove('slds-is-active', 'active');
            const anchor = tabEl.querySelector('a');
            if (anchor) anchor.setAttribute('aria-selected', 'false');
          }
        });
      };

      // Set up mutation observer on the tab bar container
      const tabBarContainer = document.querySelector('.tabBarItems');
      const pinnedContainer = document.querySelector('.pinnedItems');

      if (tabBarContainer || pinnedContainer) {
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const target = mutation.target;
              // If a native tab got the active class, remove it
              if (target.classList.contains('tabItem') &&
                  !target.classList.contains('sf-tabs-custom-tab') &&
                  (target.classList.contains('slds-is-active') || target.classList.contains('active'))) {
                removeNativeActiveState();
              }
            }
          }
        });

        // Observe both containers
        if (tabBarContainer) {
          observer.observe(tabBarContainer, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
          });
        }
        if (pinnedContainer) {
          observer.observe(pinnedContainer, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
          });
        }

        // Also run immediately to catch any existing active state
        removeNativeActiveState();
      }
    }
  } catch (error) {
    // Error monitoring native tabs
  }
}

/**
 * Check if current page matches a tab's path
 */
function isCurrentPageMatchingTab(tab, currentPageInfo) {
  if (tab.isSetupObject && currentPageInfo.type === 'objectManager') {
    if (tab.path.startsWith('ObjectManager/')) {
      const tabObjectName = tab.path.split('/')[1];
      return tabObjectName === currentPageInfo.objectName;
    }
  }

  return false;
}

/**
 * Remove all custom tabs from the container
 */
function removeCustomTabs(tabContainer) {
  const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
  existingTabs.forEach(tab => tab.remove());
}

/**
 * Get tab by ID from storage
 */
async function getTabById(tabId) {
  try {
    const result = await browser.storage.local.get('customTabs');
    const tabs = result.customTabs || [];
    return tabs.find(tab => tab.id === tabId);
  } catch (error) {
    return null;
  }
}

/**
 * Check if tabs are currently visible/loaded
 */
function areTabsLoaded() {
  const customTabs = document.querySelectorAll('.sf-tabs-custom-tab');
  return customTabs.length > 0;
}

/**
 * Force refresh all tabs (useful for debugging)
 */
function forceRefreshTabs() {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (tabContainer) {
    initTabs(tabContainer);
  }
}

/**
 * Handle tab overflow - show/hide tabs and display overflow button if needed
 * Uses two-pass approach: first check if overflow is needed, then calculate which tabs to hide
 */
function handleTabOverflow(tabContainer, topLevelTabs) {
  if (!tabContainer) return;

  // Remove existing overflow button if any
  const existingOverflow = tabContainer.querySelector('.sf-tabs-overflow-button');
  if (existingOverflow) existingOverflow.remove();

  // Get all custom tab elements
  const customTabElements = Array.from(tabContainer.querySelectorAll('.sf-tabs-custom-tab'));
  if (customTabElements.length === 0) return;

  // Show all tabs to measure properly
  customTabElements.forEach(tab => {
    tab.style.display = '';
  });

  // Force layout recalculation
  tabContainer.offsetHeight;

  // Get container dimensions
  const containerRect = tabContainer.getBoundingClientRect();
  const containerHeight = containerRect.height;

  // Use the parent element's width (the visible viewport area) instead of the fixed container width
  // The tabBarItems container has a fixed width, but we need to know the visible viewport width
  const tabBarParent = tabContainer.parentElement;
  let viewportWidth = tabBarParent ? tabBarParent.getBoundingClientRect().width : window.innerWidth - 100;

  // Account for the left navbar (App Launcher + Setup label)
  const leftNav = document.querySelector('.slds-context-bar__primary.navLeft');
  if (leftNav) {
    const leftNavWidth = leftNav.getBoundingClientRect().width;
    viewportWidth -= leftNavWidth;
  }

  // Add buffer for right side margin/padding (increased to keep overflow menu away from edge)
  const rightBuffer = 140; 
  viewportWidth -= rightBuffer;

  // Calculate space used by native Salesforce tabs
  const nativeTabs = Array.from(tabContainer.querySelectorAll('.tabItem:not(.sf-tabs-custom-tab):not(.sf-tabs-overflow-button)'));
  const nativeTabsWidth = nativeTabs.reduce((sum, tab) => {
    const width = tab.getBoundingClientRect().width;
    return sum + width;
  }, 0);

  // PASS 1: Check if all tabs fit WITHOUT overflow button
  const availableWidthWithoutOverflow = viewportWidth - nativeTabsWidth;

  // Measure total width of all custom tabs
  let totalTabsWidth = 0;
  customTabElements.forEach(tabElement => {
    totalTabsWidth += tabElement.getBoundingClientRect().width;
  });


  // Check if tabs have wrapped by checking container height
  // A single row of tabs is typically 36-40px tall, wrapped tabs will be taller
  const hasWrapped = containerHeight > 45;

  // If all tabs fit (width check AND no wrapping), we're done!
  if (totalTabsWidth <= availableWidthWithoutOverflow && !hasWrapped) {
    return; // No overflow needed
  }

  if (hasWrapped) {
  }


  // PASS 2: Tabs don't all fit - need overflow button
  const overflowButtonWidth = 60;
  const buffer = 5; // Small buffer for Pass 2 calculations
  const availableWidth = viewportWidth - nativeTabsWidth - overflowButtonWidth - buffer;

  // Determine which tabs fit and which should be hidden
  let usedWidth = 0;
  const visibleTabs = [];
  const hiddenTabs = [];

  customTabElements.forEach((tabElement, index) => {
    const tabWidth = tabElement.getBoundingClientRect().width;

    if (usedWidth + tabWidth <= availableWidth) {
      usedWidth += tabWidth;
      visibleTabs.push({ element: tabElement, tab: topLevelTabs[index] });
    } else {
      hiddenTabs.push({ element: tabElement, tab: topLevelTabs[index] });
    }
  });

  // Hide overflow tabs
  hiddenTabs.forEach(({ element }) => {
    element.style.display = 'none';
  });

  // Create and add overflow button
  const overflowButton = createOverflowButton(hiddenTabs.map(h => h.tab));
  tabContainer.appendChild(overflowButton);
}

/**
 * Create overflow button (chevron) for hidden tabs
 */
function createOverflowButton(hiddenTabs) {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-overflow-button';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');

  const a = document.createElement('a');
  a.setAttribute('role', 'tab');
  a.setAttribute('tabindex', '-1');
  a.setAttribute('title', `${hiddenTabs.length} more tab${hiddenTabs.length > 1 ? 's' : ''}`);
  a.setAttribute('aria-selected', 'false');
  a.setAttribute('href', 'javascript:void(0)');
  a.classList.add('tabHeader', 'slds-context-bar__label-action');

  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.innerHTML = `
    <svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" style="width: 16px; height: 16px; fill: currentColor;">
      <path d="M260 320c-11 0-21-4-29-12l-120-120c-8-8-8-21 0-29s21-8 29 0l120 120 120-120c8-8 21-8 29 0s8 21 0 29l-120 120c-8 8-18 12-29 12z" transform="rotate(270 260 260)"></path>
    </svg>
  `;

  // Create overflow dropdown menu
  const dropdown = createOverflowDropdown(hiddenTabs);
  li.appendChild(dropdown);

  // Add click handler
  a.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleInlineDropdown(dropdown, span);
  });

  a.appendChild(span);
  li.appendChild(a);

  return li;
}

/**
 * Create flyout submenu for overflow menu item (opens to the left)
 */
function createOverflowSubmenu(itemLi, tab, parentMenu) {
  const submenuContainer = document.createElement('div');
  submenuContainer.className = 'submenu-container popupTargetContainer uiPopupTarget uiMenuList uiMenuList--default';
  submenuContainer.style.cssText = `
    display: none !important;
    position: fixed !important;
    min-width: 200px !important;
    width: 240px !important;
    z-index: 10001 !important;
    background-color: rgb(255, 255, 255) !important;
    border: 1px solid rgb(221, 219, 218) !important;
    border-radius: 0.25rem !important;
    box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.16) !important;
    padding: 0.5rem 0 !important;
    transform: none !important;
    margin: 0 !important;
  `;

  // Create submenu inner wrapper
  const submenuInner = document.createElement('div');
  submenuInner.setAttribute('role', 'menu');

  // Create ul
  const ul = document.createElement('ul');
  ul.setAttribute('role', 'presentation');
  ul.className = 'scrollable';
  ul.style.listStyle = 'none';
  ul.style.margin = '0';
  ul.style.padding = '0';

  // Store parent-child relationship for hover logic (needed for nested items to find parent)
  submenuContainer.dataset.parentSubmenu = 'root'; // This is a top-level overflow submenu
  submenuContainer.dataset.submenuId = `overflow-submenu-${Date.now()}-${Math.random()}`;

  // Render dropdown items using the existing recursive renderer
  // Pass submenuContainer as the menu so nested items position relative to this submenu
  renderDropdownItemsRecursive(tab.dropdownItems, ul, tab, submenuContainer, 0);

  submenuInner.appendChild(ul);
  submenuContainer.appendChild(submenuInner);

  // Append to body
  document.body.appendChild(submenuContainer);

  // Create invisible bridge element between parent item and submenu
  const bridge = document.createElement('div');
  bridge.className = 'submenu-bridge';
  bridge.style.cssText = `
    position: fixed !important;
    background: transparent !important;
    pointer-events: auto !important;
    z-index: 10000 !important;
    display: none !important;
  `;
  document.body.appendChild(bridge);

  // Store references for cleanup
  itemLi.submenuElement = submenuContainer;
  itemLi.bridgeElement = bridge;

  // Position submenu with smart positioning (flip sides if needed)
  const positionSubmenu = () => {
    const itemRect = itemLi.getBoundingClientRect();
    const parentMenuRect = parentMenu.getBoundingClientRect();

    // Use the fixed width we set (240px) since offsetWidth may be 0 before display
    const submenuWidth = 240;
    const gap = 2;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Try positioning to the left first (preferred for overflow menu)
    let left = parentMenuRect.left - submenuWidth - gap;
    let openLeft = true;

    // Check if it would go off the left edge
    if (left < 0) {
      // Flip to the right side instead
      left = parentMenuRect.right + gap;
      openLeft = false;
    }

    // Check if opening right would go off the right edge
    if (!openLeft && (left + submenuWidth) > viewportWidth) {
      // Force left positioning even if it clips slightly
      left = Math.max(0, parentMenuRect.left - submenuWidth - gap);
      openLeft = true;
    }

    // Calculate top position aligned with hovered item
    let top = itemRect.top;

    // Check if menu would go off bottom of viewport
    // Temporarily show to get actual height
    submenuContainer.style.setProperty('display', 'block', 'important');
    submenuContainer.style.setProperty('visibility', 'hidden', 'important');
    const submenuHeight = submenuContainer.offsetHeight;
    submenuContainer.style.setProperty('display', 'none', 'important');
    submenuContainer.style.setProperty('visibility', 'visible', 'important');

    // Adjust top if would go off bottom
    if (top + submenuHeight > viewportHeight) {
      top = Math.max(0, viewportHeight - submenuHeight - 10);
    }

    // Store the direction this submenu opened for child submenus
    submenuContainer.dataset.openDirection = openLeft ? 'left' : 'right';

    // Apply positioning
    submenuContainer.style.setProperty('left', `${left}px`, 'important');
    submenuContainer.style.setProperty('top', `${top}px`, 'important');
    submenuContainer.style.setProperty('right', 'auto', 'important');
    submenuContainer.style.setProperty('bottom', 'auto', 'important');

    // Position the bridge between parent item and submenu
    // Make it taller to cover the area between parent menu and submenu
    const bridgeTop = Math.min(itemRect.top, top);
    const bridgeBottom = Math.max(itemRect.bottom, top + submenuHeight);
    const bridgeHeight = bridgeBottom - bridgeTop;
    let bridgeLeft, bridgeWidth;

    if (openLeft) {
      // Bridge from submenu right edge to parent left edge
      bridgeLeft = left + submenuWidth;
      bridgeWidth = parentMenuRect.left - (left + submenuWidth);
    } else {
      // Bridge from parent right edge to submenu left edge
      bridgeLeft = parentMenuRect.right;
      bridgeWidth = left - parentMenuRect.right;
    }

    bridge.style.setProperty('left', `${bridgeLeft}px`, 'important');
    bridge.style.setProperty('top', `${bridgeTop}px`, 'important');
    bridge.style.setProperty('width', `${bridgeWidth}px`, 'important');
    bridge.style.setProperty('height', `${bridgeHeight}px`, 'important');
  };

  // Hover delay management
  let hideTimeout;

  // Show submenu on hover
  itemLi.addEventListener('mouseenter', () => {
    // Clear any pending hide timeout for this submenu
    clearTimeout(hideTimeout);
    clearTimeout(submenuContainer.hideTimeout);

    // Close other submenus
    const siblings = itemLi.parentElement.querySelectorAll(':scope > li');
    siblings.forEach(sibling => {
      if (sibling !== itemLi && sibling.submenuElement) {
        sibling.submenuElement.style.setProperty('display', 'none', 'important');
        if (sibling.bridgeElement) {
          sibling.bridgeElement.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // Position and show this submenu and bridge
    positionSubmenu();
    submenuContainer.style.setProperty('display', 'block', 'important');
    bridge.style.setProperty('display', 'block', 'important');
  });

  // Hide submenu when leaving item
  itemLi.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      submenuContainer.style.setProperty('display', 'none', 'important');
      bridge.style.setProperty('display', 'none', 'important');
    }, 300);
  });

  // Keep submenu visible when hovering over it or the bridge
  submenuContainer.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    clearTimeout(submenuContainer.hideTimeout);
  });

  bridge.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    clearTimeout(submenuContainer.hideTimeout);
  });

  // Hide when leaving submenu (with delay)
  submenuContainer.addEventListener('mouseleave', (e) => {
    const relatedTarget = e.relatedTarget;

    // Check if we're moving to a child submenu
    if (relatedTarget) {
      // Check if the target is inside this menu (including nested children)
      const isInsideThisMenu = submenuContainer.contains(relatedTarget);

      // Check if we're moving back to the parent item
      const isParentItem = itemLi.contains(relatedTarget);

      // Check if we're moving to a child submenu (by checking if target is inside any submenu that's a child of this one)
      let isMovingToChildSubmenu = false;
      const targetSubmenu = relatedTarget.closest?.('.submenu-container');
      if (targetSubmenu) {
        // Check if this target submenu is a logical child of the current submenu
        const currentSubmenuId = submenuContainer.dataset.submenuId;
        if (targetSubmenu.dataset.parentSubmenu === currentSubmenuId) {
          isMovingToChildSubmenu = true;
        }
      }

      // Check if we're moving to a bridge
      const isMovingToBridge = relatedTarget.closest?.('.submenu-bridge');

      if (isInsideThisMenu || isParentItem || isMovingToChildSubmenu || isMovingToBridge) {
        // Moving to child, staying inside, back to parent, or to bridge - don't hide
        return;
      }
    }

    hideTimeout = setTimeout(() => {
      submenuContainer.style.setProperty('display', 'none', 'important');
      bridge.style.setProperty('display', 'none', 'important');
    }, 300);

    // Store timeout on submenu element so children can cancel it
    submenuContainer.hideTimeout = hideTimeout;
  });

  bridge.addEventListener('mouseleave', (e) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    setTimeout(() => {
      const hoveredElement = document.elementFromPoint(clientX, clientY);
      if (!submenuContainer.contains(hoveredElement) && !itemLi.contains(hoveredElement)) {
        submenuContainer.style.setProperty('display', 'none', 'important');
        bridge.style.setProperty('display', 'none', 'important');
      }
    }, 50);
  });

  // Clean up when parent menu closes
  const observer = new MutationObserver(() => {
    if (parentMenu.style.display === 'none') {
      submenuContainer.style.setProperty('display', 'none', 'important');
      bridge.style.setProperty('display', 'none', 'important');
    }
  });
  observer.observe(parentMenu, { attributes: true, attributeFilter: ['style'] });
}

/**
 * Create overflow dropdown menu showing hidden tabs
 */
function createOverflowDropdown(hiddenTabs) {
  const menu = document.createElement('div');
  menu.className = 'popupTargetContainer menu--nubbin-top uiPopupTarget uiMenuList uiMenuList--default positioned sftabs-custom-dropdown sftabs-overflow-dropdown';
  menu.setAttribute('id', 'sftabs-overflow-dropdown');
  menu.setAttribute('data-aura-rendered-by', 'sftabs-overflow');
  menu.setAttribute('data-aura-class', 'uiPopupTarget uiMenuList uiMenuList--default');

  menu.style.display = 'none';
  menu.style.position = 'absolute';
  menu.style.zIndex = '9999';
  menu.style.width = '240px';

  const menuInner = document.createElement('div');
  menuInner.setAttribute('role', 'menu');
  menuInner.setAttribute('data-aura-rendered-by', 'sftabs-overflow-inner');

  const ul = document.createElement('ul');
  ul.setAttribute('role', 'presentation');
  ul.className = 'scrollable';
  ul.setAttribute('data-aura-rendered-by', 'sftabs-overflow-list');

  // Add each hidden tab to the dropdown
  hiddenTabs.forEach((tab, index) => {
    const itemLi = document.createElement('li');
    itemLi.setAttribute('role', 'presentation');
    itemLi.className = 'uiMenuItem';
    itemLi.setAttribute('data-aura-rendered-by', `sftabs-overflow-item-${index}`);
    itemLi.setAttribute('data-aura-class', 'uiMenuItem');

    const link = document.createElement('a');
    link.setAttribute('role', 'menuitem');
    link.setAttribute('href', 'javascript:void(0)');
    link.setAttribute('title', tab.label);
    link.setAttribute('data-aura-rendered-by', `sftabs-overflow-link-${index}`);

    // Check if this tab has dropdown items
    const hasDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;

    // Create label container
    const labelContainer = document.createElement('span');
    labelContainer.style.display = 'flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.justifyContent = 'space-between';
    labelContainer.style.width = '100%';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'uiOutputText';
    labelSpan.setAttribute('data-aura-rendered-by', `sftabs-overflow-text-${index}`);
    labelSpan.setAttribute('data-aura-class', 'uiOutputText');
    labelSpan.textContent = tab.label;

    labelContainer.appendChild(labelSpan);

    // Add caret if has dropdown (pointing right like normal nested menus)
    if (hasDropdown) {
      const caretIcon = document.createElement('span');
      caretIcon.className = 'submenu-caret';
      caretIcon.style.fontSize = '10px';
      caretIcon.style.color = '#706e6b';
      caretIcon.style.marginLeft = 'auto';
      caretIcon.textContent = '▶'; // Right-pointing caret (submenu opens left or right based on space)
      labelContainer.appendChild(caretIcon);
    }

    link.appendChild(labelContainer);

    // Add click handler to navigate to tab (if tab has a path)
    if (tab.path && tab.path.trim()) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToMainTab(tab);
        menu.classList.remove('visible');
        menu.style.display = 'none';
      });
    } else if (!hasDropdown) {
      // No path and no dropdown - prevent default
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    itemLi.appendChild(link);
    ul.appendChild(itemLi);

    // Add flyout submenu if tab has dropdown items
    if (hasDropdown) {
      createOverflowSubmenu(itemLi, tab, menu);
    }
  });

  menuInner.appendChild(ul);
  menu.appendChild(menuInner);
  return menu;
}

// Note: Global click handler for closing dropdowns is now in content-main.js
// to avoid duplicate event listeners when tabs re-render

// Setup window resize handler for overflow recalculation
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');
    const tabsLoaded = areTabsLoaded();

    if (tabContainer && tabsLoaded) {
      getTabsFromStorage().then(tabs => {
        const topLevelTabs = getTopLevelTabs(tabs);
        handleTabOverflow(tabContainer, topLevelTabs);
      }).catch(error => {
        // Error recalculating overflow on resize
      });
    } else {
    }
  }, 250); // Debounce resize events
});

// Export tab renderer functions
window.SFTabsContent = window.SFTabsContent || {};
window.SFTabsContent.tabRenderer = {
  initTabs,
  getTopLevelTabs,
  createTabElement: createTabElementWithDropdown,
  buildFullUrl,
  addTabClickListeners,
  isLightningNavigationEnabled,
  lightningNavigate,
  highlightActiveTab,
  isCurrentPageMatchingTab,
  removeCustomTabs,
  getTabById,
  areTabsLoaded,
  forceRefreshTabs,
  navigateToMainTab,
  navigateToNavigationItem,
  createInlineDropdownMenu,
  toggleInlineDropdown,
  handleTabOverflow
};