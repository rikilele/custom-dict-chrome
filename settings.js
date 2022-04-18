// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

updateCustomDictionaryView();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    updateCustomDictionaryView();
  }
});

document.getElementById("submitButton").addEventListener("click", async (e) => {
    e.preventDefault();

    let json;
    try {
      json = JSON.parse(document.getElementById("customDictionary").value);
    } catch {
      // do nothing
    }

    if (
      json === undefined
      || typeof json !== "object"
      || json instanceof Array
      || Object.values(json).some(val => typeof val !== "string")
    ) {
      decorateButton("Invalid JSON detected", "btn-danger");
      return;
    }

    try {
      const keys = new Set(Object.keys(json));
      const oldDict = await chrome.storage.sync.get(null);
      const removedKeys = Object.keys(oldDict).filter(key => !keys.has(key));
      await chrome.storage.sync.remove(removedKeys);
      await chrome.storage.sync.set(json);
      decorateButton("Saved successfully", "btn-success");
    } catch (e) {
      decorateButton("Something went wrong (check console)", "btn-danger");
      console.error(e);
    }
});

document.getElementById("clearButton").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await chrome.storage.sync.clear();
  } catch (e) {
    decorateButton("Something went wrong (check console)", "btn-danger");
    console.error(e);
  }
});

// HELPERS

async function updateCustomDictionaryView() {
  const dict = await chrome.storage.sync.get(null);
  const textarea = document.getElementById("customDictionary");
  textarea.value = JSON.stringify(dict, null, 2);
  setQuotaText(
    document.getElementById("wordCount"),
    Object.keys(dict).length,
    512,
  );

  setQuotaText(
    document.getElementById("byteCount"),
    await chrome.storage.sync.getBytesInUse(null),
    102400,
  );
}

function setQuotaText(el, val, max) {
  el.innerText = val;
  const ratio = val / max;
  el.className = (ratio < .5)
    ? "bg-success text-light"
    : (ratio < 1)
      ? "bg-warning text-dark"
      : "bg-danger text-light";
}

function decorateButton(msg, className) {
  const button = document.getElementById("submitButton");
  button.innerText = msg;
  button.className = `btn ${className}`;
  setTimeout(() => {
    button.innerText = "Save Custom Dictionary";
    button.className = "btn btn-primary";
  }, 3000);
}
