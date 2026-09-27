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
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
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
    destination_type: String(data.destination_type || "building"),
    building_node_id: String(data.building_node_id || ""),
    description: String(data.description || ""),
      image: String(data.imageUrl || data.image || ""),
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
  document.getElementById("change-password-btn").addEventListener("click", openPasswordModal);
  document.getElementById("mobile-password-btn").addEventListener("click", openPasswordModal);
  document.getElementById("password-cancel-btn").addEventListener("click", closePasswordModal);
  document.getElementById("password-form").addEventListener("submit", changePassword);
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("mobile-logout-btn").addEventListener("click", logout);
}

function openFormDrawer(building) {
  document.getElementById("building-form").reset();
  document.getElementById("building-id").value = building ? building.id : "";
  document.getElementById("form-drawer-title").textContent = building ? "Edit building" : "Add building";
  document.getElementById("building-name").value = building?.name || "";
  document.getElementById("destination-type").value = building?.destination_type || "building";
  document.getElementById("building-node-id").value = building?.building_node_id || "";
  document.getElementById("building-description").value = building?.description || "";
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
      destination_type: document.getElementById("destination-type").value,
      building_node_id: document.getElementById("building-node-id").value.trim(),
      description: document.getElementById("building-description").value.trim(),
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
function openPasswordModal() {
  document.getElementById("password-form").reset();
  document.getElementById("password-error").classList.add("hidden");
  document.getElementById("password-modal-overlay").classList.remove("hidden");
  document.getElementById("current-password").focus();
}
function closePasswordModal() {
  document.getElementById("password-modal-overlay").classList.add("hidden");
}
function togglePasswordVisibility(button) {
  const input = document.getElementById(button.dataset.passwordTarget);
  const isVisible = input.type === "text";
  input.type = isVisible ? "password" : "text";
  button.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
  button.title = `${isVisible ? "Show" : "Hide"} password`;
  button.innerHTML = `<i class="ti ti-eye${isVisible ? "" : "-off"}"></i>`;
}
async function changePassword(event) {
  event.preventDefault();
  const user = auth.currentUser;
  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const errorBox = document.getElementById("password-error");
  const saveButton = document.getElementById("password-save-btn");

  errorBox.classList.add("hidden");
  if (newPassword !== confirmPassword) {
    errorBox.textContent = "New passwords do not match.";
    errorBox.classList.remove("hidden");
    return;
  }
  if (!user?.email) {
    errorBox.textContent = "Your account does not support password changes.";
    errorBox.classList.remove("hidden");
    return;
  }

  saveButton.disabled = true;
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    closePasswordModal();
    showToast("Password updated successfully.");
  } catch (error) {
    console.error("Error changing password:", error);
    errorBox.textContent = passwordErrorMessage(error);
    errorBox.classList.remove("hidden");
  } finally {
    saveButton.disabled = false;
  }
}
function passwordErrorMessage(error) {
  if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
    return "Current password is incorrect.";
  }
  if (error.code === "auth/weak-password") return "New password must be at least 6 characters.";
  if (error.code === "auth/requires-recent-login") return "Please log in again before changing your password.";
  return error.message || "Could not change your password.";
}
async function logout() { await signOut(auth); window.location.href = "login.html"; }
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
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

bindEvents();
