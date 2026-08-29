/* ============================================
   Offers & Flyers — Public Page
   Fetches active offers from /api/public/offers
   and renders flyer cards on the board.
   ============================================ */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function nl2br(str) {
  return (str || "").replace(/\n/g, "<br>");
}


const tilts = ["-1.2deg", "0.8deg", "-0.6deg", "1.4deg", "-1deg", "1.1deg"];

async function loadPublicOffers() {
  const grid = document.getElementById("flyerGrid");
  const empty = document.getElementById("flyerEmpty");
  if (!grid) return;

  try {
    const res = await fetch("/api/public/offers");
    if (!res.ok) throw new Error("Could not load offers");
    const offers = await res.json();

    grid.innerHTML = "";

    if (!Array.isArray(offers) || offers.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";

    offers.forEach((offer, i) => {
      const tilt = tilts[i % tilts.length];
      const card = document.createElement("article");
      card.className = "flyer-card";
      card.style.setProperty("--tilt", tilt);

      const thumbHtml = offer.image
        ? `<div class="flyer-card__thumb" style="padding:0;overflow:hidden;">
             <img src="${escapeHtml(offer.image)}" alt="${escapeHtml(offer.title)}" style="width:100%;height:100%;object-fit:cover;display:block;">
           </div>`
        : `<div class="flyer-card__thumb">
             <div class="flyer-card__thumb-title">${escapeHtml(offer.title)}</div>
           </div>`;

      const ctaHref = offer.ctaLink || "Contact.html";
      const ctaText = offer.ctaLabel || "Learn more";

      card.innerHTML = `
        <span class="flyer-card__tag">${escapeHtml(offer.tag || "LIMITED TIME")}</span>
        ${thumbHtml}
        <h3 class="flyer-card__title">${escapeHtml(offer.title)}</h3>
        <p class="flyer-card__desc">${nl2br(escapeHtml(offer.description))}</p>
        <a href="${escapeHtml(ctaHref)}" class="flyer-card__cta">${escapeHtml(ctaText)} →</a>
      `;

      grid.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading public offers:", err);
    if (empty) {
      empty.innerHTML = "<p>Couldn't load offers right now — please try again later.</p>";
      empty.style.display = "block";
    }
  }
}

document.addEventListener("DOMContentLoaded", loadPublicOffers);
// Also call directly in case DOMContentLoaded already fired
if (document.readyState === "complete" || document.readyState === "interactive") {
  loadPublicOffers();
}
