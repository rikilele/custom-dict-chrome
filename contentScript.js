// Shared with background.js
const SCRIPT_NAME = "customDictionaryContentScript";
const REMOVE_CONTEXT_MENU = "customDictionaryRemoveContextMenu";
const ADD_CONTEXT_MENU = "customDictionaryAddContextMenu";

document.addEventListener("selectionchange", () => {
  chrome.runtime.sendMessage({
    from: SCRIPT_NAME,
    title: REMOVE_CONTEXT_MENU,
  });

  const selectedText = document.getSelection().toString();
  if (selectedText !== "") {
    chrome.runtime.sendMessage({
      from: SCRIPT_NAME,
      title: ADD_CONTEXT_MENU,
      content: selectedText,
    });
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
  let currNode;
  while (currNode = queue.pop()) {
    if (!currNode.textContent.includes(text)) continue;
    if (IGNORED_TAGS.has(currNode.tagName)) continue;
    if (currNode.classList.contains("custom-dictionary-tooltip")) continue;
    if (currNode.classList.contains("custom-dictionary-tooltip-text")) continue;
    currNode.childNodes.forEach((childNode) => {
      switch (childNode.nodeType) {

        case Node.ELEMENT_NODE: {
          queue.push(childNode);
          break;
        }

        case Node.TEXT_NODE: {
          const paragraph = childNode.textContent;
          if (paragraph.includes(text)) {
            const wrapperSpan = createTooltip(paragraph, text, tooltipText);
            currNode.replaceChild(wrapperSpan, childNode);
          }

          break;
        }

        default: break;
      }
    });
  }
}

function createTooltip(paragraph, word, tooltipText) {
  const wrapperSpan = document.createElement("span");
  paragraph.split(word).forEach((t, i) => {
    if (i !== 0) {
      const span = document.createElement("span");
      span.setAttribute("class", "custom-dictionary-tooltip");
      const tooltip = document.createElement("span");
      tooltip.setAttribute("class", "custom-dictionary-tooltip-text");
      tooltip.appendChild(document.createTextNode(tooltipText));
      span.appendChild(tooltip);
      const textNode = document.createTextNode(word);
      span.appendChild(textNode);
      span.addEventListener("mouseenter", () => {
        const { top, left, width } = span.getBoundingClientRect();
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = `
          translateY(-128%)
          translateX(calc(-48% + ${width / 2}px))
        `;
      });

      wrapperSpan.appendChild(span);
    }

    wrapperSpan.appendChild(document.createTextNode(t));
  });

  return wrapperSpan;
}
