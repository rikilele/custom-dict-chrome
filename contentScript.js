// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/**
 * Update page on initial load.
 */
window.addEventListener("load", () => {
  updatePageView();
});

/**
 * Update page whenever a change is made on chrome.storage.sync
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
  (namespace === "sync") && updatePageView();
});

/**
 * Catches context menu click events from background.js
 * Prompts the user to input the meaning of the selected text,
 * and stores it into chrome.storage.sync.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  sendResponse(); // necessary for async purposes
  const { selectionText } = request;
  const meaning = prompt(`What is the meaning of "${selectionText}" ?`);
  meaning && chrome.storage.sync.set({ [selectionText]: meaning });
});

/***********
 * HELPERS *
 ***********/

/**
 * Scans the document and adds tooltips to words that are stored in the dict.
 */
async function updatePageView() {
  const dict = await chrome.storage.sync.get(null);
  Object.entries(dict).forEach(([text, tooltipText]) => {
    highlightTextsAndCreateTooltips(text, tooltipText);
  });
}

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

const TOOLTIPS = new Map();
function getTooltip(tooltipText) {
  if (TOOLTIPS.has(tooltipText)) {
    return TOOLTIPS.get(tooltipText);
  }

  const tooltip = document.createElement("div");
  tooltip.setAttribute("class", "custom-dictionary-tooltip");
  tooltip.appendChild(document.createTextNode(tooltipText));
  document.body.appendChild(tooltip);
  TOOLTIPS.set(tooltipText, tooltip);
  return tooltip;
}

function createHighlightedText(passage, text, tooltip) {
  const wrapper = document.createElement("span");
  passage.split(text).forEach((str, i) => {
    if (i !== 0) {
      const highlightedText = document.createElement("span");
      highlightedText.setAttribute("class", "custom-dictionary-highlighted");
      highlightedText.appendChild(document.createTextNode(text));
      highlightedText.addEventListener("mouseenter", () => {
        const { top, left, width } = highlightedText.getBoundingClientRect();
        tooltip.style.visibility = "visible";
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = `
          translateY(-128%)
          translateX(calc(-48% + ${width / 2}px))
        `;
      });

      highlightedText.addEventListener("mouseleave", () => {
        tooltip.style.visibility = "hidden";
      });

      wrapper.appendChild(highlightedText);
    }

    wrapper.appendChild(document.createTextNode(str));
  });

  return wrapper;
}
