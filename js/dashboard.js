import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { app } from "../firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const grid = document.getElementById("building-grid");
const CLOUD_NAME = "sw7w7hc1";
const UPLOAD_PRESET = "wgpse5lr";
let buildings = [];
let facilityTags = [];
let pendingDeleteId = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  loadBuildings();
});

async function loadBuildings() {
  try {
    const snapshot = await getDocs(collection(db, "buildings"));
    buildings = snapshot.docs
      .map((buildingDoc) => normalizeBuilding(buildingDoc.id, buildingDoc.data()))
      .sort((a, b) => buildingIdValue(a.id) - buildingIdValue(b.id));
    renderBuildings();
  } catch (error) {
    console.error("Error loading buildings:", error);
    grid.innerHTML = '<div class="empty-state"><p>Could not load buildings from Firebase. Check Firestore permissions.</p></div>';
  }
}

function normalizeBuilding(id, data) {
  const facilities = Array.isArray(data.facilities)
    ? data.facilities.map(String)
    : typeof data.facilities === "string"
      ? data.facilities.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  return {
    id,
    name: String(data.name || data.title || "Unnamed building"),
    description: String(data.description || ""),
      image: String(data.imageUrl || data.image || ""),
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    elevation: data.elevation ?? null,
    facilities,
    updatedAt: data.updatedAt || data.updated_at || data.createdAt || null,
  };
}

function renderBuildings() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  const visible = buildings.filter((building) => building.name.toLowerCase().includes(query));
  document.getElementById("stat-total").textContent = buildings.length;
  document.getElementById("stat-facilities").textContent =
    buildings.reduce((total, building) => total + building.facilities.length, 0);
  const latest = Math.max(...buildings.map((building) => dateValue(building.updatedAt)), 0);
  document.getElementById("stat-updated").textContent = latest ? new Date(latest).toLocaleDateString() : "-";

  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-building" style="font-size:28px;"></i><p>${buildings.length ? "No buildings match your search." : "No buildings found in Firebase."}</p></div>`;
    return;
  }
  grid.innerHTML = visible.map((building) => `
    <div class="building-card" data-id="${escapeHtml(building.id)}">
      <div class="building-thumb"><div class="pin-badge">B${building.id}</div>
        ${building.image ? `<img src="${escapeHtml(building.image)}" alt="${escapeHtml(building.name)}">` : '<i class="ti ti-photo"></i>'}
      </div>
      <div class="building-body"><h3>${escapeHtml(building.name)}</h3>
        <p class="desc">${escapeHtml(building.description || "No description yet.")}</p>
        <div class="chip-row">${building.facilities.slice(0, 3).map((facility) => `<span class="chip">${escapeHtml(facility)}</span>`).join("")}</div>
        <div class="card-actions">
          <button class="icon-btn" data-action="view" title="View"><i class="ti ti-eye"></i></button>
          <button class="icon-btn" data-action="edit" title="Edit"><i class="ti ti-edit"></i></button>
          <button class="icon-btn danger" data-action="delete" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    </div>`).join("");
}

function bindEvents() {
  document.getElementById("search-input").addEventListener("input", renderBuildings);
  document.getElementById("building-grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const building = buildings.find((item) => item.id === button.closest(".building-card").dataset.id);
    if (button.dataset.action === "view") openViewDrawer(building);
    if (button.dataset.action === "edit") openFormDrawer(building);
    if (button.dataset.action === "delete") openDeleteModal(building);
  });
  document.getElementById("add-building-btn").addEventListener("click", () => openFormDrawer(null));
  document.getElementById("form-drawer-close").addEventListener("click", closeFormDrawer);
  document.getElementById("form-cancel-btn").addEventListener("click", closeFormDrawer);
  document.getElementById("view-drawer-close").addEventListener("click", closeViewDrawer);
  document.getElementById("image-input").addEventListener("change", handleImagePreview);
  document.getElementById("facility-add-btn").addEventListener("click", addFacility);
  document.getElementById("facility-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addFacility(); }
  });
  document.getElementById("building-form").addEventListener("submit", saveBuilding);
  document.getElementById("delete-cancel-btn").addEventListener("click", closeDeleteModal);
  document.getElementById("delete-confirm-btn").addEventListener("click", deleteBuilding);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("mobile-logout-btn").addEventListener("click", logout);
}

function openFormDrawer(building) {
  document.getElementById("building-form").reset();
  document.getElementById("building-id").value = building ? building.id : "";
  document.getElementById("form-drawer-title").textContent = building ? "Edit building" : "Add building";
  document.getElementById("building-name").value = building?.name || "";
  document.getElementById("building-description").value = building?.description || "";
  document.getElementById("building-latitude").value = building?.latitude ?? "";
  document.getElementById("building-longitude").value = building?.longitude ?? "";
  document.getElementById("building-elevation").value = building?.elevation ?? "";
  facilityTags = [...(building?.facilities || [])];
  renderFacilities();
  const preview = document.getElementById("image-preview");
  preview.classList.toggle("hidden", !building?.image);
  preview.src = building?.image || "";
  document.getElementById("image-drop-label").classList.toggle("hidden", !!building?.image);
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("form-drawer-overlay").classList.remove("hidden");
}

function closeFormDrawer() { document.getElementById("form-drawer-overlay").classList.add("hidden"); }
function handleImagePreview(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById("image-preview").src = URL.createObjectURL(file);
  document.getElementById("image-preview").classList.remove("hidden");
  document.getElementById("image-drop-label").classList.add("hidden");
}
function addFacility() {
  const input = document.getElementById("facility-input");
  const value = input.value.trim();
  if (value && !facilityTags.includes(value)) facilityTags.push(value);
  input.value = "";
  renderFacilities();
}
function renderFacilities() {
  document.getElementById("facility-chip-row").innerHTML = facilityTags.map((facility) =>
    `<span class="facility-chip">${escapeHtml(facility)}<button type="button" data-facility="${escapeAttr(facility)}"><i class="ti ti-x"></i></button></span>`).join("");
  document.querySelectorAll("[data-facility]").forEach((button) => button.addEventListener("click", () => {
    facilityTags = facilityTags.filter((facility) => facility !== button.dataset.facility);
    renderFacilities();
  }));
}

async function saveBuilding(event) {
  event.preventDefault();
  const saveButton = document.getElementById("form-save-btn");
  const errorBox = document.getElementById("form-error");
  saveButton.disabled = true;
  errorBox.classList.add("hidden");
  try {
    const id = document.getElementById("building-id").value;
    const data = {
      name: document.getElementById("building-name").value.trim(),
      description: document.getElementById("building-description").value.trim(),
      latitude: numberOrNull("building-latitude"),
      longitude: numberOrNull("building-longitude"),
      elevation: numberOrNull("building-elevation"),
      facilities: facilityTags,
      updatedAt: serverTimestamp(),
    };
    const file = document.getElementById("image-input").files[0];
    if (file) data.imageUrl = await uploadImageToCloudinary(file);
    if (id) {
      await setDoc(doc(db, "buildings", id), data, { merge: true });
    } else {
      const nextId = getNextBuildingId();
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, "buildings", String(nextId)), data);
    }
    closeFormDrawer();
    await loadBuildings();
  } catch (error) {
    console.error("Error saving building:", error);
    errorBox.textContent = error.message || "Could not save building to Firebase.";
    errorBox.classList.remove("hidden");
  } finally { saveButton.disabled = false; }
}

function openViewDrawer(building) {
  document.getElementById("view-drawer-title").textContent = building.name;
  const image = document.getElementById("view-image");
  image.src = building.image || "";
  image.classList.toggle("hidden", !building.image);
  document.getElementById("view-description").textContent = building.description || "No description yet.";
  document.getElementById("view-coords").textContent = [building.latitude != null && `Coordinates: ${building.latitude}, ${building.longitude}`, building.elevation != null && `Elevation: ${building.elevation} m`].filter(Boolean).join(" | ");
  document.getElementById("view-facilities").innerHTML = building.facilities.map((facility) => `<span class="chip">${escapeHtml(facility)}</span>`).join("");
  document.getElementById("view-drawer-overlay").classList.remove("hidden");
}
function closeViewDrawer() { document.getElementById("view-drawer-overlay").classList.add("hidden"); }
function openDeleteModal(building) {
  pendingDeleteId = building.id;
  document.getElementById("delete-modal-text").textContent = `"${building.name}" will be removed from the AR navigation app and can't be undone.`;
  document.getElementById("delete-modal-overlay").classList.remove("hidden");
}
function closeDeleteModal() { pendingDeleteId = null; document.getElementById("delete-modal-overlay").classList.add("hidden"); }
async function deleteBuilding() {
  if (!pendingDeleteId) return;
  try { await deleteDoc(doc(db, "buildings", pendingDeleteId)); await loadBuildings(); }
  catch (error) { console.error("Error deleting building:", error); }
  closeDeleteModal();
}
async function logout() { await signOut(auth); window.location.href = "login.html"; }
function numberOrNull(id) { const value = document.getElementById(id).value; return value === "" ? null : Number(value); }
async function uploadImageToCloudinary(file) {
  if (CLOUD_NAME === "your_actual_cloud_name" || UPLOAD_PRESET === "my_app_preset") {
    throw new Error("Configure Cloudinary CLOUD_NAME and UPLOAD_PRESET before uploading images.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Cloudinary upload failed.");
  return data.secure_url;
}
function getNextBuildingId() {
  const numericIds = buildings
    .map((building) => Number(building.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  return (numericIds.length ? Math.max(...numericIds) : 0) + 1;
}
function buildingIdValue(id) {
  const numericId = Number(id);
  return Number.isInteger(numericId) ? numericId : Number.MAX_SAFE_INTEGER;
}
function dateValue(value) { return value?.toDate ? value.toDate().getTime() : value?.seconds ? value.seconds * 1000 : new Date(value || 0).getTime() || 0; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function escapeAttr(value) { return escapeHtml(value); }

bindEvents();
