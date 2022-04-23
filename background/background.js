// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

const SELECTION = "customDictionarySelectionMenu";
const TOGGLE_THIS = "customDictionaryToggleOnThisSite";
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Creates the context menu on start up.
 * Calls `removeAll()` first because background.js can start up many times.
 */
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: SELECTION,
    title: "Add \"%s\" to custom dictionary",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: TOGGLE_THIS,
    title: "Enable on this site",
    contexts: ["all"],
    documentUrlPatterns: ["https://*/*", "http://*/*"],
    visible: false,
  });
});

/**
 * Updates the context menu on URL change.
 */
chrome.tabs.onUpdated.addListener(updateContextMenu);
chrome.tabs.onActivated.addListener(updateContextMenu);
chrome.windows.onFocusChanged.addListener(updateContextMenu);

/**
 * Reacts to clicks on context menus.
 */
chrome.contextMenus.onClicked.addListener(async (e, tab) => {
  const {
    menuItemId,
    selectionText,
  } = e;

  switch (menuItemId) {

    // User selected wants to register a new word
    case SELECTION: {
      chrome.tabs.sendMessage(tab.id, { selectionText });
      break;
    }

    // User wants to toggle enable settings on the current site
    case TOGGLE_THIS: {
      const hostname = await getHostname();
      if (hostname === null) {
        break;
      }

      const { allowlist } = await chrome.storage.sync.get({ allowlist: [] });
      const allowed = new Set(allowlist);
      const wasEnabled = allowed.has(hostname);
      wasEnabled ? allowed.delete(hostname) : allowed.add(hostname);
      chrome.storage.sync.set({ allowlist: [...allowed] });
      chrome.contextMenus.update(TOGGLE_THIS, {
        visible: true,
        title: wasEnabled ? `Enable on ${hostname}` : `Disable on ${hostname}`,
      });

      break;
    }

    default: break;
  }
});

/***********
 * HELPERS *
 ***********/

async function updateContextMenu() {
  const hostname = await getHostname();
  if (hostname === null) {
    return;
  }

  const { allowlist } = await chrome.storage.sync.get({ allowlist: [] });
  const isEnabled = allowlist.includes(hostname);
  chrome.contextMenus.update(TOGGLE_THIS, {
    visible: true,
    title: isEnabled ? `Disable on ${hostname}` : `Enable on ${hostname}`,
  });
}

/**
 * @returns hostname if valid, `null` if not.
 */
async function getHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return null;
  }

  const { protocol, hostname } = new URL(tab.url);
  if (!ALLOWED_PROTOCOLS.includes(protocol)) {
    return null;
  }

  return hostname;
}
