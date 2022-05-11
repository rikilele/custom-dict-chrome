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

/**
 * The style of highlights (class name).
 */
let HIGHLIGHT_STYLE = "";

/**********************
 * CLASS DECLARATIONS *
 **********************/

/**
 * Observes DOM mutations, and fires debounced callbacks.
 */
class PageObserver {

  // Static attributes
  #OBSERVE_OPTIONS = { childList: true, subtree: true };

  // Non-static attributes
  #observer;
  #timeout;
  #mutatedNodes = new Set();
  #ms;
  #handleMutation;

  /**
   * Creates a new PageObserver instance.
   * The `callback` method call will be debounced.
   *
   * @param {(mutatedNodes: Node[]) => void} callback
   * @param {number} ms Minimum debounce time. Defaults to 300 ms.
   */
  constructor(callback, ms = 300) {
    this.#ms = ms;
    this.#handleMutation = callback;
    this.#observer = new MutationObserver((mutationList) => {
      clearTimeout(this.#timeout);
      this.#storeMutatedNodes(mutationList);
      this.#registerDebouncedCallback();
    });
  }

  observe() {
    this.#observer.observe(document.body, this.#OBSERVE_OPTIONS);
  }

  disconnect() {
    clearTimeout(this.#timeout);
    this.#observer.disconnect();
  }

  #storeMutatedNodes(mutationList) {
    mutationList.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          this.#mutatedNodes.add(node);
        });
      }
    });
  }

  #registerDebouncedCallback() {
    this.#timeout = setTimeout(() => {
      this.#observer.disconnect();
      const mutatedNodes = this.#mutatedNodes.has(document.body)
        ? [document.body]
        : [...this.#mutatedNodes].filter((node) => node.isConnected);

      this.#handleMutation(mutatedNodes);
      this.#mutatedNodes.clear();
      this.#observer.observe(document.body, this.#OBSERVE_OPTIONS);
    }, this.#ms);
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
    const message = `What is the definition of "${selectionText}" ?\n(Submit empty definition to delete word from dictionary)`;
    const defaultText = DICT[selectionText];
    const userInput = prompt(message, defaultText);
    if (userInput === null) {
      return;
    }

    userInput !== ""
      ? chrome.storage.local.set({ [selectionText]: userInput })
      : chrome.storage.local.remove(selectionText);
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
window.addEventListener("load", async () => {
  await updateHighlightStyle();
  updateEnabledStatus();
});

/**
 * Listen to changes to chrome storage, and act accordingly.
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  // The allowlist was modified
  if (areaName === "sync") {
    await updateHighlightStyle();
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
 * Updates the highlight style.
 */
async function updateHighlightStyle() {
  const { highlightStyle } = await chrome.storage.sync.get("highlightStyle");
  HIGHLIGHT_STYLE = highlightStyle;
  const nodes = document.getElementsByClassName(HIGHLIGHTED_CLASS);
  Array.from(nodes).forEach((node) => {
    node.className = `${HIGHLIGHTED_CLASS} ${highlightStyle}`;
  });
}

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
const HIGHLIGHTED_TEXT_PROTO = document.createElement("abbr");
HIGHLIGHTED_TEXT_PROTO.style.all = "unset";

/**
 * Creates a highlighted text that shows a tooltip on hover.
 */
function createHighlightedText(text) {
  const highlightedText = HIGHLIGHTED_TEXT_PROTO.cloneNode();
  highlightedText.className = `${HIGHLIGHTED_CLASS} ${HIGHLIGHT_STYLE}`;
  highlightedText.textContent = text;
  highlightedText.addEventListener("mouseenter", () => {
    OBSERVER.disconnect();
    TOOLTIP.textContent = DICT[text];
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
