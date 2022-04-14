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
  if (meaning) {
    chrome.storage.sync.get("customDictionary", (result) => {
      const customDictionary = {...result.customDictionary};
      customDictionary[selectionText] = meaning;
      chrome.storage.sync.set({ customDictionary });
    });

    scanAndHighlightText(selectionText, meaning);
  }
});

window.addEventListener("load", () => {
  chrome.storage.sync.get("customDictionary", (result) => {
    Object.entries({...result.customDictionary}).forEach(([key, value]) => {
      scanAndHighlightText(key, value);
    });
  });
});

// HELPERS

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE"]);

function scanAndHighlightText(text, tooltipText) {
  const queue = [document.body];
  let curr;
  while (curr = queue.pop()) {
    if (!curr.textContent.match(text)) continue;
    if (IGNORED_TAGS.has(curr.tagName)) continue;
    for (let i = 0; i < curr.childNodes.length; i++) {
      const childNode = curr.childNodes[i];
      switch (childNode.nodeType) {
        case Node.ELEMENT_NODE: {
          queue.push(childNode);
          break;
        }

        case Node.TEXT_NODE: {
          if (
            childNode.textContent.match(text)
            && !IGNORED_TAGS.has(childNode.tagName)
          ) {
            const wrapperSpan = document.createElement("span");
            childNode.textContent.split(text).forEach((t, index) => {
              if (index !== 0) {
                const span = document.createElement("span");
                span.setAttribute("class", "custom-dictionary-tooltip");
                const tooltip = document.createElement("span");
                tooltip.setAttribute("class", "custom-dictionary-tooltip-text");
                tooltip.appendChild(document.createTextNode(tooltipText));
                span.appendChild(tooltip);
                span.appendChild(document.createTextNode(text));
                wrapperSpan.appendChild(span);
              }

              wrapperSpan.appendChild(document.createTextNode(t));
            });

            curr.replaceChild(wrapperSpan, childNode);
          }

          break;
        }

        default: break;
      }
    }
  }
}

function buildMessage(title, content) {
  return {
    from: SCRIPT_NAME,
    title,
    content,
  };
}
