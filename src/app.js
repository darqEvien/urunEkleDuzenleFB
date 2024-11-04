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
  { propertyName: "Home", section: "home" },
  { propertyName: "Kategoriler", section: "categories" },
  { propertyName: "Siparişler", section: "orders" },
];

// Update sidebar menu
const updateSidebarMenu = async () => {
  const sidebar = document.getElementById("sidebar");
  let sidebarHTML = "";

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
  const mainCategories = categories.filter(cat => !cat.parentCategory);
  
  for (let category of mainCategories) {
    sidebarHTML += `
      <h2 onclick="showContent('${category.propertyName}')" class="sidebar-item">
        <span>${category.title}</span>
      </h2>
    `;
  }

  sidebar.innerHTML = sidebarHTML;
};

// Show category form
window.showCategoryForm = async function (edit = false) {
  const formOverlay = document.getElementById("formOverlay");
  const formContainer = document.getElementById("formContainer");

  // Fetch categories for the dropdown
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
    <div class="radioButtons" style="display:inline-flex; justify-content:center;">
      <input type="radio" id="singleSelect" value="singleSelect" name="select">
      <label for="singleSelect">Tekli Seçim</label><br>
      <input type="radio" id="multiSelect" value="multiSelect" name="select">
      <label for="multiSelect">Çoklu Seçim</label><br>
    </div>
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

// Submit category
window.submitCategory = async function () {
  const categoryTitle = document.getElementById("categoryTitle").value;
  const propertyName = document.getElementById("propertyName").value;
  const parentCategory = document.getElementById("parentCategory").value;
  const selectValue = document.querySelector(
    `input[name="select"]:checked`
  ).value;

  if (!categoryTitle || !propertyName) {
    alert("Tüm alanları doldurun!");
    return;
  }

  try {
    let categoryId;

    if (currentItem) {
      categoryId = currentItem;
    } else {
      categoryId = await updateID();
    }
    const collectionRef = collection(db, "categories");
    const querySnapshot = await getDocs(collectionRef);
    const orderValue = querySnapshot.size + 1;
    await setDoc(
      doc(db, "categories", categoryId),
      {
        title: categoryTitle,
        propertyName: propertyName,
        parentCategory: parentCategory,
        select: selectValue,
        order: orderValue,
      },
      { merge: true }
    );

    closeForm();
    fetchItems("categories");
    currentItem = null;
  } catch (error) {
    console.error("Error submitting category:", error);
  }
};

// Fetch and render items
const fetchItems = async (section) => {
  let itemListHTML = "";

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
        return `
         <div class="item-box" data-id="${doc.id}">
          <h3>${category.title}</h3>
          <p>Kısaltma Adı: ${category.propertyName}</p>
          <p>Seçme: ${category.select}</p>
          <p>Ana Kategori: ${
            parentCategory !== "" ? parentCategory : "Ana Kategori"
          }</p>
          <button onclick="editCategory('${doc.id}')">Edit</button>
          <button onclick="confirmDeleteCategory('${
            doc.id
          }')" class="delete-btn">Delete</button>
        </div>
      `;
      })
      .join("");
  } else {
    // Normal section için ürünleri getir
    const qe = query(collection(db, section), orderBy("order"));
    const querySnapshot = await getDocs(qe);
    itemListHTML = querySnapshot.docs
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
          <p>Açıklama: ${item.description}</p>
          <p>Tag: ${Array.isArray(item.tag) ? item.tag.join(", ") : item.tag}</p>
          <button onclick="editItem('${doc.id}')">Edit</button>
          <button onclick="confirmDelete('${doc.id}')" class="delete-btn">Delete</button>
        </div>
      `;
      })
      .join("");

    // Alt kategorileri getir
    const categories = await fetchCategoriesForDropdown();
    const subCategories = categories.filter(cat => cat.parentCategory === section);
    const mainContent = document.getElementById("mainContent");
    
    

    if (subCategories.length > 0) {
      
      const subCatItemListHTML = document.createElement("div");
      subCatItemListHTML.classList.add("sortable-list"); 
      subCatItemListHTML.setAttribute("id","itemList")
      document.getElementById("mainContent").appendChild(subCatItemListHTML);
      for (const subCat of subCategories) {
        subCatItemListHTML.innerHTML += `
        <hr style="margin: 20px 0;">
          <div class="item-box">
            <h3>${subCat.title}</h3>
            <button onclick="showSubCategoryForm('${subCat.propertyName}')">
              ${subCat.title}'ye Ürün Ekle
            </button>
            <div id="subCategory-${subCat.propertyName}" class="sub-category-items">
              ${await fetchSubCategoryItems(subCat.propertyName)}
            </div>
          </div>
        `;
      }
    }
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
          <div class="item-box " data-id="${doc.id}">
            <h3>${item.name || "Unnamed Item"}</h3>
            <div class="image-container">
              <img src="${item.imageUrl}" alt="${item.name}" class="item-image"/>
            </div>
            <p>Fiyat: ${item.price}</p>
            <p>Boyut: ${item.size}</p>
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

// Alt kategori için ürün ekleme formunu göster
window.showSubCategoryForm = function(subCategoryName) {
  currentSection = subCategoryName; // Geçerli section'ı alt kategori olarak ayarla
  showForm(false); // Normal ürün formunu göster
};

// Alt kategori ürününü düzenleme
window.editSubCategoryItem = function(itemId, subCategoryName) {
  currentSection = subCategoryName;
  editItem(itemId);
};

// Alt kategori ürününü silme
window.confirmDeleteSubCategoryItem = function(itemId, subCategoryName) {
  if (confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
    deleteSubCategoryItem(itemId, subCategoryName);
  }
};

async function deleteSubCategoryItem(itemId, subCategoryName) {
  try {
    await deleteDoc(doc(db, subCategoryName, itemId));
    fetchItems(currentSection); // Ana kategoriyi yenile
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
window.showForm = async function (edit = false) {
  updateID(); // ID'yi güncelle
  const formOverlay = document.getElementById("formOverlay");
  const formContainer = document.getElementById("formContainer");

  formContainer.innerHTML = `
    <h2 id="formTitle">${edit ? "Düzenle" : "Ekle"} Ürün</h2>
    <input type="text" id="name" placeholder="Ürün Adı" required>
    <input type="number" id="price" required placeholder="Fiyat">
    <input type="text" id="size" required placeholder="Boyut">
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
          document.getElementById("size").value = item.size || "";
          document.getElementById("description").value = item.description || "";
          document.getElementById("tag").value = item.tag || "";
          document
            .getElementById("imageFile")
            .setAttribute("data-existing-url", item.imageUrl || "");
        }
      } catch (error) {
        console.error("Ürün yüklenirken hata:", error);
      }
    }, 200); // 200ms bekleme süresi
  } else {
    clearFormFields(); // Formu temizle
  }
};

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
      const sizeField = document.getElementById("size");
      const descField = document.getElementById("description");
      const tagField = document.getElementById("tag");
      const imageFileField = document.getElementById("imageFile");

      if (
        !nameField ||
        !priceField ||
        !sizeField ||
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
      sizeField.value = item.size || "";
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
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("size").value = "";
  document.getElementById("tag").value = "";
  document.getElementById("imageFile").value = ""; // File input'u temizle
}

// Dinamik ID oluşturma
window.updateID = async function () {
  try {
    const collectionRef = collection(db, currentSection);
    const querySnapshot = await getDocs(collectionRef);
    return `${currentSection}-${querySnapshot.size + 1}`;
  } catch (error) {
    console.error("Error fetching items for ID update:", error);
  }
};

// Ürün gönderme fonksiyonu
window.submitItem = async function () {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const size = document.getElementById("size").value;
  const description = document.getElementById("description").value; // Açıklamayı al
  const tag = document
    .getElementById("tag")
    .value.split(",")
    .map((t) => t.trim());
  // Tagleri dizi olarak al
  const imageFile = document.getElementById("imageFile").files[0];

  if (!name || !price || !size || !description) {
    alert("Lütfen ürün adı, fiyat ve boyut alanlarını doldurun!");
    return;
  }

  try {
    let itemID;
    let imageUrl = "";

    // Eğer düzenleme modundaysak, mevcut item ID'yi kullan
    if (currentItem) {
      itemID = currentItem;
    } else {
      // Yeni ürün ekleme modundaysak, yeni bir ID oluştur
      itemID = await updateID();
    }
    const collectionRef = collection(db, currentSection);
    const querySnapshot = await getDocs(collectionRef);
    const orderValue = querySnapshot.size + 1; //

    // Resim yükleme işlemi
    if (imageFile) {
      const storageRef = ref(storage, `images/${itemID}`);
      await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(storageRef);
    } else if (
      document.getElementById("imageFile").hasAttribute("data-existing-url")
    ) {
      imageUrl = document
        .getElementById("imageFile")
        .getAttribute("data-existing-url");
    }

    // Firestore'daki veriyi güncelleme veya ekleme
    await setDoc(
      doc(db, currentSection, itemID),
      {
        name,
        price,
        size,
        description,
        tag, // Tag alanını dizi olarak kaydet
        imageUrl,
        order: orderValue,
      },
      { merge: true }
    );

    closeForm();
    fetchItems(currentSection);
    currentItem = null;
  } catch (error) {
    console.error("Ürün kaydedilirken hata:", error);
  }
};

// Formu kapatma fonksiyonu
window.closeForm = function () {
  const formOverlay = document.getElementById("formOverlay");
  formOverlay.style.display = "none";
};

// Kategoriyi düzenleme fonksiyonu
// Kategori düzenleme fonksiyonu
window.editCategory = async function (categoryId) {
  try {
    // Öncelikle Firestore'daki kategoriyi alıyoruz
    const docRef = doc(db, "categories", categoryId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const category = docSnap.data();

      // Kategori formunu açmadan önce currentItem'ı set ediyoruz
      currentItem = categoryId;

      // Formu düzenleme modunda açıyoruz
      await showCategoryForm(true); // showCategoryForm'un Promise döndürdüğünden emin olun

      // Form elemanlarının yüklenmesini bekleyin
      await new Promise(resolve => {
        const checkElements = () => {
          const titleInput = document.getElementById("categoryTitle");
          const propertyInput = document.getElementById("propertyName");
          const singleSelect = document.getElementById("singleSelect");
          const multiSelect = document.getElementById("multiSelect");
          const parentSelect = document.getElementById("parentCategory");

          if (titleInput && propertyInput && singleSelect && multiSelect && parentSelect) {
            resolve();
          } else {
            setTimeout(checkElements, 100);
          }
        };
        checkElements();
      });

      // Form elemanları hazır olduğunda verileri yerleştir
      document.getElementById("categoryTitle").value = category.title || "";
      document.getElementById("propertyName").value = category.propertyName || "";

      // Seçim alanını doldur
      if (category.select === "singleSelect") {
        document.getElementById("singleSelect").checked = true;
      } else if (category.select === "multiSelect") {
        document.getElementById("multiSelect").checked = true;
      }

      // Ana kategori seçimi
      const parentCategorySelect = document.getElementById("parentCategory");
      parentCategorySelect.value = category.parentCategory || "";

    } else {
      console.error("Kategori bulunamadı!");
    }
  } catch (error) {
    console.error("Kategori düzenleme hatası:", error);
  }
};

// Kategori silme onayı
window.confirmDeleteCategory = function (categoryId) {
  if (confirm("Bu kategoriyi silmek istediğinizden emin misiniz?")) {
    deleteCategory(categoryId);
  }
};

// Kategori silme fonksiyonu
async function deleteCategory(categoryId) {
  try {
    await deleteDoc(doc(db, "categories", categoryId));
    fetchItems("categories"); // Kategorileri güncelle
  } catch (error) {
    console.error("Hata:", error);
  }
}

// Ürün düzenleme fonksiyonu
const initSortable = () => {
  const itemList = document.getElementById("itemList");

  Sortable.create(itemList, {
    animation: 150,
    onEnd: async (evt) => {
      const itemIDs = Array.from(itemList.children).map(
        (item) => item.dataset.id
      );
      await updateItemOrder(itemIDs);
    },
  });
};

const updateItemOrder = async (itemIDs) => {
  try {
    // Hangi öğelerin sıralandığını kontrol et
    console.log("Sıralanan öğe ID'leri:", itemIDs);

    const batch = writeBatch(db);
    itemIDs.forEach((id, index) => {
      if (!id) {
        console.error("Geçersiz ID bulundu:", id);
        return; // Geçersiz ID varsa işlemi atla
      }

      const itemRef = doc(db, currentSection, id); // currentSection'ın geçerli olduğundan emin olun
      batch.update(itemRef, { order: index }); // Yeni sıralama bilgisi
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
