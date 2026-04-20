const itemText = document.getElementById("itemText");
const itemImage = document.getElementById("itemImage");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("list");

let items = JSON.parse(localStorage.getItem("myListItems")) || [];

function saveItems() {
  localStorage.setItem("myListItems", JSON.stringify(items));
}

function renderList() {
  list.innerHTML = "";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "list-item";

    if (item.text) {
      const textEl = document.createElement("div");
      textEl.className = "item-text";
      textEl.textContent = item.text;
      li.appendChild(textEl);
    }

    if (item.image) {
      const imageEl = document.createElement("img");
      imageEl.className = "item-image";
      imageEl.src = item.image;
      imageEl.alt = "清單圖片";
      li.appendChild(imageEl);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const upBtn = document.createElement("button");
    upBtn.textContent = "上移";
    upBtn.className = "move-btn";
    upBtn.addEventListener("click", () => moveItemUp(index));

    const downBtn = document.createElement("button");
    downBtn.textContent = "下移";
    downBtn.className = "move-btn";
    downBtn.addEventListener("click", () => moveItemDown(index));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "刪除";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteItem(index));

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(actions);
    list.appendChild(li);
  });
}

function moveItemUp(index) {
  if (index === 0) return;
  [items[index - 1], items[index]] = [items[index], items[index - 1]];
  saveItems();
  renderList();
}

function moveItemDown(index) {
  if (index === items.length - 1) return;
  [items[index + 1], items[index]] = [items[index], items[index + 1]];
  saveItems();
  renderList();
}

function deleteItem(index) {
  items.splice(index, 1);
  saveItems();
  renderList();
}

function addItem() {
  const text = itemText.value.trim();
  const file = itemImage.files[0];

  if (!text && !file) {
    alert("請至少輸入文字或選擇一張圖片");
    return;
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      items.push({
        text,
        image: event.target.result
      });
      saveItems();
      renderList();
      itemText.value = "";
      itemImage.value = "";
    };
    reader.readAsDataURL(file);
  } else {
    items.push({
      text,
      image: ""
    });
    saveItems();
    renderList();
    itemText.value = "";
    itemImage.value = "";
  }
}

addBtn.addEventListener("click", addItem);

renderList();
