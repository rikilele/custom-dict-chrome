// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/*****************
 * INITIAL SETUP *
 *****************/

window.addEventListener("load", () => {
  updateHighlightStyleView();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  switch (namespace) {
    case "sync": {
      updateHighlightStyleView();
      break;
    }

    default: break;
  }
});

/******************
 * EVENT LISTENER *
 ******************/

document.getElementsByName("highlightStyle").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const highlightStyle = e.target?.value ?? "none";
    chrome.storage.sync.set({ highlightStyle });
  });
});

/**********
 * HELPER *
 **********/

async function updateHighlightStyleView() {
  const { highlightStyle } = await chrome.storage.sync.get("highlightStyle");
  const radios = document.getElementsByName("highlightStyle");
  radios.forEach((radio) => {
    if (radio.value === highlightStyle) {
      radio.checked = true;
    }
  });
}
