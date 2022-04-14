// Shared with background.js
const SCRIPT_NAME = "customDictionaryContentScript";
const REMOVE_CONTEXT_MENU = "customDictionaryRemoveContextMenu";
const ADD_CONTEXT_MENU = "customDictionaryAddContextMenu";

document.addEventListener("selectionchange", () => {
  chrome.runtime.sendMessage(buildMessage(REMOVE_CONTEXT_MENU));
  const selectedText = document.getSelection().toString();
  if (selectedText !== "") {
    chrome.runtime.sendMessage(buildMessage(ADD_CONTEXT_MENU, selectedText));
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  sendResponse(); // for async purposes
  const { selectionText } = request;
  const meaning = prompt(`What is the meaning of "${selectionText}" ?`);
  chrome.storage.sync.get("customDictionary", (result) => {
    const customDictionary = {...result.customDictionary};
    customDictionary[selectionText] = meaning;
    chrome.storage.sync.set({ customDictionary });
  });
});

let CUSTOM_DICTIONARY;
chrome.storage.sync.get("customDictionary", (result) => {
  CUSTOM_DICTIONARY = new Map(Object.entries({...result.customDictionary}));
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { newValue }] of Object.entries(changes)) {
    if (key === "customDictionary" && namespace === "sync") {
      CUSTOM_DICTIONARY = new Map(Object.entries(newValue));
    }
  }
});

document.addEventListener("selectionchange", () => {
  const selectedText = document.getSelection().toString();
  if (selectedText !== "" && CUSTOM_DICTIONARY.has(selectedText)) {
    const span = document.createElement("span");
    span.innerText = CUSTOM_DICTIONARY.get(selectedText);
    span.style.backgroundColor = "rgb(255,215,0,.4)";
    const range = document.getSelection().getRangeAt(0);
    range.deleteContents();
    range.insertNode(span);
  }
});

// HELPER
function buildMessage(title, content) {
  return {
    from: SCRIPT_NAME,
    title,
    content,
  };
}
