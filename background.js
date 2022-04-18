// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

chrome.contextMenus.create({
  id: "customDictionary",
  title: "Add \"%s\" to custom dictionary",
  contexts: ["selection"],
});

chrome.contextMenus.onClicked.addListener((e, tab) => {
  const { selectionText } = e;
  chrome.tabs.sendMessage(tab.id, { selectionText });
});
