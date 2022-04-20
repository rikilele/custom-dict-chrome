// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/**
 * Store client-side cache for custom dictionary.
 */
let DICT;

/**
 * Re-scans the document body on DOM changes.
 * Starts observing after initial page load.
 * Debounce-enabled --- the update only runs after a 1 second steady state.
 */
let TIMEOUT;
const OBSERVER = new MutationObserver(() => {
  clearTimeout(TIMEOUT);
  TIMEOUT = setTimeout(() => {
    OBSERVER.disconnect();
    updateNode(document.body);
    OBSERVER.observe(document.body, { childList: true, subtree: true });
  }, 1000);
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
  console.time("custom dict applied in");

  Object.keys(DICT).forEach((text) => {
    highlightTextsAndCreateTooltips(text, node);
  });

  console.timeEnd("custom dict applied in");
}

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
function highlightTextsAndCreateTooltips(text, node) {
  const queue = [...node.childNodes];
  let currNode;
  while (currNode = queue.pop()) {
    if (currNode.nodeType === Node.TEXT_NODE) {
      handleTextNode(currNode, text);
      continue;
    }

    if (
      IGNORED_TAGS.has(currNode.tagName)
      || currNode.classList?.contains("custom-dictionary-highlighted")
      || currNode.classList?.contains("custom-dictionary-tooltip")
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
          handleTextNode(childNode, text);
          break;
        }

        default: break;
      }
    });
  }
}

/**
 * Checks if the text node contains the targetText.
 * If so, replaces itself with a new node that has its targetTexts highlighted.
 * The highlighted texts will show a tooltip when hovered over.
 */
function handleTextNode(textNode, targetText) {
  const passage = textNode.textContent;
  if (passage.includes(targetText)) {
    const newNode = createHighlightedPassage(passage, targetText);
    textNode.parentNode.replaceChild(newNode, textNode);
  }
}

/**
 * Returns a document fragment of html element nodes.
 * Highlights the text occurrences inside the passage.
 * Adds event listeners to move the tooltip on hover.
 */
function createHighlightedPassage(passage, text) {
  const fragment = new DocumentFragment();
  passage.split(text).forEach((str, i) => {
    (i !== 0) && fragment.appendChild(createHighlightedText(text));
    fragment.appendChild(document.createTextNode(str));
  });

  return fragment;
}

/**
 * Creates a highlighted text that shows a tooltip on hover.
 */
function createHighlightedText(text) {
  const tooltip = getTooltip(text);
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

  return highlightedText;
}

/**
 * Only a single tooltip element is created for each tooltip text.
 * That tooltip text will later be moved around the screen.
 */
const TOOLTIPS = new Map();
function getTooltip(text) {
  if (TOOLTIPS.has(text)) {
    return TOOLTIPS.get(text);
  }

  const tooltipText = DICT[text];
  const tooltip = document.createElement("div");
  tooltip.setAttribute("class", "custom-dictionary-tooltip");
  tooltip.appendChild(document.createTextNode(tooltipText));
  document.body.appendChild(tooltip);
  TOOLTIPS.set(text, tooltip);
  return tooltip;
}
