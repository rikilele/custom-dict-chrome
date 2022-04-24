// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/*************
 * CONSTANTS *
 *************/

/**
 * A context menu ID.
 * Assigned to menu prompting user to register a word to custom dict.
 */
const SELECTION = "customDictionarySelectionMenu";

/**
 * A context menu ID.
 * Assigned to menu prompting user to toggle extension enable status on site.
 */
const TOGGLE_THIS = "customDictionaryToggleOnThisSite";

/*****************
 * CONTEXT MENUS *
 *****************/

/**
 * Creates the context menus on start up.
 * Calls `removeAll()` first because background.js can restart many times.
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
 * Keeps the `TOGGLE_THIS` context menu content up-to-date.
 */
chrome.tabs.onUpdated.addListener(updateContextMenu);
chrome.tabs.onActivated.addListener(updateContextMenu);
chrome.windows.onFocusChanged.addListener(updateContextMenu);

/**
 * Reacts to clicks on context menus.
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const {
    menuItemId,
    selectionText,
  } = info;

  switch (menuItemId) {

    // User wants to register a new word
    case SELECTION: {
      tab?.id && chrome.tabs.sendMessage(tab.id, { selectionText });
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

/**
 * Updates the `TOGGLE_THIS` context menu to display the hostname of the
 * currently viewed website, judging from the active tab + window.
 */
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
 * Returns the hostname of the currently viewed page.
 * Returns `null` if such a page doesn't exist,
 * or the protocol of the page isn't http(s).
 */
async function getHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return null;
  }

  const { protocol, hostname } = new URL(tab.url);
  if (!["http:", "https:"].includes(protocol)) {
    return null;
  }

  return hostname;
}
