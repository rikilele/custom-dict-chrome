// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/*************
 * CONSTANTS *
 *************/

const HIGHLIGHTED_CLASS = "custom-dictionary-highlighted";
const TOOLTIP_CLASS = "custom-dictionary-tooltip";

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
    updatePage();
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
    OBSERVER.disconnect();
    console.time("custom dictionary updated in");

    Object.entries(changes).forEach(([ text, { oldValue, newValue } ]) => {
      newValue
        ? highlightTextsAndCreateTooltips(text, document.body)
        : removeHighlightedText(text);
    });

    console.timeEnd("custom dictionary updated in");
    OBSERVER.observe(document.body, OBSERVE_OPTIONS);
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
    const textNode = document.createTextNode("");
    const nodes = document.getElementsByClassName(HIGHLIGHTED_CLASS);
    Array.from(nodes).forEach((node) => {
      const newNode = textNode.cloneNode();
      newNode.textContent = node.textContent
      node.parentNode.replaceChild(newNode, node);
    });

    document.normalize();
    return;
  }

  if (!wasEnabled && ENABLED) {
    DICT = await chrome.storage.local.get(null);
    updatePage();
    OBSERVER.observe(document.body, OBSERVE_OPTIONS);
  }
}

/**
 * Scans the node and adds tooltips to words that are stored in DICT.
 */
function updatePage() {
  console.time("custom dictionary scanned in");

  Object.keys(DICT).forEach((text) => {
    highlightTextsAndCreateTooltips(text, document.body);
  });

  console.timeEnd("custom dictionary scanned in");
}

/**
 * Inspired by:
 * https://github.com/padolsey/findAndReplaceDOMText/blob/master/src/findAndReplaceDOMText.js#L106-L112
 */
const IGNORED_TAGS = new Set([
  // Source elements
  "SCRIPT", "STYLE", "NOSCRIPT",
  // Media elements
  "IMG", "VIDEO", "AUDIO", "CANVAS", "SVG", "MAP", "OBJECT",
  // Input elements
  "INPUT", "SELECT", "OPTION", "OPTGROUP",
  // Special elements
  "IFRAME", "#comment"
]);

/**
 * Looks for `text` in a given `node`, and highlights all occurrence of it.
 * When a user hovers over the text, a tooltip with the definition shows up.
 */
function highlightTextsAndCreateTooltips(text, node) {
  const queue = [];
  node.childNodes.forEach((childNode) => {
    (childNode.nodeType === Node.TEXT_NODE)
      ? handleTextNode(childNode, text)
      : queue.push(childNode);
  });

  let currNode;
  while (currNode = queue.pop()) {
    if (
      IGNORED_TAGS.has(currNode.nodeName)
      || currNode.nodeType !== Node.ELEMENT_NODE
      || currNode.classList.contains(HIGHLIGHTED_CLASS)
      || currNode.classList.contains(TOOLTIP_CLASS)
      || currNode.classList.contains("syntaxhighlighter-pre") // for confluence
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
  const textNode = document.createTextNode("");
  passage.split(text).forEach((str, i) => {
    (i !== 0) && fragment.appendChild(createHighlightedText(text));
    const strNode = textNode.cloneNode();
    strNode.textContent = str;
    fragment.appendChild(strNode);
  });

  return fragment;
}

/**
 * Create a prototype of a highlighted text that can be cloned.
 */
const HIGHLIGHTED_TEXT_PROTO = document.createElement("span");
HIGHLIGHTED_TEXT_PROTO.className = HIGHLIGHTED_CLASS;
HIGHLIGHTED_TEXT_PROTO.style.all = "unset"; // ignores css for <span>

/**
 * Creates a highlighted text that shows a tooltip on hover.
 */
function createHighlightedText(text) {
  const tooltip = getTooltip(text);
  const highlightedText = HIGHLIGHTED_TEXT_PROTO.cloneNode();
  highlightedText.textContent = text;
  highlightedText.addEventListener("mouseenter", () => {
    const { top, left, width } = highlightedText.getBoundingClientRect();
    tooltip.style.cssText = `
      visibility: visible;
      top: ${top}px;
      left: ${left}px;
      transform: translateY(-125%) translateX(calc(${width / 2}px - 50%));
    `;
  });

  highlightedText.addEventListener("mouseleave", () => {
    tooltip.style.visibility = "hidden";
  });

  return highlightedText;
}

/**
 * Create a prototype of a tooltip that can be cloned.
 */
const TOOLTIP_PROTO = document.createElement("div");
TOOLTIP_PROTO.className = TOOLTIP_CLASS;

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
  const tooltip = TOOLTIP_PROTO.cloneNode();
  tooltip.textContent = tooltipText;
  document.body.appendChild(tooltip);
  TOOLTIPS.set(text, tooltip);
  return tooltip;
}

/**
 * Removes the highlighted texts of `text` from the page.
 */
function removeHighlightedText(text) {
  OBSERVER.disconnect();
  const textNode = document.createTextNode(text);
  const nodes = document.getElementsByClassName(HIGHLIGHTED_CLASS);
  Array.from(nodes).forEach((node) => {
    if (node.textContent === text) {
      node.parentNode.replaceChild(textNode.cloneNode(true), node);
    }
  });

  document.normalize();
  OBSERVER.observe(document.body, OBSERVE_OPTIONS);
}
