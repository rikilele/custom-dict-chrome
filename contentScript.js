// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/**
 * Store client-side cache for custom dictionary.
 */
let DICT;

/**
 * An observer to react to DOM changes.
 * Updates the affected nodes for highlighting.
 */
const OBSERVER = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    (mutation.addedNodes.length > 0) && updateNode(mutation.target);
  });
});

/**
 * Scans and highlights the entire document on load,
 * amd activates the DOM observer.
 */
window.addEventListener("load", async () => {
  DICT = await chrome.storage.sync.get(null);
  updateNode(document.body);
  OBSERVER.observe(document.body, { childList: true, subtree: true });
});

/**
 * Update page whenever a change is made on chrome.storage.sync
 */
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  DICT = await chrome.storage.sync.get(null);
  (namespace === "sync") && updateNode(document.body);
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
 * Scans the node and adds tooltips to words that are stored in DICT.
 */
function updateNode(node) {
  Object.entries(DICT).forEach(([text, tooltipText]) => {
    highlightTextsAndCreateTooltips(text, tooltipText, node);
  });
}

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
function highlightTextsAndCreateTooltips(text, tooltipText, node) {
  const queue = [node];
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
            const newChildren = createHighlightedPassage(passage, text, tooltip);
            newChildren.forEach((newChild) => {
              currNode.insertBefore(newChild, childNode)
            });

            currNode.removeChild(childNode);
          }

          break;
        }

        default: break;
      }
    });
  }
}

/**
 * Only a single tooltip element is created for each tooltip text.
 * That tooltip text will later be moved around the screen.
 */
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

/**
 * Returns an array of html element nodes.
 * Highlights the text occurrences inside the passage.
 * Adds event listeners to move the tooltip on hover.
 */
function createHighlightedPassage(passage, text, tooltip) {
  const result = [];
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

      result.push(highlightedText);
    }

    result.push(document.createTextNode(str));
  });

  return result;
}
