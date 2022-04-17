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
    chrome.storage.sync.set({ [selectionText]: meaning });
    highlightTextsAndCreateTooltips(selectionText, meaning);
  }
});

window.addEventListener("load", async () => {
  const dict = await chrome.storage.sync.get(null);
  Object.entries(dict).forEach(([text, tooltipText]) => {
    highlightTextsAndCreateTooltips(text, tooltipText);
  });
});

// HELPERS

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
function highlightTextsAndCreateTooltips(text, tooltipText) {
  const queue = [document.body];
  let currNode;
  while (currNode = queue.pop()) {
    if (
      IGNORED_TAGS.has(currNode.tagName)
      || currNode.classList.contains("custom-dictionary-highlighted")
      || currNode.classList.contains("custom-dictionary-tooltip")
      || !currNode.textContent.includes(text)
    ) {
      continue;
    }

    currNode.childNodes.forEach((childNode) => {
      switch (childNode.nodeType) {

        case Node.ELEMENT_NODE: {
          queue.push(childNode);
          break;
        }

        case Node.TEXT_NODE: {
          const passage = childNode.textContent;
          if (passage.includes(text)) {
            const tooltip = getTooltip(tooltipText);
            const newChild = createHighlightedText(passage, text, tooltip);
            currNode.replaceChild(newChild, childNode);
          }

          break;
        }

        default: break;
      }
    });
  }
}

const tooltips = new Map();
function getTooltip(tooltipText) {
  if (tooltips.has(tooltipText)) {
    return tooltips.get(tooltipText);
  }

  const tooltip = document.createElement("div");
  tooltip.setAttribute("class", "custom-dictionary-tooltip");
  tooltip.appendChild(document.createTextNode(tooltipText));
  document.body.appendChild(tooltip);
  tooltips.set(tooltipText, tooltip);
  return tooltip;
}

function createHighlightedText(passage, text, tooltip) {
  const wrapper = document.createElement("span");
  passage.split(text).forEach((str, i) => {
    if (i !== 0) {
      const highlight = document.createElement("span");
      highlight.setAttribute("class", "custom-dictionary-highlighted");
      highlight.appendChild(document.createTextNode(text));
      highlight.addEventListener("mouseenter", () => {
        const { top, left, width } = highlight.getBoundingClientRect();
        tooltip.style.visibility = "visible";
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = `
          translateY(-128%)
          translateX(calc(-48% + ${width / 2}px))
        `;
      });

      highlight.addEventListener("mouseleave", () => {
        tooltip.style.visibility = "hidden";
      });

      wrapper.appendChild(highlight);
    }

    wrapper.appendChild(document.createTextNode(str));
  });

  return wrapper;
}
