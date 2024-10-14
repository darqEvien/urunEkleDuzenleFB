
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
let sectionConfig = {};

// Dinamik sectionConfig oluşturma
async function fetchSectionConfig() {
  try {
    const categoriesSnapshot = await getDocs(collection(db, "categories"));
    const config = {};

    categoriesSnapshot.forEach((doc) => {
      const category = doc.data();
      config[category.propertyName] = { title: category.title };
    });

    return config;
  } catch (error) {
    console.error("Error fetching section config:", error);
    return {}; // Hata olursa boş obje döndür
  }
}

// Sidebar menüsünü güncelleyen fonksiyon
const updateSidebarMenu = () => {
  const sidebar = document.getElementById("sidebar");
  let sidebarHTML = "";

  // Varsayılan menü öğeleri
  const defaultSections = [
    { propertyName: "Home", section: "home" },
    { propertyName: "Kategoriler", section: "categories" },
    { propertyName: "Siparişler", section: "orders" },
  ];

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
  const sectionHeader = document.getElementById("sectionHeader");
  const addItemBtn = document.getElementById("addItemBtn");

  if (sectionConfig[section]) {
    sectionHeader.textContent = sectionConfig[section].title || "Section";
  } else {
    sectionHeader.textContent = "Section";
  }

  if (section === "orders") {
    addItemBtn.style.display = "none";
  } else {
    addItemBtn.style.display = "block";
    addItemBtn.innerText = section === "categories" ? "Kategori Ekle" : "Ürün Ekle";
    addItemBtn.onclick = section === "categories" ? showCategoryForm : showForm;
  }
};

// Dinamik ID oluşturma
const generateID = async () => {
  try {
    const collectionRef = collection(db, currentSection);
    const querySnapshot = await getDocs(collectionRef);
    return `${currentSection}-${querySnapshot.size + 1}`;
  } catch (error) {
    console.error("Error generating ID:", error);
  }
};

// Genel optimizasyonlarla devam edilecek... 
