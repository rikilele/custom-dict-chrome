// Messages
const SCRIPT_NAME = "customDictionaryContentScript";
const REMOVE_CONTEXT_MENU = "customDictionaryRemoveContextMenu";
const ADD_CONTEXT_MENU = "customDictionaryAddContextMenu";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse(); // for async purposes
  if (message.from === SCRIPT_NAME) {
    switch (message.title) {
      case REMOVE_CONTEXT_MENU: {
        chrome.contextMenus.removeAll();
        break;
      }

      case ADD_CONTEXT_MENU: {
        const { content } = message;
        content && chrome.contextMenus.create({
          id: "customDictionaryContextMenu",
          title: `Add "${content}" to custom dictionary`,
          contexts: ["all"],
        });

        break;
      }

      default: break;
    }
  }
});

chrome.contextMenus.onClicked.addListener((e, tab) => {
  const { selectionText } = e;
  chrome.tabs.sendMessage(tab.id, { selectionText });
});
