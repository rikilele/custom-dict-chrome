// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/****************
 * CONTEXT MENU *
 ****************/

/**
 * Catches context menu click events from background.js
 * Prompts the user to input the meaning of the selected text,
 * and stores it into chrome.storage.local.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  sendResponse();
  const { selectionText } = request;
  const meaning = prompt(`What is the meaning of "${selectionText}" ?`);
  meaning && chrome.storage.local.set({ [selectionText]: meaning });
});

/*********************
 * PAGE MANIPULATION *
 *********************/

/**
 * Store client-side cache for custom dictionary.
 */
let DICT = {};

/**
 * Store client-side cache for whether this extension is enabled or not.
 */
let ENABLED = false;

/**
 * Re-scans the document body on DOM changes.
 * Starts observing after initial page load.
 * Debounce-enabled --- the update only runs after a 1 second steady state.
 */
let TIMEOUT;
const OBSERVE_OPTIONS = { childList: true, subtree: true };
const OBSERVER = new MutationObserver(() => {
  clearTimeout(TIMEOUT);
  TIMEOUT = setTimeout(() => {
    OBSERVER.disconnect();
    updateNode(document.body);
    OBSERVER.observe(document.body, OBSERVE_OPTIONS);
  }, 1000);
});

/**
 * If enabled, scans and highlights on load and activates the DOM observer.
 */
window.addEventListener("load", async () => {
  updateEnabledStatus();
});

/**
 * Listen to changes to chrome storage, and act accordingly.
 */
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === "sync") {
    updateEnabledStatus();
  }

  if (ENABLED && namespace === "local") {
    DICT = await chrome.storage.local.get(null);
    updateNode(document.body);
  }
});

/***********
 * HELPERS *
 ***********/

async function updateEnabledStatus() {
  const wasEnabled = ENABLED;
  const { hostname } = new URL(document.URL);
  const { allowlist } = await chrome.storage.sync.get({ allowlist: [] })
  ENABLED = allowlist.includes(hostname);
  if (wasEnabled && !ENABLED) {
    clearTimeout(TIMEOUT);
    OBSERVER.disconnect();
    return;
  }

  if (!wasEnabled && ENABLED) {
    DICT = await chrome.storage.local.get(null);
    updateNode(document.body);
    OBSERVER.observe(document.body, OBSERVE_OPTIONS);
  }
}

/**
 * Scans the node and adds tooltips to words that are stored in DICT.
 */
function updateNode(node) {
  console.time("custom dictionary scanned in");

  Object.keys(DICT).forEach((text) => {
    highlightTextsAndCreateTooltips(text, node);
  });

  console.timeEnd("custom dictionary scanned in");
}

const IGNORED_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT",
  "IMG", "VIDEO", "AUDIO", "CANVAS", "SVG", "MAP", "OBJECT",
]);
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
      || currNode.nodeType !== Node.ELEMENT_NODE
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
      translateY(-125%)
      translateX(calc(-50% + ${width / 2}px))
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
