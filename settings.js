function updateCustomDictionaryView(dict) {
  const textarea = document.getElementById("customDictionary");
  textarea.value = JSON.stringify(dict, null, 2);
}

chrome.storage.sync.get("customDictionary", (result) => {
  updateCustomDictionaryView({ ...result.customDictionary });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    Object.entries(changes).forEach(([key, { newValue }]) => {
      if (key === "customDictionary") {
        updateCustomDictionaryView({ ...newValue });
      }
    });
  }
});

document.querySelector("form").addEventListener("submit", (e) => {
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
      || !Object.values(json).every(val => typeof val === "string")
    ) {
      decorateButton("Invalid JSON detected", "btn-danger");
      return;
    }

    chrome.storage.sync.set({ customDictionary: json })
      .then(() => decorateButton("Saved successfully", "btn-success"))
      .catch(() => decorateButton("Not enough storage space", "btn-danger"));

    return false;
});

function decorateButton(msg, className) {
  const button = document.getElementById("submitButton");
  button.value = msg;
  button.className = `btn ${className}`;
  setTimeout(() => {
    button.value = "Save Custom Dictionary";
    button.className = "btn btn-primary";
  }, 3000);
}
