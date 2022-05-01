// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/*************
 * CONSTANTS *
 *************/

/**
 * Class name of a highlighted text (registered word).
 */
const HIGHLIGHTED_CLASS = "custom-dictionary-highlighted";

/**
 * Class name of a tooltip.
 */
const TOOLTIP_CLASS = "custom-dictionary-tooltip";

/******************
 * SETTINGS CACHE *
 ******************/

/**
 * Whether this extension is enabled on this page or not.
 */
let ENABLED = false;

/**
 * The custom dictionary.
 */
let DICT = {};

/**
 * The words in the custom dictionary.
 */
let WORDS = [];

/**********************
 * CLASS DECLARATIONS *
 **********************/

/**
 * Observes DOM mutations, and fires debounced callbacks.
 */
class PageObserver {
  _observer;
  _observeOptions = { childList: true, subtree: true };
  _timeout;
  _mutatedNodes = new Set();
  _ms;
  _onMutation;

  /**
   * Creates a new PageObserver instance.
   * The `onMutation` method call will be debounced.
   *
   * @param {(mutatedNodes: Node[]) => void} onMutation callback.
   * @param {number} ms Minimum debounce time. Defaults to 300 ms.
   */
  constructor(onMutation, ms = 300) {
    this._ms = ms;
    this._onMutation = onMutation;
    this._observer = new MutationObserver((mutationList) => {
      clearTimeout(this._timeout);
      this._storeMutatedNodes(mutationList);
      this._registerDebouncedCallback();
    });
  }

  observe() {
    this._observer.observe(document.body, this._observeOptions);
  }

  disconnect() {
    clearTimeout(this._timeout);
    this._observer.disconnect();
  }

  _storeMutatedNodes(mutationList) {
    mutationList.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          this._mutatedNodes.add(node);
        });
      }
    });
  }

  _registerDebouncedCallback() {
    this._timeout = setTimeout(() => {
      this._observer.disconnect();
      const mutatedNodes = this._mutatedNodes.has(document.body)
        ? [document.body]
        : [...this._mutatedNodes].filter((node) => node.isConnected);

      this._onMutation(mutatedNodes);
      this._mutatedNodes.clear();
      this._observer.observe(document.body, this._observeOptions);
    }, this._ms);
  }
}

/*****************
 * CONTEXT MENUS *
 *****************/

/**
 * Catches context menu click events notified by background.js.
 * Prompts the user to input the meaning of the selected text,
 * and stores it into chrome.storage.local.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  sendResponse();
  const { selectionText } = request;
  if (selectionText) {
    const meaning = prompt(`What is the meaning of "${selectionText}" ?`);
    meaning && chrome.storage.local.set({ [selectionText]: meaning });
  }
});

/*********************
 * PAGE MANIPULATION *
 *********************/

/**
 * Set up the PageObserver (DOM mutation observer) instance.
 * Re-scans the document on DOM mutations.
 */
const OBSERVER = new PageObserver((mutatedNodes) => {
  mutatedNodes.forEach((node) => {
    (node.nodeType === Node.TEXT_NODE)
      ? handleTextNode(node, WORDS)
      : highlightTextsAndCreateTooltips(node, WORDS);
  });
});

/**
 * Highlights texts + setup tooltips, and activates the DOM observer,
 */
window.addEventListener("load", () => {
  updateEnabledStatus();
});

/**
 * Listen to changes to chrome storage, and act accordingly.
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  // The allowlist was modified
  if (areaName === "sync") {
    updateEnabledStatus();
  }

  // The dictionary was modified
  if (ENABLED && areaName === "local") {
    await updateCustomDictionary();
    OBSERVER.disconnect();
    Object.entries(changes).forEach(([ text, { oldValue, newValue } ]) => {
      newValue
        ? highlightTextsAndCreateTooltips(document.body, [text])
        : removeHighlightedText(text);
    });

    OBSERVER.observe();
  }
});

/***********
 * HELPERS *
 ***********/

/**
 * Checks whether the extension is enabled on the current page.
 * Acts accordingly if newly enabled / disabled.
 */
async function updateEnabledStatus() {
  const wasEnabled = ENABLED;
  const { hostname } = new URL(document.URL);
  const { allowlist } = await chrome.storage.sync.get({ allowlist: [] })
  ENABLED = allowlist.includes(hostname);

  // Newly enabled
  if (!wasEnabled && ENABLED) {
    await updateCustomDictionary();
    highlightTextsAndCreateTooltips(document.body, WORDS);
    OBSERVER.observe();
  }

  // Newly disabled
  if (wasEnabled && !ENABLED) {
    OBSERVER.disconnect();
    DICT = {};
    WORDS = [];
    const nodes = document.getElementsByClassName(HIGHLIGHTED_CLASS);

    // Use Array.from instead of for...of loop to lock items inside nodes
    Array.from(nodes).forEach((node) => {
      const newNode = document.createTextNode(node.textContent);
      node.parentNode?.replaceChild(newNode, node);
    });

    document.normalize();
  }
}

async function updateCustomDictionary() {
  DICT = await chrome.storage.local.get(null);
  WORDS = Object.keys(DICT);
}

/**
 * Inspired by:
 * https://github.com/padolsey/findAndReplaceDOMText/blob/master/src/findAndReplaceDOMText.js#L106-L112
 */
const IGNORED_TAGS = new Set([
  // Source elements
  "SCRIPT", "LINK", "STYLE", "NOSCRIPT",
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
function highlightTextsAndCreateTooltips(node, texts) {
  const stack = [];
  Array.from(node.childNodes).forEach((childNode) => {
    (childNode.nodeType === Node.TEXT_NODE)
      ? handleTextNode(childNode, texts)
      : stack.push(childNode);
  });

  let currNode;
  while (currNode = stack.pop()) {
    const {
      nodeName,
      nodeType,
      classList,
      textContent, // KEEP: repeated access in texts.every() is expensive
    } = currNode;

    if (
      IGNORED_TAGS.has(nodeName)
      || nodeType !== Node.ELEMENT_NODE
      || classList.contains(HIGHLIGHTED_CLASS)
      || classList.contains(TOOLTIP_CLASS)
      || classList.contains("syntaxhighlighter-pre") // for confluence
      || texts.every((text) => !textContent.includes(text))
    ) {
      continue;
    }

    Array.from(currNode.childNodes).forEach((childNode) => {
      switch (childNode.nodeType) {

        case Node.ELEMENT_NODE: {
          stack.push(childNode);
          break;
        }

        case Node.TEXT_NODE: {
          handleTextNode(childNode, texts);
          break;
        }

        default: break;
      }
    });
  }
}

/**
 * Replaces the `textNode` with a new fragment that contains highlighted texts.
 * Highlighted texts are ones included in the `targetTexts` array.
 */
function handleTextNode(textNode, targetTexts) {
  const { textContent } = textNode;
  const fragment = new DocumentFragment();
  fragment.appendChild(document.createTextNode(textContent));
  targetTexts.forEach((targetText) => {
    if (!textContent.includes(targetText)) {
      return;
    }

    // children of fragment are updated if they contain targetText
    Array.from(fragment.childNodes).forEach((child) => {
      const passage = child.textContent;
      if (child.nodeType === Node.TEXT_NODE && passage.includes(targetText)) {
        const highlighted = createHighlightedPassage(passage, targetText);
        fragment.replaceChild(highlighted, child);
      }
    });
  });

  textNode.parentNode?.replaceChild(fragment, textNode);
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
 * Create the single tooltip element and add it to the document body.
 */
const TOOLTIP = document.createElement("div");
TOOLTIP.className = TOOLTIP_CLASS;
document.body.appendChild(TOOLTIP);

/**
 * Create a prototype of a highlighted text that can be cloned.
 *
 * Cloning an element is more performant than creating a new one each time.
 * https://www.measurethat.net/Benchmarks/Show/18419/0/createelementspan-vs-clonenode
 */
const HIGHLIGHTED_TEXT_PROTO = document.createElement("span");
HIGHLIGHTED_TEXT_PROTO.className = HIGHLIGHTED_CLASS;
HIGHLIGHTED_TEXT_PROTO.style.all = "unset"; // ignores css for <span>

/**
 * Creates a highlighted text that shows a tooltip on hover.
 */
function createHighlightedText(text) {
  const tooltipText = DICT[text];
  const highlightedText = HIGHLIGHTED_TEXT_PROTO.cloneNode();
  highlightedText.textContent = text;
  highlightedText.addEventListener("mouseenter", () => {
    OBSERVER.disconnect();
    TOOLTIP.textContent = tooltipText;
    OBSERVER.observe();
    const { top, left, width } = highlightedText.getBoundingClientRect();
    TOOLTIP.style.cssText = `
      visibility: visible;
      top: ${top}px;
      left: ${left}px;
      transform: translateY(-125%) translateX(calc(${width / 2}px - 50%));
    `;
  });

  highlightedText.addEventListener("mouseleave", () => {
    TOOLTIP.style.visibility = "hidden";
  });

  return highlightedText;
}

/**
 * Removes the highlighted texts of `text` from the page.
 */
function removeHighlightedText(text) {
  OBSERVER.disconnect();
  const nodes = document.getElementsByClassName(HIGHLIGHTED_CLASS);

  // Use Array.from instead of for...of loop to lock items inside nodes
  Array.from(nodes).forEach((node) => {
    if (node.textContent === text) {
      node.parentNode?.replaceChild(document.createTextNode(text), node);
    }
  });

  document.normalize();
  OBSERVER.observe();
}
