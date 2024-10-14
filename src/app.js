import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getFirestore,
  collection,
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

// Dinamik sectionConfig oluşturma
async function fetchSectionConfig() {
  try {
    const categoriesSnapshot = await getDocs(collection(db, "categories"));
    const config = {};

    categoriesSnapshot.forEach((doc) => {
      const category = doc.data();
      config[category.propertyName] = { title: category.title };
    });

    console.log("Section Config:", config);
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
window.confirmDelete = async function (itemID) {
  const confirmed = confirm("Bu ürünü silmek istediğinize emin misiniz?");
  if (confirmed) {
    await deleteItem(itemID);
  }
};

// Ürün veya kategori düzenleme fonksiyonu

// Ürün silme
const deleteItem = async (itemID) => {
  try {
    await deleteDoc(doc(db, currentSection, itemID)); // Firestore'dan sil
    fetchItems(currentSection); // Ürün listesini güncelle
  } catch (error) {
    console.error("Ürün silme hatası:", error);
  }
};
// Sidebar menüsünü güncelleyen fonksiyon
const updateSidebarMenu = () => {
  const sidebar = document.getElementById("sidebar");
  let sidebarHTML = "";

  // Varsayılan menü öğelerini ekle
  sidebarHTML += defaultSections
    .map(
      (item) => `
    <h2 onclick="showContent('${item.section}')" class="sidebar-item">
      <span>${item.propertyName}</span>
    </h2>
  `
    )
    .join("");

  // Dinamik menü öğelerini ekle (varsayılanları hariç tutarak)
  for (let key in sectionConfig) {
    if (!defaultSections.some((item) => item.section === key)) {
      sidebarHTML += `
        <h2 onclick="showContent('${key}')" class="sidebar-item">
          <span>${sectionConfig[key].title}</span>
        </h2>
      `;
    }
  }

  sidebar.innerHTML = sidebarHTML;
};

// Update section header and button visibility
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
    const categoriesSnapshot = await getDocs(collection(db, "categories"));
    itemListHTML = categoriesSnapshot.docs
      .map((doc) => {
        const category = doc.data();
        return `
        <div class="item-box">
          <h3>${category.title}</h3>
          <p>Kısaltma Adı: ${category.propertyName}</p>
          <p>Seçme: ${category.select.value}</p>
          <button onclick="editCategory('${doc.id}')">Edit</button>
          <button onclick="confirmDeleteCategory('${doc.id}')" class="delete-btn">Delete</button>
        </div>
      `;
      })
      .join("");
  } else {
    const querySnapshot = await getDocs(collection(db, section));
    itemListHTML = querySnapshot.docs
      .map((doc) => {
        const item = doc.data();
        return `
        <div class="item-box">
          <h3>${item.name || "Unnamed Item"}</h3>
          <div class="image-container">
            <img src="${item.imageUrl}" alt="${item.name}" class="item-image"/>
          </div>
          <p>Fiyat: ${item.price}</p>
          <p>Boyut: ${item.size}</p>
          <p>Tag: ${item.tag}</p>
          <button onclick="editItem('${doc.id}')">Edit</button>
          <button onclick="confirmDelete('${
            doc.id
          }')" class="delete-btn">Delete</button>
        </div>
      `;
      })
      .join("");
  }

  document.getElementById("itemList").innerHTML = itemListHTML;
};

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
    <input type="text" id="tag" required placeholder="Etiket">
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
      const tagField = document.getElementById("tag");
      const imageFileField = document.getElementById("imageFile");

      if (
        !nameField ||
        !priceField ||
        !sizeField ||
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

window.submitItem = async function () {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const size = document.getElementById("size").value;
  const tag = document.getElementById("tag").value;
  const imageFile = document.getElementById("imageFile").files[0];

  if (!name || !price || !size || !tag) {
    alert("Tüm alanları doldurun!");
    return;
  }

  try {
    let itemID;
    let imageUrl = "";

    // Eğer düzenleme modundaysak, mevcut item ID'yi kullan
    if (currentItem) {
      itemID = currentItem; // Mevcut ürünü güncellemek için ID'yi kullanıyoruz
    } else {
      // Yeni ürün ekleme modundaysak, yeni bir ID oluştur
      itemID = await updateID();
    }

    // Eğer yeni bir resim yüklenmişse, resmi depolamaya yükleyip URL'yi al
    if (imageFile) {
      const storageRef = ref(storage, `images/${itemID}`);
      await uploadBytes(storageRef, imageFile);
      imageUrl = await getDownloadURL(storageRef);
    } else if (
      document.getElementById("imageFile").hasAttribute("data-existing-url")
    ) {
      // Eğer düzenleme modundaysak ve resim güncellenmediyse, eski URL'yi kullan
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
        tag,
        imageUrl,
      },
      { merge: true }
    ); // 'merge: true' ile mevcut alanları güncelliyoruz

    // Formu kapat ve içeriği güncelle
    closeForm();
    fetchItems(currentSection);
    currentItem = null; // Düzenleme işlemi bittikten sonra currentItem'ı sıfırla
  } catch (error) {
    console.error("Ürün kaydedilirken hata:", error);
  }
};

// Formu kapatma fonksiyonu
window.closeForm = function () {
  const formOverlay = document.getElementById("formOverlay");
  formOverlay.style.display = "none";
};

// Kategori formunu gösterme
window.showCategoryForm = function (edit = false) {
  const formOverlay = document.getElementById("formOverlay");
  const formContainer = document.getElementById("formContainer");

  formContainer.innerHTML = `
    <h2 id="formTitle">${edit ? "Düzenle" : "Ekle"} Kategori</h2>
    <input type="text" id="categoryTitle" placeholder="Kategori Başlığı" required>
    <input type="text" id="propertyName" placeholder="Property Name" required>
    <div class="radioButtons">
    <input type="radio" id="singleSelect" value="singleSelect" name="select">
    <label for="singleSelect">Tekli Seçim</label><br>
    <input type="radio" id="multiSelect" value="multiSelect" name="select">
    <label for="multiSelect">Çoklu Seçim</label><br>
    </div>
    <button onclick="submitCategory()">Kaydet</button>
    <button onclick="closeForm()">İptal</button>
  `;
  formOverlay.style.display = "flex";
};

// Kategori gönderme fonksiyonu
// Kategori gönderme fonksiyonu
window.submitCategory = async function () {
  const categoryTitle = document.getElementById("categoryTitle").value;
  const propertyName = document.getElementById("propertyName").value;
  const selectValue = document.querySelector(`input[name="select"]:checked`).value;

  if (!categoryTitle || !propertyName) {
    alert("Tüm alanları doldurun!");
    return;
  }

  try {
    let categoryId;

    // Eğer mevcut bir kategori düzenleniyorsa, ID'yi kullanıyoruz
    if (currentItem) {
      categoryId = currentItem;
    } else {
      // Yeni bir kategori ekliyorsak, yeni ID oluştur
      categoryId = await updateID();
    }

    // Kategoriyi güncelle veya ekle
    await setDoc(
      doc(db, "categories", categoryId),
      {
        title: categoryTitle,
        propertyName: propertyName,
        select: selectValue,
      },
      { merge: true }
    ); // Mevcut kategori varsa güncelle, yeni alanları ekle

    closeForm();
    fetchItems("categories"); // Kategorileri güncelle
    currentItem = null; // Düzenleme tamamlandıktan sonra currentItem'ı sıfırla
  } catch (error) {
    console.error("Hata:", error);
  }
};

// Kategoriyi düzenleme fonksiyonu
// Kategoriyi düzenleme fonksiyonu
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
      showCategoryForm(true);

      // Form açıldıktan sonra DOM'daki alanlara verileri yerleştiriyoruz
      setTimeout(() => {
        document.getElementById("categoryTitle").value = category.title || "";
        document.getElementById("propertyName").value =
          category.propertyName || "";
          // document.getElementById("selectValue").value = category.select || "";
      }, 0); // Bu gecikme, formun tamamen yüklenmesini sağlar.
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

// Sayfa yüklendiğinde default içerik göster
window.onload = async function () {
  sectionConfig = await fetchSectionConfig();
  updateSidebarMenu();
  showContent(currentSection);
};
