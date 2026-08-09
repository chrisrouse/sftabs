// content/tab-renderer.js
// Tab rendering in Salesforce pages

// Flag to prevent concurrent renders
let isRenderingTabs = false;

/** Flyout width, set in CSS and needed before the element is measurable. */
const SUBMENU_WIDTH = 240;

/** Grace period before a flyout closes, so the pointer can cross the gap. */
const SUBMENU_HIDE_DELAY = 300;

/**
 * A render asked for while one was already running.
 *
 * Renders take 200ms to settle and the guard above drops anything arriving in
 * that window. It dropped them silently, and nothing retried — so a change
 * landing mid-render was simply lost, and the bar stayed stale until something
 * unrelated triggered another render or the page was reloaded. That is almost
 * certainly what "saving a tab does not reach open pages" really was; the fix
 * at the time was to have the popup broadcast as well as write, which cannot
 * help, because both signals collapse into the same debounce.
 *
 * One re-run is enough however many arrive: the last one reads current storage.
 */
let renderQueued = false;

/**
 * Submenus live on document.body, not inside the tab that opens them, because
 * the tab bar clips overflow. That puts them outside everything initTabs
 * cleans up: re-rendering removed the tabs and left every submenu and hover
 * bridge behind, along with a MutationObserver each, watching a menu node that
 * had just been detached. Three folder tabs with four children apiece leaked
 * twenty-four nodes and twelve observers per render, and renders are frequent.
 *
 * So they are tracked and swept at the start of each render.
 */
const submenuObservers = [];

/**
 * The bar order as we last drew it, used only to skip work.
 *
 * The reorder watcher fires on any childList change to the tab bar, and
 * Salesforce mutates that container for its own reasons all day. Three storage
 * reads per mutation is the wrong price for discovering nothing moved.
 *
 * This is emphatically not the authority on what changed — comparing a drag
 * against a snapshot is the bug that made the bar stop updating, because a
 * dropped render leaves the snapshot stale and every repaint then looks like a
 * drag. It is only ever used to answer "is the DOM exactly what we drew?", and
 * a yes means there is nothing to do. Any other answer falls through to the
 * stored order, which remains the only thing allowed to decide.
 */
let lastRenderedOrder = [];

function sameOrder(a, b) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function trackSubmenuObserver(observer) {
  submenuObservers.push(observer);
  return observer;
}

function clearSubmenus() {
  submenuObservers.forEach(observer => observer.disconnect());
  submenuObservers.length = 0;
  document.querySelectorAll('.submenu-container, .submenu-bridge')
    .forEach(element => element.remove());
}

/**
 * Color preference, cached from the settings read in getTabsFromStorage().
 * createTabElementWithDropdown() has no settings in scope and runs per row, so
 * reading storage there would mean a round-trip per tab.
 */
let tabColorPref = { enabled: false, style: 'dot' };

/**
 * Initialize tabs in the given container
 */
async function initTabs(tabContainer) {
  if (!tabContainer) {
    return;
  }

  // Prevent concurrent renders, but do not lose this one
  if (isRenderingTabs) {
    renderQueued = true;
    return;
  }

  isRenderingTabs = true;

  try {
    // One pass for both. This used to read tabs and then settings separately,
    // which meant resolving the storage preference twice and re-reading the
    // profile list, on a path that runs on every URL and storage change.
    const { tabs: storedTabs, settings } =
      await window.SFTabs.utils.loadTabsForUrl(window.location.href);
    let tabsToUse = storedTabs;

    // Set here rather than in getTabsFromStorage: content-main.js declares a
    // function of that name too and, loading last, its copy wins — so the
    // assignment over there never ran and every tab rendered colored. This
    // is this file's own render entry point.
    tabColorPref = settings.tabColors || { enabled: false, style: 'dot' };
    const quickAddInBar = !!settings.menuBarQuickAdd;

    // Setup tabs always render (they're the core feature)
    // The floating button location is handled separately

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

    // Body-level submenus from the previous render, and their observers
    clearSubmenus();

    // Remove any existing custom tabs, overflow button and quick-add button
    const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
    existingTabs.forEach(tab => tab.remove());
    const existingQuickAdd = tabContainer.querySelector('.sf-tabs-quick-add');
    if (existingQuickAdd) existingQuickAdd.remove();
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
      try {
        handleTabOverflow(tabContainer, topLevelTabs);
        renderQuickAddButton(tabContainer, quickAddInBar);
        lastRenderedOrder = currentBarOrder(tabContainer);
        watchBarReorder(tabContainer);
      } finally {
        // Always clear it. A throw above used to leave it set, and every later
        // render then early-returned — the bar stopped updating until reload.
        isRenderingTabs = false;
        runQueuedRender();
      }
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
    runQueuedRender();
  }
}

/**
 * Run the render that was dropped while this one was in flight, if there was
 * one. The container is re-queried rather than reused: Salesforce may have
 * replaced it in the meantime, and rendering into a detached node draws nothing.
 */
function runQueuedRender() {
  if (!renderQueued) return;
  renderQueued = false;
  const container = document.querySelector('.tabBarItems.slds-grid');
  if (container) initTabs(container);
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
  const fullUrl = buildTabBarUrl(tab);
  
  // Create the tab element
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
  // Add dropdown indicator classes if tab has dropdown functionality
  if (tab.dropdownItems && tab.dropdownItems.length > 0) {
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
    const hasDropdown = tab.dropdownItems && tab.dropdownItems.length > 0;
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

  // Optional per-tab color. Applied to the li so the tint and the active
  // indicator can span the whole tab, not just the label.
  const utils = window.SFTabs && window.SFTabs.utils;
  if (utils && utils.applyTabColor) {
    utils.applyTabColor(li, tab.color, tabColorPref.style, tabColorPref.enabled);
    if (li.classList.contains('sftabs-tc--dot')) {
      const bead = document.createElement('span');
      bead.className = 'sftabs-tc-mark';
      bead.setAttribute('aria-hidden', 'true');
      a.appendChild(bead);
    }
  }

  // Create span for tab title
  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.textContent = tab.label;

  // Assemble the tab label first
  a.appendChild(span);
  li.appendChild(a);

  // Add dropdown button as separate sibling element (not nested in label)
  if (tab.dropdownItems && tab.dropdownItems.length > 0) {
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
 * Attach a hover flyout to a menu item.
 *
 * This existed twice — once inside renderDropdownItemsRecursive for nested
 * items, once as createOverflowSubmenu for the overflow chevron — at roughly
 * 240 lines each, differing only in which side they tried first and in two
 * details the nested copy had wrong.
 *
 * The container and bridge live on document.body, because the tab bar clips
 * overflow. clearSubmenus() sweeps them at the start of every render; nothing
 * here is expected to outlive one.
 *
 * @param {object}   o
 * @param {Element}  o.itemLi           the row that opens the flyout
 * @param {Element}  o.anchorMenu       the menu the row sits in — positioned
 *                                      against, and watched so the flyout hides
 *                                      when it closes
 * @param {string}   o.parentSubmenuId  'root' when the parent is a top-level
 *                                      menu, otherwise the parent flyout's id
 * @param {string}   o.preferSide       'right' | 'left', tried first
 * @param {Function} o.fill             (ul, container) => void, populates it
 */
function attachSubmenu({ itemLi, anchorMenu, parentSubmenuId, preferSide, fill }) {
  // Replacing an earlier flyout for this row, if a re-render left one
  if (itemLi.submenuElement) itemLi.submenuElement.remove();
  if (itemLi.bridgeElement) itemLi.bridgeElement.remove();

  const submenuContainer = document.createElement('div');
  submenuContainer.className = 'submenu-container popupTargetContainer uiPopupTarget uiMenuList uiMenuList--default';
  submenuContainer.style.cssText = `
    display: none !important;
    position: fixed !important;
    min-width: 200px !important;
    width: ${SUBMENU_WIDTH}px !important;
    z-index: 10001 !important;
    background-color: rgb(255, 255, 255) !important;
    border: 1px solid rgb(221, 219, 218) !important;
    border-radius: 0.25rem !important;
    box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.16) !important;
    padding: 0.5rem 0 !important;
    transform: none !important;
    margin: 0 !important;
  `;
  submenuContainer.dataset.parentSubmenu = parentSubmenuId;
  submenuContainer.dataset.submenuId = `submenu-${Date.now()}-${Math.random()}`;

  const submenuInner = document.createElement('div');
  submenuInner.setAttribute('role', 'menu');

  const ul = document.createElement('ul');
  ul.setAttribute('role', 'presentation');
  ul.className = 'scrollable';
  ul.style.listStyle = 'none';
  ul.style.margin = '0';
  ul.style.padding = '0';

  // Given the container, so anything nested inside positions against this
  // flyout rather than against the menu further up. The nested copy passed the
  // grandparent here, which is why a third level opened beside the wrong menu
  // and could not keep its parent open.
  fill(ul, submenuContainer);

  submenuInner.appendChild(ul);
  submenuContainer.appendChild(submenuInner);
  document.body.appendChild(submenuContainer);

  // An invisible strip spanning the gap, so the pointer can cross without
  // passing over the page and triggering mouseleave.
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

  itemLi.submenuElement = submenuContainer;
  itemLi.bridgeElement = bridge;

  /**
   * Place the flyout beside its anchor, flipping if it would leave the
   * viewport, and stretch the bridge across the gap.
   *
   * A flyout inherits the direction its parent opened in — once a chain has
   * turned left it keeps going left, rather than doubling back across itself.
   * preferSide is only the starting choice: nested items prefer right, the
   * overflow chevron prefers left because it sits at the end of the bar.
   */
  const positionSubmenu = () => {
    const itemRect = itemLi.getBoundingClientRect();
    const anchorRect = anchorMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 2;

    // The set width, not offsetWidth: the element is display:none until now
    const submenuWidth = SUBMENU_WIDTH;

    const inherited = anchorMenu.dataset && anchorMenu.dataset.openDirection;
    const wanted = inherited || preferSide;

    let openRight = wanted !== 'left';
    let left = openRight ? anchorRect.right + gap : anchorRect.left - submenuWidth - gap;

    if (openRight && left + submenuWidth > viewportWidth) {
      left = anchorRect.left - submenuWidth - gap;   // no room right, go left
      openRight = false;
    } else if (!openRight && left < 0) {
      left = anchorRect.right + gap;                 // no room left, go right
      openRight = true;
    }

    // Neither side fits: clamp to the viewport rather than render off-screen
    if (left < 0) left = 0;
    if (left + submenuWidth > viewportWidth) left = Math.max(0, viewportWidth - submenuWidth);

    submenuContainer.dataset.openDirection = openRight ? 'right' : 'left';

    // Vertically aligned to the row, pulled up if it would run off the bottom.
    // Measured by showing it invisibly: offsetHeight is 0 while display is none,
    // and guessing a height puts the clamp in the wrong place.
    let top = itemRect.top;
    submenuContainer.style.setProperty('display', 'block', 'important');
    submenuContainer.style.setProperty('visibility', 'hidden', 'important');
    const submenuHeight = submenuContainer.offsetHeight;
    submenuContainer.style.setProperty('display', 'none', 'important');
    submenuContainer.style.setProperty('visibility', 'visible', 'important');

    if (top + submenuHeight > viewportHeight) {
      top = Math.max(0, viewportHeight - submenuHeight - 10);
    }

    submenuContainer.style.setProperty('left', `${left}px`, 'important');
    submenuContainer.style.setProperty('top', `${top}px`, 'important');
    submenuContainer.style.setProperty('right', 'auto', 'important');
    submenuContainer.style.setProperty('bottom', 'auto', 'important');

    // The bridge spans the whole vertical range between the row and the flyout,
    // not just the row: once the flyout has been pushed up to fit, the pointer
    // travels diagonally, and a row-height strip would not be under it.
    const bridgeTop = Math.min(itemRect.top, top);
    const bridgeHeight = Math.max(itemRect.bottom, top + submenuHeight) - bridgeTop;
    const bridgeLeft = openRight ? anchorRect.right : left + submenuWidth;
    const bridgeWidth = openRight
      ? left - anchorRect.right
      : anchorRect.left - (left + submenuWidth);

    bridge.style.setProperty('left', `${bridgeLeft}px`, 'important');
    bridge.style.setProperty('top', `${bridgeTop}px`, 'important');
    bridge.style.setProperty('width', `${Math.max(0, bridgeWidth)}px`, 'important');
    bridge.style.setProperty('height', `${bridgeHeight}px`, 'important');
  };

  // ── Hover ──
  let hideTimeout;

  const show = () => {
    positionSubmenu();
    submenuContainer.style.setProperty('display', 'block', 'important');
    bridge.style.setProperty('display', 'block', 'important');
  };
  const hide = () => {
    submenuContainer.style.setProperty('display', 'none', 'important');
    bridge.style.setProperty('display', 'none', 'important');
  };
  const hideAfterDelay = () => {
    hideTimeout = setTimeout(hide, SUBMENU_HIDE_DELAY);
    // Stored on the element so a child flyout can cancel its parent's hide
    submenuContainer.hideTimeout = hideTimeout;
  };

  /** Keep this flyout, and the chain above it, from closing underneath us. */
  const keepOpen = () => {
    clearTimeout(hideTimeout);
    clearTimeout(submenuContainer.hideTimeout);
    if (parentSubmenuId === 'root') return;
    const parent = document.querySelector(`.submenu-container[data-submenu-id="${parentSubmenuId}"]`);
    if (parent && parent.hideTimeout) clearTimeout(parent.hideTimeout);
  };

  itemLi.addEventListener('mouseenter', () => {
    keepOpen();
    // Only one flyout open per level
    itemLi.parentElement.querySelectorAll(':scope > li').forEach(sibling => {
      if (sibling === itemLi) return;
      sibling.submenuElement?.style.setProperty('display', 'none', 'important');
      sibling.bridgeElement?.style.setProperty('display', 'none', 'important');
    });
    show();
  });

  itemLi.addEventListener('mouseleave', () => { hideTimeout = setTimeout(hide, SUBMENU_HIDE_DELAY); });

  submenuContainer.addEventListener('mouseenter', keepOpen);
  bridge.addEventListener('mouseenter', keepOpen);

  submenuContainer.addEventListener('mouseleave', event => {
    const to = event.relatedTarget;
    if (to) {
      const staying = submenuContainer.contains(to) || itemLi.contains(to);
      const toChild = to.closest?.('.submenu-container')?.dataset.parentSubmenu
                      === submenuContainer.dataset.submenuId;
      const toBridge = Boolean(to.closest?.('.submenu-bridge'));
      if (staying || toChild || toBridge) return;
    }
    hideAfterDelay();
  });

  bridge.addEventListener('mouseleave', event => {
    // Where the pointer actually landed decides it — relatedTarget is null when
    // it crosses onto the page itself.
    const { clientX, clientY } = event;
    setTimeout(() => {
      const under = document.elementFromPoint(clientX, clientY);
      if (!submenuContainer.contains(under) && !itemLi.contains(under)) hide();
    }, 50);
  });

  // Hide with the menu that owns the row
  const observer = trackSubmenuObserver(new MutationObserver(() => {
    if (anchorMenu.style.display === 'none') hide();
  }));
  observer.observe(anchorMenu, { attributes: true, attributeFilter: ['style'] });
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

    // Nested items open as a flyout beside this row
    if (hasNestedItems && level < 2) { // Support up to 3 levels (0, 1, 2)
      attachSubmenu({
        itemLi,
        anchorMenu: menu,
        parentSubmenuId: menu?.dataset?.submenuId || 'root',
        preferSide: 'right',
        fill: (ul, container) =>
          renderDropdownItemsRecursive(navItem.dropdownItems, ul, parentTab, container, level + 1),
      });
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
  rememberClickedTab(tab.id);

  const fullUrl = buildTabBarUrl(tab);
  
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
 * Build full URL from tab configuration
 */
function buildTabBarUrl(tab) {
  // A folder has nowhere to go, and an <a> still needs an href.
  return window.SFTabs.utils.tabDestinationUrl(tab) || 'javascript:void(0)';
}

/**
 * Add click event listeners for tabs with Lightning navigation support
 */
function addTabClickListeners(tabs) {
  tabs.forEach(tab => {
    const hasPath = tab.path && tab.path.trim();

    // For folder-style tabs (without paths), make the entire LI clickable
    if (!hasPath) {
      const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
      if (tabElement) {
        tabElement.style.cursor = 'pointer';
        tabElement.addEventListener('click', event => {
          // Don't trigger if clicking on dropdown button itself
          if (event.target.closest('.oneNavItemDropdown') ||
              event.target.closest('.uiPopupTrigger') ||
              event.target.closest(`#dropdown-arrow-${tab.id}`)) {
            return;
          }

          // Don't trigger if clicking within dropdown menu
          if (event.target.closest('.sftabs-custom-dropdown')) {
            return;
          }

          // Prevent default navigation
          event.preventDefault();
          event.stopPropagation();

          const hasDropdown = tab.dropdownItems && tab.dropdownItems.length > 0;

          // Toggle dropdown if present
          if (hasDropdown) {
            const dropdown = tabElement.querySelector('.sftabs-custom-dropdown');
            const dropdownArrow = tabElement.querySelector(`#dropdown-arrow-${tab.id}`);

            if (dropdown && dropdownArrow) {
              toggleInlineDropdown(dropdown, dropdownArrow);
            }
          }
        });
      }
      return; // Skip the link listener logic for folder-style tabs
    }

    // For tabs with paths, add listener to the anchor element
    const links = document.querySelectorAll(`li[data-tab-id="${tab.id}"] a`);
    links.forEach(link => {
      // Use capture phase to ensure our listener runs before any other listeners
      link.addEventListener('click', event => {

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

        // At this point, we know the tab has a path (folder-style tabs are handled separately)
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

const LAST_CLICKED_TAB_KEY = 'sftabs_last_clicked_tab_id';

/** Remember which tab the user actually clicked, so identical URLs stay distinguishable. */
function rememberClickedTab(tabId) {
  try { sessionStorage.setItem(LAST_CLICKED_TAB_KEY, tabId); } catch (e) { /* private mode */ }
}

/**
 * Pick the tab matching the current URL.
 *
 * Two tabs can legitimately resolve to the same URL — e.g. an object tab
 * pointing at Account/Details plus a promoted "Details" tab — so URL matching
 * alone cannot tell them apart. The tab the user clicked wins whenever it is
 * still a valid match; otherwise the most specific match does.
 *
 * Specificity replaces an older `tabUrl.split('/Details')[0]` truncation,
 * which made any object tab claim every page under that object.
 */
function findMatchingTab(topLevelTabs, currentUrl) {
  const candidates = [];

  for (const tab of topLevelTabs) {
    const el = document.querySelector(`li[data-tab-id="${tab.id}"]`);
    const tabUrl = el && el.getAttribute('data-url');
    if (!tabUrl) continue;

    if (currentUrl.startsWith(tabUrl)) {
      candidates.push({ tab, score: tabUrl.length, exact: true });
      continue;
    }
    // An ObjectManager tab still counts while browsing that object's sections
    const objectRoot = tabUrl.match(/^.*\/ObjectManager\/[^/]+/);
    if (objectRoot && currentUrl.startsWith(objectRoot[0])) {
      candidates.push({ tab, score: objectRoot[0].length, exact: false });
    }
  }

  if (!candidates.length) return null;

  // Only honour the click when the page is genuinely under that tab's own URL —
  // otherwise a remembered tab would keep the highlight after navigating to a
  // sibling section it merely covers via the object-root fallback.
  let remembered = null;
  try { remembered = sessionStorage.getItem(LAST_CLICKED_TAB_KEY); } catch (e) { /* ignore */ }
  const clicked = remembered && candidates.find(c => c.tab.id === remembered && c.exact);
  if (clicked) return clicked.tab;

  return candidates.sort((a, b) =>
    (b.exact - a.exact) || (b.score - a.score))[0].tab;
}

/**
 * Highlight active custom tab and show current section
 */
async function highlightActiveTab() {
  const currentUrl = window.location.href;

  try {
    const tabs = await getTabsFromStorage();
    const topLevelTabs = getTopLevelTabs(tabs);
    const matchedTab = findMatchingTab(topLevelTabs, currentUrl);

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

// ── Keeping Salesforce from re-highlighting its own tab ──────────
//
// When one of our tabs is the active page, Salesforce still marks one of its
// native tabs active, and keeps re-applying that as it re-renders. So the class
// has to be removed whenever it comes back, which means watching for it.
//
// Exactly one observer does that, for the life of the page. It used to be one
// per call, and this is called twice per initTabs — which runs on every URL
// change, every storage change and every refresh_tabs. After twenty
// navigations roughly forty live observers watched the same nodes, and since
// the callback removes a class, and removing a class is an attribute mutation,
// each one's work re-triggered all the others. That compounds, and it is the
// likeliest reason the tab bar felt slower the longer a tab stayed open.

/** The single observer, and the nodes it is currently attached to. */
let nativeActiveObserver = null;
let observedTabBar = null;
let observedPinned = null;

/** Whether one of our tabs owns the current page. Read by the observer. */
let suppressNativeActive = false;

/** Strip the active state Salesforce put back on its own tabs. */
function removeNativeActiveState() {
  document.querySelectorAll('.tabBarItems .tabItem:not(.sf-tabs-custom-tab)').forEach(tabEl => {
    if (tabEl.classList.contains('slds-is-active')) {
      tabEl.classList.remove('slds-is-active');
      const anchor = tabEl.querySelector('a');
      if (anchor) anchor.setAttribute('aria-selected', 'false');
    }
  });

  // Home, Object Manager and the rest of the pinned strip
  document.querySelectorAll('.pinnedItems .tabItem').forEach(tabEl => {
    if (tabEl.classList.contains('slds-is-active') || tabEl.classList.contains('active')) {
      tabEl.classList.remove('slds-is-active', 'active');
      const anchor = tabEl.querySelector('a');
      if (anchor) anchor.setAttribute('aria-selected', 'false');
    }
  });
}

/**
 * Attach the observer, once — or re-attach if Salesforce has replaced the
 * containers, since an observer on a detached node watches nothing.
 */
function ensureNativeActiveObserver() {
  const tabBar = document.querySelector('.tabBarItems');
  const pinned = document.querySelector('.pinnedItems');
  if (!tabBar && !pinned) return;
  if (nativeActiveObserver && tabBar === observedTabBar && pinned === observedPinned) return;

  if (nativeActiveObserver) nativeActiveObserver.disconnect();

  nativeActiveObserver = new MutationObserver(mutations => {
    if (!suppressNativeActive) return;   // our tab is not the active page
    for (const mutation of mutations) {
      const target = mutation.target;
      if (target.classList &&
          target.classList.contains('tabItem') &&
          !target.classList.contains('sf-tabs-custom-tab') &&
          (target.classList.contains('slds-is-active') || target.classList.contains('active'))) {
        removeNativeActiveState();
        return;   // one sweep clears them all; the rest of this batch is noise
      }
    }
  });

  const options = { attributes: true, attributeFilter: ['class'], subtree: true };
  if (tabBar) nativeActiveObserver.observe(tabBar, options);
  if (pinned) nativeActiveObserver.observe(pinned, options);
  observedTabBar = tabBar;
  observedPinned = pinned;
}

/**
 * Decide whether native tabs should be suppressed on this page, and make sure
 * the observer that enforces it exists.
 */
async function monitorNativeTabActiveState() {
  try {
    const tabs = await getTabsFromStorage();
    suppressNativeActive = !!findMatchingTab(getTopLevelTabs(tabs), window.location.href);

    if (!suppressNativeActive) return;
    ensureNativeActiveObserver();
    removeNativeActiveState();   // catch what is already marked
  } catch (error) {
    // Leave the previous decision in place rather than guessing
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
 * Refuse to be dragged.
 *
 * Setting `draggable` on the element is not enough: these controls are an <li>
 * wrapping an <a href>, and an anchor with an href is draggable by default —
 * `draggable = false` on the parent does not reach the child that is actually
 * being grabbed. Canceling dragstart at the container does, because the event
 * bubbles, so this covers any drag a descendant starts however it was wired.
 */
function refuseDrag(li) {
  li.draggable = false;
  li.addEventListener('dragstart', event => {
    event.preventDefault();
    event.stopPropagation();
  });
}

/**
 * A "+" at the end of the bar that captures the current page.
 *
 * Rendered after overflow has been resolved and inserted before the overflow
 * button when there is one, so it stays the last thing before the chevron
 * rather than disappearing into the hidden set.
 *
 * The write happens in the background worker: it owns the chunk-aware writer,
 * and a content script has no business reimplementing one. This side only
 * parses the page — with the same shared parser the popup's Quick Add uses —
 * and says which profiles should receive it.
 */
function createQuickAddButton() {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  // No navexConsoleTabItem, unlike a real tab: that class is what makes
  // Salesforce's console drag pick a node up, and the quick-add "+" is a control,
  // not a tab. It has no stored position to write back — it is placed last on
  // every render. The look comes from the other three classes.
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight sf-tabs-quick-add';
  refuseDrag(li);

  const a = document.createElement('a');
  a.setAttribute('role', 'button');
  a.setAttribute('tabindex', '-1');
  a.setAttribute('href', 'javascript:void(0)');
  a.classList.add('tabHeader', 'slds-context-bar__label-action');
  a.title = 'Add this page as a tab';
  a.setAttribute('aria-label', a.title);

  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.innerHTML = '<svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" ' +
    'style="width: 14px; height: 14px; fill: currentColor;">' +
    '<path d="M300 290h165c8 0 15-7 15-15v-30c0-8-7-15-15-15H300c-6 0-10-4-10-10V55c0-8-7-15-15-15h-30c-8 0-15 7-15 15v165c0 6-4 10-10 10H55c-8 0-15 7-15 15v30c0 8 7 15 15 15h165c6 0 10 4 10 10v165c0 8 7 15 15 15h30c8 0 15-7 15-15V300c0-6 4-10 10-10"/></svg>';

  a.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (li.classList.contains('sf-tabs-quick-add--busy')) return;
    li.classList.add('sf-tabs-quick-add--busy');
    try {
      await quickAddCurrentPage();
    } finally {
      li.classList.remove('sf-tabs-quick-add--busy');
    }
  });

  a.appendChild(span);
  li.appendChild(a);
  return li;
}

/**
 * Capture this page and hand it to the background worker to store.
 *
 * The work moved to shared utils when the header menu gained the same button:
 * that surface loads from the other content_scripts entry and cannot reach this
 * file, and two copies of the profile-targeting rule is exactly how the two
 * would come to disagree about where a captured page lands.
 */
async function quickAddCurrentPage() {
  const utils = window.SFTabs && window.SFTabs.utils;
  if (!utils || !utils.quickAddPage) return;
  await utils.quickAddPage(window.location.href, document.title);
}

/** Settings, wherever this install keeps them. */
async function readUserSettings() {
  const utils = window.SFTabs.utils;
  return (await utils.readStoredValue('userSettings', await utils.storagePreference())) || {};
}

/** Profiles, wherever this install keeps them. */
async function readProfiles() {
  const utils = window.SFTabs.utils;
  return (await utils.readStoredValue('profiles', await utils.storagePreference())) || [];
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

  // Pair each element with its own tab, by id.
  //
  // This used to index topLevelTabs by the element's position in the DOM, which
  // assumes the two lists are in the same order. They are not, in the window
  // between a drag in the tab bar and the write that persists it: the DOM is
  // already rearranged while topLevelTabs is still sorted by stored position.
  // The overflow menu then listed the wrong labels and navigated to the wrong
  // pages — quietly, since both lists are the same length.
  const tabsById = new Map(topLevelTabs.map(tab => [tab.id, tab]));

  customTabElements.forEach(tabElement => {
    const tab = tabsById.get(tabElement.getAttribute('data-tab-id'));
    if (!tab) return;   // element from a render that has been superseded

    const tabWidth = tabElement.getBoundingClientRect().width;
    if (usedWidth + tabWidth <= availableWidth) {
      usedWidth += tabWidth;
      visibleTabs.push({ element: tabElement, tab });
    } else {
      hiddenTabs.push({ element: tabElement, tab });
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

// ── Dragging tabs in the Salesforce bar ──────────────────────────

/** The custom tabs currently in the bar, in the order they appear. */
function currentBarOrder(tabContainer) {
  return [...tabContainer.querySelectorAll('.sf-tabs-custom-tab[data-tab-id]')]
    .map(li => li.getAttribute('data-tab-id'));
}

/**
 * Watch for the bar being reordered and write the new order back.
 *
 * Our tabs carry navexConsoleTabItem, which is what gives them Salesforce's own
 * console drag for free — but that only moves DOM nodes, so the next render
 * rebuilt from stored positions and undid it.
 *
 * The comparison is against STORED order, not against a snapshot of what we
 * last drew. A snapshot desyncs the moment a render is dropped — initTabs
 * early-returns while another render is in flight — and a stale snapshot makes
 * every repaint look like a drag: the watcher writes, the write broadcasts a
 * refresh, the refresh repaints, and the loop keeps renders permanently in
 * flight so real updates get swallowed. Comparing against the source of truth
 * cannot do that, because after a write the two agree by construction.
 */
function watchBarReorder(tabContainer) {
  if (tabContainer.dataset.sftabsReorderWatched) return;
  tabContainer.dataset.sftabsReorderWatched = '1';

  const onChanged = debounce(async () => {
    const utils = window.SFTabs && window.SFTabs.utils;
    if (!utils || !utils.tabOrderMatches) return;

    const order = currentBarOrder(tabContainer);
    if (order.length === 0) return;               // mid-render, nothing to compare
    if (sameOrder(order, lastRenderedOrder)) return;   // Salesforce moved something of its own

    const stored = await getTabsFromStorage();
    if (!stored || !stored.length) return;
    if (utils.tabOrderMatches(stored, order)) return;   // a repaint, not a drag

    // Only act on a genuine permutation: the same tabs, rearranged. Any other
    // difference means the bar is out of step with storage rather than dragged
    // — a render still in flight, or one dropped by the isRenderingTabs guard
    // while Salesforce touched the container for its own reasons. Writing then
    // would push a stale order back over a newer one.
    const storedIds = stored.filter(tab => tab && !tab.parentId).map(tab => tab.id);
    if (order.length !== storedIds.length) return;
    if (!order.every(id => storedIds.includes(id))) return;

    const settings = await readUserSettings();
    const profiles = await readProfiles();
    await browser.runtime.sendMessage({
      action: 'reorder_tabs',
      profileId: utils.resolveProfileForUrl(window.location.href, profiles, settings),
      order,
    });
  }, 300);

  new MutationObserver(onChanged).observe(tabContainer, { childList: true });
}

/**
 * Place the "+" last, but ahead of the overflow chevron.
 *
 * Called after handleTabOverflow so it cannot be swept into the hidden set.
 * Its width is therefore not part of that measurement — the 140px right buffer
 * already reserved there covers it.
 */
function renderQuickAddButton(tabContainer, enabled) {
  const existing = tabContainer.querySelector('.sf-tabs-quick-add');
  if (existing) existing.remove();
  if (!enabled) return;

  const button = createQuickAddButton();
  const overflow = tabContainer.querySelector('.sf-tabs-overflow-button');
  if (overflow) tabContainer.insertBefore(button, overflow);
  else tabContainer.appendChild(button);
}

/**
 * Create overflow button (chevron) for hidden tabs
 */
function createOverflowButton(hiddenTabs) {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  // No navexConsoleTabItem, unlike a real tab: that class is what makes
  // Salesforce's console drag pick a node up, and the overflow chevron is a control,
  // not a tab. It has no stored position to write back — it is placed last on
  // every render. The look comes from the other three classes.
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight sf-tabs-overflow-button';
  refuseDrag(li);

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
 * The overflow chevron's flyout, listing a hidden tab's sub-items.
 *
 * Prefers opening left: the chevron sits at the right end of the tab bar, so
 * there is rarely room on that side.
 */
function createOverflowSubmenu(itemLi, tab, parentMenu) {
  attachSubmenu({
    itemLi,
    anchorMenu: parentMenu,
    parentSubmenuId: 'root',
    preferSide: 'left',
    fill: (ul, container) =>
      renderDropdownItemsRecursive(tab.dropdownItems, ul, tab, container, 0),
  });
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
    const hasDropdown = tab.dropdownItems && tab.dropdownItems.length > 0;

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
        const hadQuickAdd = !!tabContainer.querySelector('.sf-tabs-quick-add');
        handleTabOverflow(tabContainer, topLevelTabs);
        // handleTabOverflow rebuilds the chevron, so the "+" is re-placed or it
        // would be left sitting to the right of it
        renderQuickAddButton(tabContainer, hadQuickAdd);
      }).catch(error => {
        // Error recalculating overflow on resize
      });
    } else {
    }
  }, 250); // Debounce resize events
});

// Export tab renderer functions
/**
 * Only what this file actually declares.
 *
 * Four names used to appear here that it no longer defines. Two of them —
 * lightningNavigate and navigateToNavigationItem — live in content-main.js,
 * which loads after this file, so the object literal would have captured
 * undefined rather than the function. The other two would have silently
 * captured utils.js's same-named helpers, one of which takes different
 * arguments. Nothing outside this file read any of the four.
 */
window.SFTabsContent = window.SFTabsContent || {};
window.SFTabsContent.tabRenderer = {
  initTabs,
  getTopLevelTabs,
  createTabElement: createTabElementWithDropdown,
  buildTabBarUrl,
  addTabClickListeners,
  highlightActiveTab,
  areTabsLoaded,
  navigateToMainTab,
  createInlineDropdownMenu,
  toggleInlineDropdown,
  handleTabOverflow
};