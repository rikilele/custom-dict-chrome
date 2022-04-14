chrome.storage.sync.get("customDictionary", (result) => {
  updateCustomDictionaryView({...result.customDictionary});
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { newValue }] of Object.entries(changes)) {
    if (key === "customDictionary" && namespace === "sync") {
      updateCustomDictionaryView({...newValue});
    }
  }
});

function updateCustomDictionaryView(dict) {
  const textarea = document.getElementById("customDictionary");
  textarea.value = JSON.stringify(dict, null, 2);
}

document.querySelector("form").addEventListener("submit", handleSubmit);
function handleSubmit(e) {
  e.preventDefault();

  const button = document.getElementById("submitButton");
  const input = document.getElementById("customDictionary").value;

  let json;
  try {
    json = JSON.parse(input);
  } catch {
    // do nothing
  }

  if (
    json === undefined
    || typeof json !== "object"
    || !Object.values(json).every(val => typeof val === "string")
  ) {
    button.value = "Invalid JSON detected";
    button.className = "btn btn-danger";
    return setTimeout(() => {
      button.value = "Save Custom Dictionary";
      button.className = "btn btn-primary";
    }, 3000);
  }

  chrome.storage.sync.set({ customDictionary: json });

  button.value = "Saved successfully";
  button.className = "btn btn-success";
  setTimeout(() => {
    button.value = "Save Custom Dictionary";
    button.className = "btn btn-primary";
  }, 3000);

  return false;
}
