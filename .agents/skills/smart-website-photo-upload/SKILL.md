---
name: smart-website-photo-upload
description: Workflow for adding image upload capabilities to admin sections in SMART-Website.
---

# SMART-Website: Adding Photo Uploads to Admin Sections

Pattern for adding image upload functionality backed by `multer` + `lib/blobStorage.js`:

## 1. Backend (`server.js`)

```javascript
// 1. Default schema includes photo field (empty string = fallback image)
const DEFAULT_SECTION = { ..., photoField: "" };

// 2. Upload endpoint using handlePhotoUpload and blobStorage
const VALID_SLOTS = ["photoField"];
app.post("/api/<section>/photo/:slot", requireApiAuth, handlePhotoUpload,
  asyncHandler(async (req, res) => {
    const { slot } = req.params;
    if (!VALID_SLOTS.includes(slot)) {
      return res.status(400).json({ error: "Unknown slot" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a photo." });
    }
    const filename = safeUploadName("<section>-" + slot, req.file.mimetype);
    const imageUrl = await blobStorage.saveUpload(req.file.buffer, "<section>", filename);
    const updated  = await db.updateOne("<section>", "<id>", { [slot]: imageUrl });
    res.json({ [slot]: imageUrl, ...updated });
  })
);
// Note: Multer middleware expects field name "photo": fd.append("photo", file)
```

## 2. Admin HTML (`admin/<section>.html`)

```html
<div class="form-field" id="field-photoField">
  <label>Section photo</label>
  <div style="display:flex;align-items:center;gap:12px;">
    <img id="preview-photoField" src="" style="width:72px;height:72px;object-fit:cover;display:none;">
    <input type="file" id="file-photoField" accept="image/*" style="flex:1;">
    <button type="button" class="btn btn-secondary btn-sm" onclick="uploadPhoto('photoField')">Upload</button>
  </div>
</div>
```

## 3. Admin JS (`admin/<section>.js`)

```javascript
async function uploadPhoto(slot) {
  const fileInput = document.getElementById("file-" + slot);
  if (!fileInput || !fileInput.files.length) {
    showToast("Please choose a photo first.", "danger");
    return;
  }
  const fd = new FormData();
  fd.append("photo", fileInput.files[0]);

  const res = await fetch(`/api/<section>/photo/${slot}`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || "Upload failed", "danger");
    return;
  }
  const data = await res.json();
  const img = document.getElementById("preview-" + slot);
  if (img) {
    img.src = data[slot];
    img.style.display = "block";
  }
  fileInput.value = "";
  showToast("Photo updated successfully");
}
```

## 4. Public HTML & JS Hydration

In the public HTML page:
```html
<img src="img/fallback.jpg" alt="..." data-about-img="photoField">
```

In the hydration script (`script.js`):
```javascript
function applyPhotos(data) {
  document.querySelectorAll("[data-about-img]").forEach(img => {
    const url = data[img.getAttribute("data-about-img")];
    if (url) img.src = url; // Only override if custom photo is present
  });
}
```
