"use strict";

const storageKey = "memory-list-v1";
const listTypes = new Map([
  ["gift", "Gaveønsker"],
  ["shopping", "Handleliste"],
  ["packing", "Pakkeliste"],
  ["other", "Annet"]
]);
const byId = (id) => document.getElementById(id);

const listMenu = byId("list-menu");
const itemField = byId("item-name");
const itemsElement = byId("items");
const progressBar = byId("progress-bar");
const dialog = byId("list-dialog");
const deleteDialog = byId("delete-dialog");
const dialogBackdrop = byId("dialog-backdrop");
const nameField = byId("list-name");
const typeField = byId("list-type");
let fallbackDialogTrigger;
let editingList = false;
let storageReadable = true;
let state = loadState();

function starterState() {
  return {
    activeId: 1,
    lists: [...listTypes].slice(0, 3).map(([type, name], index) => ({
      id: index + 1,
      name,
      type,
      items: []
    }))
  };
}

function isList(list) {
  return list && Number.isSafeInteger(list.id) && typeof list.name === "string"
    && listTypes.has(list.type) && Array.isArray(list.items)
    && list.items.every((item) => item && typeof item.name === "string" && typeof item.done === "boolean");
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return starterState();

    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.lists) || !saved.lists.every(isList)) {
      throw new Error("Ugyldige listedata");
    }
    return saved;
  } catch (error) {
    storageReadable = false;
    showStorageError("Lokal lagring kunne ikke leses. Endringer beholdes bare så lenge appen er åpen.");
    return starterState();
  }
}

function showStorageError(message) {
  const status = byId("storage-status");
  if (message) {
    status.setAttribute("data-error", "");
  } else {
    status.removeAttribute("data-error");
  }
  status.textContent = message ? "Endringer lagres midlertidig" : "Lagres på enheten";

  const error = byId("storage-error");
  error.textContent = message;
  error.hidden = !message;
}

function saveState(nextState) {
  if (storageReadable) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextState));
      showStorageError("");
    } catch (error) {
      showStorageError("Lokal lagring er utilgjengelig. Endringer beholdes bare så lenge appen er åpen.");
    }
  }

  state = nextState;
  render();
}

function activeList() {
  return state.lists.find((list) => list.id === state.activeId) || state.lists[0];
}

function replaceList(updated) {
  saveState({
    activeId: updated.id,
    lists: state.lists.map((list) => list.id === updated.id ? updated : list)
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function replaceContents(element, children) {
  const fragment = document.createDocumentFragment();
  children.forEach((child) => fragment.appendChild(child));
  element.textContent = "";
  element.appendChild(fragment);
}

function renderMenu(selected) {
  const buttons = state.lists.map((list) => {
    const row = document.createElement("li");
    const button = makeElement("button", "list-choice");
    button.type = "button";
    if (list === selected) button.setAttribute("aria-current", "true");

    const dot = makeElement("span", "list-dot");
    const count = makeElement("span", "choice-count", list.items.length);
    dot.setAttribute("aria-hidden", "true");
    count.setAttribute("aria-label", `${list.items.length} punkter`);
    button.append(dot, makeElement("span", "choice-name", list.name), count);
    button.addEventListener("click", () => {
      if (list === activeList()) return;
      saveState({ ...state, activeId: list.id });
      itemField.value = "";
      listMenu.querySelector('[aria-current="true"]').focus();
    });
    row.append(button);
    return row;
  });

  replaceContents(listMenu, buttons);
  byId("sidebar-empty").hidden = state.lists.length > 0;
}

function renderItem(list, item, index) {
  const row = makeElement("li", "item");
  const label = makeElement("label", "item-label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.done;
  checkbox.addEventListener("change", () => {
    const items = list.items.map((entry, position) =>
      position === index ? { ...entry, done: checkbox.checked } : entry
    );
    replaceList({ ...list, items });
    itemsElement.children[index].querySelector("input").focus();
  });
  const name = document.createElement("span");
  name.textContent = item.name;
  label.append(checkbox, name);

  const remove = makeElement("button", "remove-item", "×");
  remove.type = "button";
  remove.setAttribute("aria-label", `Fjern ${item.name}`);
  remove.addEventListener("click", () => {
    const items = list.items.filter((_, position) => position !== index);
    replaceList({ ...list, items });
    const nextRow = itemsElement.children[Math.min(index, items.length - 1)];
    (nextRow ? nextRow.querySelector(".remove-item") : itemField).focus();
  });

  row.append(label, remove);
  return row;
}

function render() {
  const list = activeList();
  renderMenu(list);
  byId("list-panel").hidden = !list;
  byId("no-list").hidden = Boolean(list);
  if (!list) return;

  byId("list-title").textContent = list.name;
  byId("list-category").textContent = listTypes.get(list.type);
  const completed = list.items.filter((item) => item.done).length;
  byId("progress-label").textContent = `${completed} av ${list.items.length} fullført`;
  progressBar.max = list.items.length || 1;
  progressBar.value = completed;
  replaceContents(itemsElement, list.items.map((item, index) => renderItem(list, item, index)));
  byId("empty-list").hidden = list.items.length > 0;
}

function showDialog(target) {
  if (typeof target.showModal === "function") {
    target.showModal();
    return;
  }

  fallbackDialogTrigger = document.activeElement;
  dialogBackdrop.hidden = false;
  target.setAttribute("data-fallback", "");
  target.setAttribute("role", "dialog");
  target.setAttribute("aria-modal", "true");
  target.setAttribute("open", "");
  target.querySelector("[autofocus]").focus();
}

function closeDialog(target) {
  if (!target.hasAttribute("data-fallback")) {
    target.close();
    return;
  }

  target.removeAttribute("open");
  dialogBackdrop.hidden = true;
  fallbackDialogTrigger.focus();
}

function handleFallbackKeys(event) {
  const target = event.currentTarget;
  if (!target.hasAttribute("data-fallback")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog(target);
  }
  if (event.key === "Tab") {
    const controls = target.querySelectorAll("input, select, button");
    const first = controls[0];
    const last = controls[controls.length - 1];
    const fromEdge = event.shiftKey ? first : last;
    if (document.activeElement === fromEdge) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
}

function openListDialog(list) {
  editingList = Boolean(list);
  byId("dialog-title").textContent = editingList ? "Rediger liste" : "Ny liste";
  nameField.value = list ? list.name : "";
  nameField.setCustomValidity("");
  typeField.value = list ? list.type : "other";
  showDialog(dialog);
}

[dialog, deleteDialog].forEach((target) => target.addEventListener("keydown", handleFallbackKeys));
byId("new-list").addEventListener("click", () => openListDialog());
byId("edit-list").addEventListener("click", () => openListDialog(activeList()));
byId("cancel-dialog").addEventListener("click", () => closeDialog(dialog));

nameField.addEventListener("input", () => nameField.setCustomValidity(""));
itemField.addEventListener("input", () => itemField.setCustomValidity(""));

byId("list-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameField.value.trim();
  if (!name) {
    nameField.setCustomValidity("Skriv inn et listenavn.");
    nameField.reportValidity();
    return;
  }

  const type = typeField.value;
  if (editingList) {
    replaceList({ ...activeList(), name, type });
    closeDialog(dialog);
  } else {
    const id = Math.max(0, ...state.lists.map((list) => list.id)) + 1;
    saveState({ activeId: id, lists: [...state.lists, { id, name, type, items: [] }] });
    closeDialog(dialog);
    itemField.value = "";
    itemField.focus();
  }
});

byId("item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const list = activeList();
  const name = itemField.value.trim();
  if (!name) {
    itemField.setCustomValidity("Skriv inn et punkt.");
    itemField.reportValidity();
    return;
  }

  replaceList({ ...list, items: [...list.items, { name, done: false }] });
  itemField.value = "";
  itemField.focus();
});

byId("delete-list").addEventListener("click", () => {
  const list = activeList();
  byId("delete-description").textContent = `«${list.name}» og alle punktene i den blir slettet.`;
  showDialog(deleteDialog);
});

byId("cancel-delete").addEventListener("click", () => closeDialog(deleteDialog));

byId("delete-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const list = activeList();
  const lists = state.lists.filter((entry) => entry.id !== list.id);
  saveState({ activeId: lists.length ? lists[0].id : null, lists });
  closeDialog(deleteDialog);
  itemField.value = "";
  (lists.length ? itemField : byId("new-list")).focus();
});

render();
