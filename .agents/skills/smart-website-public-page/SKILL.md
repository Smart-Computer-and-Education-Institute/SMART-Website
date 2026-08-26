---
name: smart-website-public-page
description: Guide for connecting static public HTML pages in SMART-Website to the dynamic backend API and admin panel.
---

# SMART-Website: Connecting Public Pages to Admin Backend

When converting static HTML cards or lists on public pages to dynamic API-driven content:

## 1. Replace Static HTML with a Dynamic Container

In the public HTML file (e.g. `Career.html`, `Services.html`):

```html
<!-- Replace static cards with a container and loading/empty states -->
<div class="items-grid" id="itemsGrid">
  <p id="itemsLoading">Loading…</p>
</div>
<div id="itemsEmpty" style="display:none">No items right now.</div>
```

## 2. Add Fetch and Render Logic to Public JS

In the corresponding client JS file (e.g. `career.js`):

```javascript
function fetchAndRenderItems() {
  const grid = document.getElementById('itemsGrid');
  const loading = document.getElementById('itemsLoading');
  const empty = document.getElementById('itemsEmpty');
  if (!grid) return;

  fetch('/api/public/<section>')
    .then(res => res.ok ? res.json() : [])
    .then(items => {
      const data = Array.isArray(items) ? items : [];
      if (loading) loading.remove();
      if (!data.length) {
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';
      data.forEach(item => grid.appendChild(buildCard(item)));
    })
    .catch(() => {
      if (loading) loading.textContent = 'Could not load items — please refresh.';
    });
}
```

## 3. Verify Server Endpoint Structure

- Public endpoint: `/api/public/<section>` (No auth middleware, filters to active/open/published records).
- Admin endpoint: `/api/<section>` (Protected with `requireApiAuth`, returns all records).
