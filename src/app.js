import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getFirestore,
  collection,
  writeBatch,
  orderBy,
  query,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
import Sortable from "sortablejs";
import _ from "lodash";
// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA8UsQZNNkhW-76nND5uysnTp65E-OEcik",
  authDomain: "poroductuploadedpage.firebaseapp.com",
  databaseURL: "https://poroductuploadedpage-default-rtdb.firebaseio.com",
  projectId: "poroductuploadedpage",
  storageBucket: "poroductuploadedpage.appspot.com",
  messagingSenderId: "448207131997",
  appId: "1:448207131997:web:0bc357afb437fb8f1f44b4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let currentItem = null;
let currentSection = "home";
let sectionConfig = {
  home: { title: "Home" },
  categories: { title: "Kategoriler" },
  orders: { title: "Siparişler" },
};

// Fetch section configuration
async function fetchSectionConfig() {
  try {
    const cq = query(collection(db, "categories"), orderBy("order"));
    const categoriesSnapshot = await getDocs(cq);
    const config = {};

    categoriesSnapshot.forEach((doc) => {
      const category = doc.data();
      config[category.propertyName] = { title: category.title };
    });

    return config;
  } catch (error) {
    console.error("Error fetching section config:", error);
    return {};
  }
}

const defaultSections = [
  { propertyName: "Anasayfa", section: "home" },
  { propertyName: "Kategoriler", section: "categories" },
  { propertyName: "Siparişler", section: "orders" },
];

// Update sidebar menu
const updateSidebarMenu = async () => {
  const sidebar = document.getElementById("sidebar");
  let sidebarHTML = "";
  sectionConfig = await fetchSectionConfig();
  // Default sections'ları ekle
  sidebarHTML += defaultSections
    .map(
      (item) => `
    <h2 onclick="showContent('${item.section}')" class="sidebar-item">
      <span>${item.propertyName}</span>
    </h2>
  `
    )
    .join("");

  // Sadece ana kategorileri (parentCategory'si olmayanları) sidebar'a ekle
  const categories = await fetchCategoriesForDropdown();
  const mainCategories = categories.filter((cat) => !cat.parentCategory);

  for (let category of mainCategories) {
    sidebarHTML += `
      <h2 onclick="showContent('${category.propertyName}')" class="sidebar-item">
        <span>${category.title}</span>
      </h2>
    `;
  }

  sidebar.innerHTML = sidebarHTML;
};
window.editSubCategoryItem = async function(itemId, subCategoryName) {
  const originalSection = currentSection; // Mevcut section'ı kaydet
  
  try {
    const docRef = doc(db, subCategoryName, itemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const item = docSnap.data();
      
      // Geçici olarak currentSection'ı alt kategori olarak ayarla
      currentSection = subCategoryName;
      currentItem = itemId;
      
      // Formu düzenleme modunda aç
      await showForm(true);

      // Form elemanlarını doldur
      document.getElementById("name").value = item.name || "";
      document.getElementById("price").value = item.price || "";
      document.getElementById("size").value = item.size || "";
      document.getElementById("width").value = item.width || "";
      document.getElementById("height").value = item.height || "";
      document.getElementById("description").value = item.description || "";
      document.getElementById("tag").value = Array.isArray(item.tag) ? item.tag.join(", ") : item.tag || "";
      
      if (item.imageUrl) {
        document.getElementById("imageFile").setAttribute("data-existing-url", item.imageUrl);
      }
    }
  } catch (error) {
    console.error("Ürün düzenleme hatası:", error);
  }

  // Form submit işleminden sonra kullanılmak üzere original section'ı sakla
  document.getElementById("formContainer").setAttribute("data-original-section", originalSection);
}
window.closeForm = function() {
  const formOverlay = document.getElementById("formOverlay");
  formOverlay.style.display = "none";
  
  // Original section'ı geri yükle
  const originalSection = document.getElementById("formContainer").getAttribute("data-original-section");
  if (originalSection) {
    currentSection = originalSection;
    document.getElementById("formContainer").removeAttribute("data-original-section");
  }
  
  currentItem = null;
  
  // Form alanlarını temizle
  clearFormFields(); // Burada form alanlarını temizle
}

// Kategori düzenleme fonksiyonu


// Kategori silme onayı
window.confirmDeleteCategory = function (categoryId) {
  if (confirm("Bu kategoriyi silmek istediğinizden emin misiniz?")) {
    deleteCategory(categoryId);
  }
};

// Kategori silme fonksiyonu
async function deleteCategory(categoryId) {
  try {
    await deleteDoc(doc(db, "categories", categoryId)); // Firestore'dan sil
    await updateSidebarMenu(); // Sol menüyü güncelle
    fetchItems("categories"); // Kategorileri güncelle
  } catch (error) {
    console.error("Hata:", error);
  }
}
// Show category form
window.showCategoryForm = async function (edit = false) {

  const formOverlay = document.getElementById("formOverlay");
  const formContainer = document.getElementById("formContainer");

  const categories = await fetchCategoriesForDropdown();

  const categoryOptions = categories
    .map(
      (category) =>
        `<option value="${category.propertyName}">${category.title}</option>`
    )
    .join("");

  formContainer.innerHTML = `
    <h2 id="formTitle">${edit ? "Düzenle" : "Ekle"} Kategori</h2>
    <input type="text" id="categoryTitle" placeholder="Kategori Başlığı" required>
    <input type="text" id="propertyName" placeholder="Property Name" required>
    <select id="parentCategory">
      <option value="">Ana Kategori Seçiniz</option>
      ${categoryOptions}
    </select>
    <div class="radioGroup">
      <h4>Seçim Tipi:</h4>
      <div class="radioButtons" style="display:inline-flex; justify-content:center;">
        <input type="radio" id="singleSelect" value="singleSelect" name="select">
        <label for="singleSelect">Tekli Seçim</label><br>
        <input type="radio" id="multiSelect" value="multiSelect" name="select">
        <label for="multiSelect">Çoklu Seçim</label><br>
      </div>
    </div>

    <div class="radioGroup">
      <h4>Fiyat Biçimi:</h4>
      <div class="radioButtons" style="display:inline-flex; justify-content:center;">
        <input type="radio" id="tekil" value="tekil" name="priceFormat">
        <label for="tekil">Tekil</label><br>
        <input type="radio" id="metrekare" value="metrekare" name="priceFormat">
        <label for="metrekare">Metrekare</label><br>
        <input type="radio" id="cevre" value="cevre" name="priceFormat">
        <label for="cevre">Çevre</label><br>
        <input type="radio" id="artis" value="artis" name="priceFormat">
        <label for="artis">Artış</label><br>
        <input type="radio" id="tasDuvar" value="tasDuvar" name="priceFormat">
        <label for="artis">Taş Duvar</label><br>
      </div>
    </div>
    <input type="text" id="categoryTags" placeholder="Etiketleri virgül ile ayırınız">
    <br >
    <div style="display:flex; justify-content:center;">
      <button onclick="submitCategory()">Kaydet</button>
      <button onclick="closeForm()">İptal</button>
    </div>
  `;
  formOverlay.style.display = "flex";
};

// Fetch categories for the dropdown
async function fetchCategoriesForDropdown() {
  try {
    const cq = query(collection(db, "categories"), orderBy("order"));
    const categoriesSnapshot = await getDocs(cq);
    const categories = categoriesSnapshot.docs.map((doc) => doc.data());
    return categories;
  } catch (error) {
    console.error("Error fetching categories for dropdown:", error);
    return [];
  }
}
window.editCategory = async function (categoryId) {
  currentItem = categoryId; // Mevcut kategori ID'sini atayın
  console.log("Editing category with ID:", currentItem); // Kontrol için log ekleyin

  try {
    const docRef = doc(db, "categories", categoryId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const category = docSnap.data();
      await showCategoryForm(true); // Formu düzenleme modunda açın

      // Form elemanlarını kategori bilgileriyle doldurun
      document.getElementById("categoryTitle").value = category.title || "";
      document.getElementById("propertyName").value = category.propertyName || "";
      document.getElementById("categoryTags").value = category.tags ? category.tags.join(", ") : "";
      document.getElementById("parentCategory").value = category.parentCategory || "";
      document.querySelector(`input[name="select"][value="${category.select}"]`).checked = true;
      document.querySelector(`input[name="priceFormat"][value="${category.priceFormat}"]`).checked = true;
    } else {
      console.error("Kategori bulunamadı!");
    }
  } catch (error) {
    console.error("Kategori düzenleme hatası:", error);
  }
};

window.submitCategory = async function () {
  const categoryTitle = document.getElementById("categoryTitle").value;
  const propertyName = document.getElementById("propertyName").value;
  const parentCategory = document.getElementById("parentCategory").value;
  const selectValue = document.querySelector(`input[name="select"]:checked`)?.value;
  const priceFormat = document.querySelector(`input[name="priceFormat"]:checked`)?.value;
  const tags = document.getElementById("categoryTags").value.split(",").map((tag) => tag.trim());

  if (!categoryTitle || !propertyName || !selectValue || !priceFormat) {
    alert("Lütfen tüm zorunlu alanları doldurun!");
    return;
  }

  try {
    let categoryId = currentItem;
    let orderValue;

    if (currentItem) {
      // Mevcut kategoriyi güncelleme işlemi
      console.log("Düzenleme modunda, kategori ID:", currentItem);
      const categoryDocRef = doc(db, "categories", categoryId);
      const categoryDocSnap = await getDoc(categoryDocRef);
      orderValue = categoryDocSnap.exists() ? categoryDocSnap.data().order : 0;
    } else {
      // Yeni kategori ekleme işlemi
      console.log("Yeni kategori ekleniyor...");
      categoryId = await updateID();
      if (!categoryId) {
        alert("Yeni kategori ID'si oluşturulurken bir hata oluştu.");
        return;
      }
      const collectionRef = collection(db, "categories");
      const querySnapshot = await getDocs(collectionRef);
      orderValue = querySnapshot.size + 1;
    }

    // Kategoriyi kaydet veya güncelle
    await setDoc(doc(db, "categories", categoryId), {
      title: categoryTitle,
      propertyName: propertyName,
      parentCategory: parentCategory,
      select: selectValue,
      priceFormat: priceFormat,
      order: orderValue,
      tags: tags,
    }, { merge: true });

    closeForm();
    fetchItems("categories");
    updateSidebarMenu();
    currentItem = null; // İşlem sonrasında `currentItem` sıfırlanır
  } catch (error) {
    console.error("Kategori kaydedilirken hata:", error);
  }
};




const fetchItems = async (section) => {
  let itemListHTML = "";
  let mainContent = document.getElementById("mainContent");
  let subCatDiv = document.getElementById("subCatDiv");
  subCatDiv.innerHTML = "";

  if (section === "home") {
    const sidebarItems = Object.keys(sectionConfig).map((key) => ({
      name: sectionConfig[key].title,
      section: key,
    }));

    itemListHTML = sidebarItems
      .map(
        (item) => `
      <div onclick="showContent('${item.section}')" class="item-box">
        <h3>${item.name}</h3>
      </div>
    `
      )
      .join("");
  } else if (section === "categories") {
    const q = query(collection(db, "categories"), orderBy("order"));
    const categoriesSnapshot = await getDocs(q);
    itemListHTML = categoriesSnapshot.docs
      .map((doc) => {
        const category = doc.data();
        const parentCategory = category.parentCategory || ""; // parentCategory'yi category'den al
        const tags = category.tags ? category.tags.join(", ") : "";
        return `
         <div class="item-box" data-id="${doc.id}">
          <h3>${category.title}</h3>
          <p>Kısaltma Adı: ${category.propertyName}</p>
          <p>Seçme: ${category.select}</p>
          <p>Fiyat Biçimi: ${category.priceFormat || "Belirtilmemiş"}</p>
          <p>Ana Kategori: ${
            parentCategory !== "" ? parentCategory : "Ana Kategori"
          }</p>
           <p>Etiketler: ${tags}</p>
           <div class="ort">
          <button onclick="editCategory('${doc.id}')">Düzenle</button>
          <button onclick="confirmDeleteCategory('${
            doc.id
          }')" class="delete-btn">Sil</button>
          </div>
        </div>
      `;
      })
      .join("");
  } else {
    const qe = query(collection(db, section), orderBy("order"));
    const querySnapshot = await getDocs(qe);
    itemListHTML = querySnapshot.docs
      .map((doc) => {
        const item = doc.data();
        return `
          <div class="item-box" data-id="${doc.id}">
          <h3>${item.name || "İsim Belirtilmemiş"}</h3>
          <div class="image-container">
            <img src="${item.imageUrl}" alt="${item.name}" class="item-image"/>
          </div>
          <p>Fiyat: ${item.price}</p>
          <p>Boyut: ${item.size}</p>
           ${
             item.width || item.height
               ? `<p>Ölçüler: ${item.width || "-"}x${item.height || "-"} m</p>`
               : ""
           }
          <p>Açıklama: ${item.description}</p>
          <p>Tag: ${
            Array.isArray(item.tag) ? item.tag.join(", ") : item.tag
          }</p>
          <button onclick="editItem('${doc.id}')">Düzenle</button>
          <button onclick="confirmDelete('${
            doc.id
          }')" class="delete-btn">Sil</button>
        </div>
      `;
      })
      .join("");

    // Alt kategorileri recursive olarak getir
    const subCatDivs = document.createElement("div");
    subCatDiv.appendChild(subCatDivs);
    subCatDivs.setAttribute("id", "subCatDiv");
    
    // Recursive olarak tüm alt kategorileri getir
    subCatDivs.innerHTML = await fetchSubCategoriesRecursive(section);

    // Sortable'ı tüm alt kategoriler için başlat
    initSortableRecursive();
  }

  document.getElementById("itemList").innerHTML = itemListHTML;
  initSortable();
};

async function fetchSubCategoryItems(subCategoryName) {
  try {
    const qe = query(collection(db, subCategoryName), orderBy("order"));
    const querySnapshot = await getDocs(qe);
    return querySnapshot.docs
      .map((doc) => {
        const item = doc.data();
        return `
          <div class="item-box" data-id="${doc.id}">
            <h3>${item.name || "Unnamed Item"}</h3>
            <div class="image-container">
              <img src="${item.imageUrl}" alt="${item.name}" class="item-image"/>
            </div>
            <p>Fiyat: ${item.price}</p>
            <p>Boyut: ${item.size}</p>
            ${
              item.width || item.height
                ? `<p>Ölçüler: ${item.width || "-"}x${item.height || "-"} m</p>`
                : ""
            }
            <p>Açıklama: ${item.description}</p>
            <p>Tag: ${Array.isArray(item.tag) ? item.tag.join(", ") : item.tag}</p>
            <button onclick="editSubCategoryItem('${doc.id}', '${subCategoryName}')">Edit</button>
            <button onclick="confirmDeleteSubCategoryItem('${doc.id}', '${subCategoryName}')" class="delete-btn">Delete</button>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Alt kategori ürünleri yüklenirken hata:", error);
    return "";
  }
}
async function fetchSubCategoriesRecursive(parentCategory) {
  const categories = await fetchCategoriesForDropdown();
  const subCategories = categories.filter(cat => cat.parentCategory === parentCategory);
  let html = '';

  for (const subCat of subCategories) {
    html += `
      <div class="sub-category-section">
        <button id="addItemBtn" class="add-item-btn" onclick="showSubCategoryForm('${subCat.propertyName}')">
          ${subCat.title}'ye Ürün Ekle
        </button>
        <h2 class="section-header">${subCat.title}</h2>
        <div id="itemList-${subCat.propertyName}" class="sortable-list itemList">
          ${await fetchSubCategoryItems(subCat.propertyName)}
        </div>
        ${await fetchSubCategoriesRecursive(subCat.propertyName)} <!-- Alt kategorilerin alt kategorilerini recursive olarak getir -->
      </div>
    `;
  }

  return html;
}
// Alt kategori için ürün ekleme formunu göster
window.showSubCategoryForm = function (subCategoryName) {
  currentSection = subCategoryName; // Geçerli section'ı alt kategori olarak ayarla
  showForm(false); // Normal ürün formunu göster
};

// Alt kategori ürününü düzenleme

// Alt kategori ürününü silme
window.confirmDeleteSubCategoryItem = function(itemId, subCategoryName) {
  if (confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
    deleteSubCategoryItem(itemId, subCategoryName);
  }
}

window.deleteSubCategoryItem = async function(itemId, subCategoryName) {
  try {
    await deleteDoc(doc(db, subCategoryName, itemId));
    // Ana kategoriyi ve alt kategoriyi yenile
    await fetchItems(currentSection);
  } catch (error) {
    console.error("Alt kategori ürünü silinirken hata:", error);
  }
}
// Kategorileri yükledikten sonra content'i göster
window.showContent = async function (section) {
  currentSection = section;

  if (!sectionConfig[section]) {
    sectionConfig = await fetchSectionConfig(); // Kategorileri tekrar yükle
    updateSidebarMenu(); // Sidebar'ı güncelle
  }

  updateHeaderAndButtons(section);
  await fetchItems(section); // İçeriği getir
  document.getElementById("sectionHeader").textContent =
    sectionConfig[section]?.title || "Section"; // Varsayılan başlık
};
const updateHeaderAndButtons = (section) => {
  const addItemBtn = document.getElementById("addItemBtn");

  if (section === "orders") {
    addItemBtn.style.display = "none";
  } else if (section === "categories") {
    addItemBtn.style.display = "block";
    addItemBtn.innerText = "Kategori Ekle";
    addItemBtn.onclick = () => showCategoryForm(false); // Kategori ekleme modunda formu göster
  } else {
    addItemBtn.style.display = "block";
    addItemBtn.innerText = "Ürün Ekle";
    addItemBtn.onclick = showForm; // Ürün ekleme modunda formu göster
  }

  // Update the section header
  document.getElementById("sectionHeader").textContent =
    sectionConfig[section]?.title || "Section";
};
// Show form for adding/editing items
window.showForm = async function(edit = false) {
  updateID(); // ID'yi güncelle
  const formOverlay = document.getElementById("formOverlay");
  const formContainer = document.getElementById("formContainer");

  formContainer.innerHTML = `
    <h2 id="formTitle">${edit ? "Düzenle" : "Ekle"} Ürün</h2>
    <input type="text" id="name" placeholder="Ürün Adı" required>
    <input type="number" id="price" required placeholder="Fiyat - cevre">
    <input type="number" id="alanPrice" placeholder="Fiyat - alan">
    <input type="text" id="size" required placeholder="Boyut">
    <div style="display: flex; gap: 10px;">
      <input type="text" id="width" placeholder="En (cm)" min="0" step="0.1">
      <input type="text" id="height" placeholder="Boy (cm)" min="0" step="0.1">
    </div>
    <input type="text" id="description" placeholder="Açıklama">
    <input type="text" id="tag" required placeholder="Etiketleri virgül ile ayırınız.">
    <input type="file" id="imageFile" accept="image/*">
    <button onclick="submitItem()">Kaydet</button>
    <button onclick="closeForm()">İptal</button>
  `;
  formOverlay.style.display = "flex";

  if (edit && currentItem) {
    setTimeout(async () => {
      try {
        const docRef = doc(db, currentSection, currentItem);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const item = docSnap.data();
          document.getElementById("name").value = item.name || "";
          document.getElementById("price").value = item.price || "";
          document.getElementById("alanPrice").value = item.alanPrice || "";
          document.getElementById("size").value = item.size || "";
          document.getElementById("width").value = item.width || "";
          document.getElementById("height").value = item.height || "";
          document.getElementById("description").value = item.description || "";
          document.getElementById("tag").value = Array.isArray(item.tag) ? item.tag.join(", ") : item.tag || "";
          document
            .getElementById("imageFile")
            .setAttribute("data-existing-url", item.imageUrl || "");
        }
      } catch (error) {
        console.error("Ürün yüklenirken hata:", error);
      }
    }, 200);
  } else {
    clearFormFields(); // Formu temizle
  }
}
// Ürün silme
const deleteItem = async (itemID) => {
  try {
    await deleteDoc(doc(db, currentSection, itemID)); // Firestore'dan sil
    fetchItems(currentSection); // Ürün listesini güncelle
  } catch (error) {
    console.error("Ürün silme hatası:", error);
  }
};
window.confirmDelete = async function (itemID) {
  const confirmed = confirm("Bu ürünü silmek istediğinize emin misiniz?");
  if (confirmed) {
    await deleteItem(itemID);
  }
};
// Ürün düzenleme
window.editItem = async function (itemId) {
  try {
    const docRef = doc(db, currentSection, itemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const item = docSnap.data();

      // Formun DOM'da olduğundan emin olalım
      showForm(true); // Formu düzenleme modunda açıyoruz

      // Form elemanlarını DOM'dan aldığımıza emin olalım
      const nameField = document.getElementById("name");
      const priceField = document.getElementById("price");
      const alanPriceField = document.getElementById("alanPrice");
      const sizeField = document.getElementById("size");
      const widthField = document.getElementById("width")
      const heightField =document.getElementById("height")
      const descField = document.getElementById("description");
      const tagField = document.getElementById("tag");
      const imageFileField = document.getElementById("imageFile");

      if (
        !nameField ||
        !priceField ||
        !alanPriceField ||
        !sizeField ||
        !widthField ||
        !heightField ||
        !descField ||
        !tagField ||
        !imageFileField
      ) {
        console.error("Form elementleri bulunamadı!");
        return;
      }

      // Formu düzenleme modunda doldur
      nameField.value = item.name || "";
      priceField.value = item.price || "";
      alanPriceField.value = item.alanPrice || "";
      sizeField.value = item.size || "";
      widthField.value = item.width || "";
      heightField.value = item.height || "";
      descField.value = item.description || "";
      tagField.value = item.tag || "";

      // Eğer resim varsa mevcut resim URL'sini tut
      imageFileField.setAttribute("data-existing-url", item.imageUrl || "");

      currentItem = itemId; // Düzenlenecek öğenin ID'sini sakla
    } else {
      console.error("Ürün bulunamadı!");
    }
  } catch (error) {
    console.error("Ürün düzenleme hatası:", error);
  }
};


// Formu temizleme fonksiyonu
function clearFormFields() {
  const nameField = document.getElementById("name");
  const priceField = document.getElementById("price");
  const alanPriceField = document.getElementById("alanPrice");
  const sizeField = document.getElementById("size");
  const widthField = document.getElementById("width");
  const heightField = document.getElementById("height");
  const descField = document.getElementById("description");
  const tagField = document.getElementById("tag");
  const imageFileField = document.getElementById("imageFile");

  if (nameField) nameField.value = "";
  if (priceField) priceField.value = "";
  if (alanPriceField) priceField.value = "";
  if (sizeField) sizeField.value = "";
  if (widthField) widthField.value = "";
  if (heightField) heightField.value = "";
  if (descField) descField.value = "";
  if (tagField) tagField.value = "";
  if (imageFileField) {
    imageFileField.value = "";
    imageFileField.removeAttribute("data-existing-url");
  }
}


// Dinamik ID oluşturma fonksiyonu
window.updateID = async function () {
  try {
    const collectionRef = collection(db, "categories");
    const querySnapshot = await getDocs(collectionRef);
    return `category-${querySnapshot.size + 1}`; // Yeni ID formatı
  } catch (error) {
    console.error("Error fetching items for ID update:", error);
    return null; // Hata durumunda null döndür
  }
};

// Ürün gönderme fonksiyonu
window.submitItem = async function() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const alanPrice = document.getElementById("alanPrice").value;
  const size = document.getElementById("size").value;
  const width = document.getElementById("width").value;
  const height = document.getElementById("height").value;
  const description = document.getElementById("description").value;
  const tag = document.getElementById("tag").value.split(",").map(t => t.trim());
  const imageFile = document.getElementById("imageFile").files[0];
  const originalSection = document.getElementById("formContainer").getAttribute("data-original-section");

  if (!name || !price || !size) {
    alert("Lütfen gerekli alanları doldurun!");
    return;
  }

  try {
    // Kategoriye ait mevcut döküman sayısını al
    const collectionRef = collection(db, currentSection);
    const querySnapshot = await getDocs(collectionRef);
    const documentCount = querySnapshot.size;

    // Yeni döküman ID'sini oluştur
    const itemID = `${currentSection}-${documentCount + 1}`; // ID formatı: kategoriAdı-sayı
    let imageUrl = "";

    if (imageFile) {
      const storageRef = ref(storage, `images/${itemID}`);
      await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(storageRef);
    } else if (document.getElementById("imageFile").hasAttribute("data-existing-url")) {
      imageUrl = document.getElementById("imageFile").getAttribute("data-existing-url");
    }

    const orderValue = currentItem ? (await getDoc(doc(db, currentSection, currentItem))).data()?.order : documentCount + 1;

    await setDoc(doc(db, currentSection, itemID), {
      name,
      price,
      alanPrice,
      size,
      width: width || null,
      height: height || null,
      description,
      tag,
      imageUrl,
      order: orderValue
    }, { merge: true });

    closeForm();

    // Ana kategoriyi ve alt kategoriyi yenile
    if (originalSection && originalSection !== currentSection) {
      await fetchItems(originalSection);
    } else {
      await fetchItems(currentSection);
    }

    // Form verilerini temizle
    currentItem = null;
    document.getElementById("formContainer").removeAttribute("data-original-section");
  } catch (error) {
    console.error("Ürün kaydedilirken hata:", error);
  }
}
// Ürün düzenleme fonksiyonu
const initSortable = (subCategories) => {
  // Ana kategori için Sortable
  const mainItemList = document.getElementById("itemList");
  if (mainItemList) {
    Sortable.create(mainItemList, {
      animation: 150,
      onEnd: async (evt) => {
        const itemIDs = Array.from(mainItemList.children).map(
          (item) => item.dataset.id
        );
        await updateItemOrder(itemIDs, currentSection);
      },
    });
    
  }

  // Alt kategoriler için Sortable
  if (subCategories && subCategories.length > 0) {
    subCategories.forEach((subCat) => {
      const subItemList = document.getElementById(
        `itemList-${subCat.propertyName}`
      );
      if (subItemList) {
        Sortable.create(subItemList, {
          animation: 150,
          onEnd: async (evt) => {
            const itemIDs = Array.from(subItemList.children).map(
              (item) => item.dataset.id
            );
            await updateItemOrder(itemIDs, subCat.propertyName);
          },
        });
      }
    });
  }
};
const initSortableRecursive = () => {
  // Ana liste için Sortable
  const mainItemList = document.getElementById("itemList");
  if (mainItemList) {
    Sortable.create(mainItemList, {
      animation: 150, // Sürükleme animasyonunun süresi (milisaniye)
      onEnd: async (evt) => {
        // Sıralama bittiğinde çalışacak fonksiyon
        const itemIDs = Array.from(mainItemList.children).map(item => item.dataset.id);
        await updateItemOrder(itemIDs, currentSection);
      }
    });
  }

  // Tüm alt kategori listelerini bul ve Sortable'ı başlat
  const allItemLists = document.querySelectorAll('[id^="itemList-"]');
  allItemLists.forEach(list => {
    const categoryName = list.id.replace('itemList-', '');
    Sortable.create(list, {
      animation: 150,
      onEnd: async (evt) => {
        const itemIDs = Array.from(list.children).map(item => item.dataset.id);
        await updateItemOrder(itemIDs, categoryName);
      }
    });
  });
};
const updateItemOrder = async (itemIDs, section) => {
  try {
    console.log("Sıralanan öğe ID'leri:", itemIDs, "Section:", section);

    const batch = writeBatch(db);
    itemIDs.forEach((id, index) => {
      if (!id) {
        console.error("Geçersiz ID bulundu:", id);
        return;
      }

      const itemRef = doc(db, section, id);
      batch.update(itemRef, { order: index });
    });

    await batch.commit();
    console.log("Sıralama güncellendi.");
  } catch (error) {
    console.error("Sıralama güncellenirken hata:", error);
  }
};

// Sayfa yüklendiğinde default içerik göster
window.onload = async function () {
  sectionConfig = await fetchSectionConfig();
  updateSidebarMenu();
  showContent(currentSection);
};
