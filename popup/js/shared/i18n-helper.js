/**
 * i18n-helper.js
 * Substitutes __MSG_keyName__ tokens in extension HTML pages using
 * chrome.i18n.getMessage(). This handles cases where Firefox does not
 * perform native __MSG__ substitution for temporary/developer-loaded extensions.
 */
(function localizeDocument() {
  const MSG_PATTERN = /__MSG_([a-zA-Z0-9_@]+)__/g;

  function substituteText(text) {
    return text.replace(MSG_PATTERN, (match, key) => {
      const msg = chrome.i18n.getMessage(key);
      return msg || match;
    });
  }

  function localizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.includes('__MSG_')) {
        node.textContent = substituteText(node.textContent);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Localize attributes (title, placeholder, aria-label, alt, etc.)
    for (const attr of node.attributes) {
      if (attr.value.includes('__MSG_')) {
        attr.value = substituteText(attr.value);
      }
    }

    // Recurse into child nodes
    for (const child of node.childNodes) {
      localizeNode(child);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => localizeNode(document.documentElement));
  } else {
    localizeNode(document.documentElement);
  }
})();
