// Copyright (c) 2022 Riki Singh Khorana. All rights reserved. MIT license.

/*****************
 * INITIAL SETUP *
 *****************/

window.addEventListener("load", () => {
  updateCustomDictView();
  updateAllowlistView();
  updateHighlightStyleView();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  switch (namespace) {
    case "local": {
      updateCustomDictView();
      break;
    }

    case "sync": {
      updateAllowlistView();
      updateHighlightStyleView();
      break;
    }

    default: break;
  }
});

/*******************
 * HIGHLIGHT STYLE *
 *******************/

document.getElementsByName("highlightStyle").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const highlightStyle = e.target?.value ?? "none";
    chrome.storage.sync.set({ highlightStyle });
  });
});

/***************
 * CUSTOM DICT *
 ***************/

document.getElementById("submitCustomDict").addEventListener("click", async (e) => {
    e.preventDefault();

    let json;
    try {
      json = JSON.parse(document.getElementById("customDict").value);
    } catch {
      // do nothing
    }

    if (
      json === undefined
      || json === null
      || typeof json !== "object"
      || json instanceof Array
      || Object.values(json).some(val => typeof val !== "string")
    ) {
      decorateButton("submitCustomDict", "Invalid JSON detected", "btn-danger");
      return;
    }

    try {
      const keys = new Set(Object.keys(json));
      const oldDict = await chrome.storage.local.get(null);
      const removedKeys = Object.keys(oldDict).filter(key => !keys.has(key));
      await chrome.storage.local.remove(removedKeys);
      await chrome.storage.local.set(json);
      decorateButton("submitCustomDict", "Saved successfully", "btn-success");
    } catch (e) {
      decorateButton("submitCustomDict", "Something went wrong (check console)", "btn-danger");
      console.error(e);
    }
});

document.getElementById("clearCustomDict").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to clear your custom dictionary?")) {
    return;
  }

  try {
    await chrome.storage.local.clear();
  } catch (e) {
    decorateButton("submitCustomDict", "Something went wrong (check console)", "btn-danger");
    console.error(e);
  }
});

/*************
 * ALLOWLIST *
 *************/

document.getElementById("submitAllowlist").addEventListener("click", async (e) => {
  e.preventDefault();

  let array;
  try {
    array = JSON.parse(document.getElementById("allowlist").value);
  } catch {
    // do nothing
  }

  if (
    array === undefined
    || array === null
    || typeof array !== "object"
    || !(array instanceof Array)
    || array.some(val => typeof val !== "string")
  ) {
    decorateButton("submitAllowlist", "Invalid array detected", "btn-danger");
    return;
  }

  try {
    await chrome.storage.sync.set({ allowlist: array });
    decorateButton("submitAllowlist", "Saved successfully", "btn-success");
  } catch (e) {
    decorateButton("submitAllowlist", "Something went wrong (check console)", "btn-danger");
    console.error(e);
  }
});

document.getElementById("clearAllowlist").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to clear your allowlist?")) {
    return;
  }

  try {
    await chrome.storage.sync.set({ allowlist: [] });
  } catch (e) {
    decorateButton("submitAllowlist", "Something went wrong (check console)", "btn-danger");
    console.error(e);
  }
});

/***********
 * HELPERS *
 ***********/

async function updateHighlightStyleView() {
  const { highlightStyle } = await chrome.storage.sync.get("highlightStyle");
  const radios = document.getElementsByName("highlightStyle");
  radios.forEach((radio) => {
    if (radio.value === highlightStyle) {
      radio.checked = true;
    }
  });
}

async function updateCustomDictView() {
  const dict = await chrome.storage.local.get(null);
  const textarea = document.getElementById("customDict");
  textarea.value = JSON.stringify(dict, null, 2);
  setQuotaText(
    document.getElementById("customDictQuota"),
    await chrome.storage.local.getBytesInUse(null),
    5242880,
  );
}

async function updateAllowlistView() {
  const { allowlist } = await chrome.storage.sync.get({ allowlist: []});
  const textarea = document.getElementById("allowlist");
  textarea.value = JSON.stringify(allowlist, null, 2);
  setQuotaText(
    document.getElementById("allowlistQuota"),
    await chrome.storage.sync.getBytesInUse("allowlist"),
    8192,
  );
}

function setQuotaText(el, val, max) {
  const ratio = val / max;
  el.textContent = `${(ratio * 100).toFixed(2)}%`;
  el.className = (ratio < .5)
    ? "bg-success text-light"
    : (ratio < .9)
      ? "bg-warning text-dark"
      : "bg-danger text-light";
}

function decorateButton(id, msg, className) {
  const button = document.getElementById(id);
  button.textContent = msg;
  button.className = `btn ${className}`;
  setTimeout(() => {
    button.textContent = "Save Custom Dictionary";
    button.className = "btn btn-primary";
  }, 3000);
}
