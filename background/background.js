// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

const SELECTION = "customDictionarySelectionMenu";
const TOGGLE_THIS = "customDictionaryToggleOnThisSite";

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
  });
});

/**
 * Updates the context menu on URL change.
 */
chrome.tabs.onUpdated.addListener(updateContextMenu);
chrome.tabs.onActivated.addListener(updateContextMenu);

/**
 * Reacts to clicks on context menus.
 */
chrome.contextMenus.onClicked.addListener(async (e, tab) => {
  const {
    menuItemId,
    selectionText,
    pageUrl,
  } = e;

  switch (menuItemId) {

    // User selected wants to register a new word
    case SELECTION: {
      chrome.tabs.sendMessage(tab.id, { selectionText });
      break;
    }

    // User wants to toggle enable settings on the current site
    case TOGGLE_THIS: {
      const { hostname } = new URL(pageUrl);
      const { allowlist } = await chrome.storage.sync.get({ allowlist: [] });
      const allowed = new Set(allowlist);
      const wasEnabled = allowed.has(hostname);
      wasEnabled ? allowed.delete(hostname) : allowed.add(hostname);
      chrome.storage.sync.set({ allowlist: [...allowed] });
      chrome.contextMenus.update(TOGGLE_THIS, {
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const { hostname } = new URL(tab.url);
    const { allowlist } = await chrome.storage.sync.get({ allowlist: [] });
    const isEnabled = allowlist.includes(hostname);
    chrome.contextMenus.update(TOGGLE_THIS, {
      title: isEnabled ? `Disable on ${hostname}` : `Enable on ${hostname}`,
    });
  }
}
