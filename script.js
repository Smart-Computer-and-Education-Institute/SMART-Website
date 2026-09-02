// ============================================================
// Site navigation — hamburger menu + active link highlighting
// ============================================================
// Wrapped in a DOM-ready guard on purpose: this used to run
// immediately at the top of the file with no guard, so on any page
// where the header markup was missing, loaded late, or malformed
// (e.g. Contact.html used to include this very file twice), a crash
// here would silently stop every script below it from running too
// (contact form handling, course/service loading, testimonials, etc).
// readyState check (rather than a bare DOMContentLoaded listener)
// means this still runs correctly even if the script tag ends up
// loaded after the DOM is already parsed.
function onDomReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

onDomReady(() => {
  const hamBtn = document.getElementById("hamBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (hamBtn && mobileMenu) {
    const setMenuOpen = (open) => {
      hamBtn.classList.toggle("open", open);
      mobileMenu.classList.toggle("open", open);
      hamBtn.setAttribute("aria-expanded", String(open));
      // Stop the page scrolling behind the menu while it's open, so it
      // feels like a proper overlay instead of just pushing content down.
      document.body.style.overflow = open ? "hidden" : "";
    };

    hamBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenuOpen(!mobileMenu.classList.contains("open"));
    });

    // Click any mobile link → close the menu automatically.
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });

    // Click outside the menu, or press Escape → close it too.
    document.addEventListener("click", (e) => {
      if (!mobileMenu.classList.contains("open")) return;
      if (mobileMenu.contains(e.target) || hamBtn.contains(e.target)) return;
      setMenuOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    });
  }

  // Highlight the current page in both the desktop and mobile nav,
  // computed from the URL rather than relying on a hardcoded "active"
  // class in every page's HTML (which is exactly how pages like
  // Gallery.html ended up with the wrong link highlighted).
  const currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-links, .mobile-menu a").forEach((link) => {
    const linkPage = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
    link.classList.toggle("active", linkPage === currentPage);
  });
});

// ============================================================
// Site-wide contact info (address, phone, email, hours, WhatsApp,
// map) — pulled from Settings in the admin panel instead of being
// hardcoded on every page. Any element can opt in with a
// data-contact="..." attribute; add data-contact-multiline to render
// line breaks (used for the two-line address/hours on Contact.html).
// If the fetch fails for any reason, the static fallback text
// already sitting in the HTML is simply left alone.
// ============================================================
function escapeContactHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function applyContactSettings(settings) {
  document.querySelectorAll("[data-contact]").forEach((el) => {
    const field = el.getAttribute("data-contact");
    let value = settings[field];
    if (value === undefined || value === null) return;

    const multiline = el.hasAttribute("data-contact-multiline");

    if (el.tagName === "IFRAME") {
      if (value) el.src = value;
      return;
    }

    if (el.tagName === "A") {
      if (field === "whatsapp") {
        el.style.display = value ? "" : "none";
        if (value) el.href = value;
      } else if (field === "email") {
        el.href = "mailto:" + value;
        el.textContent = value;
      } else if (value) {
        // Generic link fields (e.g. mapDirectionsUrl): set href and show the element.
        el.href = value;
        el.style.display = "";
      }
      return;
    }

    if (field === "phones") {
      const items = (Array.isArray(value) ? value : [value]).filter(Boolean).map(escapeContactHtml);
      el.innerHTML = multiline ? items.join("<br>") : items.join(", ");
      return;
    }

    if (multiline) {
      el.innerHTML = escapeContactHtml(String(value)).replace(/\n/g, "<br>");
    } else {
      el.textContent = String(value).replace(/\n/g, ", ");
    }
  });
}

if (document.querySelector("[data-contact]")) {
  fetch("/api/public/settings")
    .then((res) => res.json())
    .then(applyContactSettings)
    .catch(() => {});
}

// ============================================================
// About Us page content — pulled from the "About Us" section
// of the admin panel. Any element opts in with data-about="fieldName".
// Multi-line fields (founderMessage) additionally carry
// data-about-multiline; the value is escape+nl2br'd so line breaks
// in the stored text become visible paragraph breaks on the page.
// Guarded so this does nothing on pages that have no [data-about] elements.
// ============================================================
function escapeAboutHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function applyAboutContent(data) {
  document.querySelectorAll("[data-about]").forEach((el) => {
    const field = el.getAttribute("data-about");
    const value = data[field];
    if (value === undefined || value === null) return;

    if (el.hasAttribute("data-about-multiline")) {
      // Render newlines as <br> tags inside the existing element so the
      // surrounding CSS (font, spacing) still applies. Each \n\n in the
      // stored text produces a double-break, visually separating paragraphs.
      el.innerHTML = escapeAboutHtml(String(value)).replace(/\n/g, "<br>");
    } else {
      el.textContent = String(value);
    }
  });
}

// Also swap [data-about-img] elements when a photo URL is stored in the about doc.
// Only overrides src if the stored URL is non-empty — keeps the hardcoded fallback
// image for any slot the admin hasn't uploaded to yet.
function applyAboutPhotos(data) {
  document.querySelectorAll("[data-about-img]").forEach((img) => {
    const field = img.getAttribute("data-about-img");
    if (data[field]) img.src = data[field];
  });
}

function applyCustomAboutSections(data) {
  const container = document.getElementById("customAboutSections");
  if (!container) return;

  const sections = Array.isArray(data.customSections) ? data.customSections : [];
  if (!sections.length) {
    container.innerHTML = "";
    return;
  }

  // Render each custom section using the same .about-grid styling
  container.innerHTML = sections
    .map((sec, idx) => {
      // Fixed section 4 ended on reverse, so custom section 0 is regular (text left, photo right), section 1 reverse, etc.
      const isReverse = idx % 2 === 1;
      const photoHtml = sec.photo
        ? `<div class="about-img"><img src="${escapeAboutHtml(sec.photo)}" alt="${escapeAboutHtml(sec.heading)}"></div>`
        : "";
      const textHtml = `
        <div class="about-text" style="${!sec.photo ? 'flex: 1; width: 100%; max-width: 100%;' : ''}">
          <h2>${escapeAboutHtml(sec.heading)}</h2>
          <p>${escapeAboutHtml(sec.text || "").replace(/\n/g, "<br>")}</p>
        </div>`;

      if (isReverse && sec.photo) {
        return `<div class="about-grid reverse" style="margin-top: 48px;">${photoHtml}${textHtml}</div>`;
      } else {
        return `<div class="about-grid" style="margin-top: 48px;">${textHtml}${photoHtml}</div>`;
      }
    })
    .join("");
}

if (document.querySelector("[data-about]") || document.querySelector("[data-about-img]") || document.getElementById("customAboutSections")) {
  fetch("/api/public/about")
    .then((res) => res.json())
    .then((data) => {
      applyAboutContent(data);
      applyAboutPhotos(data);
      applyCustomAboutSections(data);
    })
    .catch(() => {}); // silently fall back to hardcoded HTML if fetch fails
}

document.querySelectorAll("#year").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// JS for terminal..
const typedE1 = document.getElementById("typedText");

if (typedE1) {
  const phrases = [
    "Graphic Design.",
    "Digital Marketing.",
    "Tally Accounting.",
    "MS Office.",
    "A Career.",
  ];
  let phrasesIndex = 0,
    charIndex = 0,
    deleting = false;
  function typeLoop() {
    const current = phrases[phrasesIndex];
    if (!deleting) {
      charIndex++;
      typedE1.textContent = current.slice(0, charIndex);
      if (charIndex == current.length) {
        deleting = true;
        setTimeout(typeLoop, 1400);
        return;
      }
      setTimeout(typeLoop, 70);
    } else {
      charIndex--;
      typedE1.textContent = current.slice(0, charIndex);
      if (charIndex == 0) {
        deleting = false;
        phrasesIndex = (phrasesIndex + 1) % phrases.length;
        setTimeout(typeLoop, 300);
        return;
      }
      setTimeout(typeLoop, 35);
    }
  }
  typeLoop();
}

// Progress bar loading animation
// Animates .progress-fill from 0% up to whatever % is set in data-target
function animateProgressBar() {
  const bar = document.getElementById('progressFill');
  if (!bar) return;

  const target = parseInt(bar.getAttribute('data-target'), 10) || 0;
  let current = 0;

  const step = () => {
    current += 1;
    bar.style.width = current + '%';

    if (current < target) {
      requestAnimationFrame(() => setTimeout(step, 15)); // ~15ms per 1% tick
    }
  };

  requestAnimationFrame(step);
}

window.addEventListener('DOMContentLoaded', animateProgressBar);

// 5. Stats Count-Up Animation
const animateCount = (el) => {
  const target = parseInt(el.getAttribute("data-count"), 10);
  const duration = 1500; // ms
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const current = Math.floor(eased * target);

    el.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(step);
};

const statsStrip = document.querySelector(".stats-strip");

if (statsStrip) {
  const statsObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const numbersInView = entry.target.querySelectorAll(".stat-number");
          numbersInView.forEach((num) => animateCount(num));
          observer.unobserve(entry.target); // run only once
        }
      });
    },
    { threshold: 0.4 }
  );

  statsObserver.observe(statsStrip);
}

// 6. Public Notices Loader (Notice.html only)
// Fetches only published notices from the server and renders them.
// Guarded so this safely does nothing on pages without this element.
const publicNoticeList = document.getElementById("publicNoticeList");

if (publicNoticeList) {
  fetch("/api/public/notices")
    .then((res) => res.json())
    .then((notices) => {
      const empty = document.getElementById("publicNoticeEmpty");

      if (!notices.length) {
        empty.style.display = "block";
        return;
      }

      // Optional data-limit attribute: when present (e.g. on index.html preview
      // sections), only the first N records are rendered. Pages without the
      // attribute (Notice.html) keep showing everything — fully backward-compatible.
      const limitAttr = publicNoticeList.getAttribute("data-limit");
      const limit = limitAttr ? parseInt(limitAttr, 10) : Infinity;

      notices
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, limit)
        .forEach((n) => {
          const card = document.createElement("div");
          card.className = "notice-public-card";
          if (n.id) card.id = "notice-" + n.id;
          card.innerHTML = `
            <div class="notice-public-top">
              <h3>${escapeNoticeHtml(n.title)}</h3>
              <span class="notice-public-date">${formatNoticeDate(n.date)}</span>
            </div>
            <p>${nl2br(escapeNoticeHtml(n.content))}</p>
          `;
          publicNoticeList.appendChild(card);
        });

      // Handle anchor deep-linking (e.g. #notice-n12345) from Timeshift holiday popup
      if (window.location.hash) {
        const hashId = window.location.hash.replace("#", "");
        const targetCard = document.getElementById(hashId);
        if (targetCard) {
          setTimeout(() => {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.classList.add("is-highlighted");
          }, 100);
        }
      }
    })
    .catch(() => {
      const empty = document.getElementById("publicNoticeEmpty");
      empty.textContent = "Couldn't load notices right now — please try again later.";
      empty.style.display = "block";
    });
}

function formatNoticeDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeNoticeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* Converts newline characters to <br> tags in an already-HTML-escaped
   string. Always HTML-escape first, then call nl2br() — that way
   user-typed line breaks show as real breaks while injected HTML tags
   remain inert plain text. */
function nl2br(escapedStr) {
  return escapedStr.replace(/\n/g, "<br>");
}

// 7. Public Services Loader + Filtering + Detail Modal (Services.html only)
// (Formerly "Courses" — renamed for consistency with the rest of the site.)
// Fetches only active services from the server, renders them into the
// grid, and wires up the category chips + click-to-open modal against
// that rendered data. Guarded so this does nothing on other pages.
// The category chips themselves come from /api/public/categories instead
// of being hardcoded here, so the list stays in sync with whatever an
// admin has added/removed from the panel.
const publicServiceGrid = document.getElementById("publicServiceGrid");

if (publicServiceGrid) {
  let allServices = [];
  let serviceFilter = "all";

  const publicServiceEmpty = document.getElementById("publicServiceEmpty");
  const serviceModal = document.getElementById("serviceModal");
  const serviceModalClose = document.getElementById("serviceModalClose");
  const serviceFilterChips = document.getElementById("serviceFilterChips");

  function renderPublicServices() {
    const rawRows = allServices.filter(
      (s) => serviceFilter === "all" || s.category === serviceFilter
    );
    // Optional data-limit attribute: when present (e.g. on index.html preview
    // sections), only the first N records are rendered. Pages without the
    // attribute (Services.html) keep showing everything — fully backward-compatible.
    const limitAttr = publicServiceGrid.getAttribute("data-limit");
    const limit = limitAttr ? parseInt(limitAttr, 10) : Infinity;
    const rows = rawRows.slice(0, limit);
    publicServiceGrid.innerHTML = "";
    if (publicServiceEmpty) publicServiceEmpty.style.display = rows.length ? "none" : "block";

    rows.forEach((s) => {
      const card = document.createElement("div");
      card.className = "service-card";
      card.setAttribute("data-category", s.category);
      const imageHtml = s.image
        ? `<div class="service-image" style="width:100%;height:160px;border-radius:8px;overflow:hidden;margin-bottom:16px;background:#e2e8f0;">
             <img src="${escapeServiceHtml(s.image)}" alt="${escapeServiceHtml(s.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">
           </div>`
        : "";
      card.innerHTML = `
        ${imageHtml}
        <h3>${escapeServiceHtml(s.name)}</h3>
        <div class="para">${nl2br(escapeServiceHtml(s.desc))}</div>
        <span class="service-duration">${escapeServiceHtml(s.duration)}</span>
      `;
      card.addEventListener("click", () => openServiceDetailModal(s));
      publicServiceGrid.appendChild(card);
    });
  }

  function openServiceDetailModal(s) {
    if (!serviceModal) return;
    document.getElementById("serviceModalCategory").textContent = s.category || "";
    document.getElementById("serviceModalTitle").textContent = s.name || "";
    document.getElementById("serviceModalDesc").textContent = s.desc || "";
    document.getElementById("serviceModalDuration").textContent = s.duration || "";
    serviceModal.classList.add("open");
  }

  if (serviceModal && serviceModalClose) {
    serviceModalClose.addEventListener("click", () => serviceModal.classList.remove("open"));
    serviceModal.addEventListener("click", (e) => {
      if (e.target === serviceModal) serviceModal.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") serviceModal.classList.remove("open");
    });
  }

  // One delegated listener on the chip row (rather than binding each chip
  // individually) so newly-added category chips work automatically once
  // they're loaded in, with nothing extra to wire up.
  if (serviceFilterChips) {
    serviceFilterChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      serviceFilterChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      serviceFilter = chip.getAttribute("data-filter");
      renderPublicServices();
    });

    fetch("/api/public/categories")
      .then((res) => res.json())
      .then((categories) => {
        categories.forEach((name) => {
          const chip = document.createElement("button");
          chip.className = "chip";
          chip.setAttribute("data-filter", name);
          chip.textContent = name;
          serviceFilterChips.appendChild(chip);
        });
      })
      .catch(() => {}); // the "All Services" chip still works fine on its own
  }

  fetch("/api/public/services")
    .then((res) => res.json())
    .then((services) => {
      allServices = services;
      renderPublicServices();
    })
    .catch(() => {
      if (publicServiceEmpty) {
        publicServiceEmpty.textContent = "Couldn't load services right now — please try again later.";
        publicServiceEmpty.style.display = "block";
      }
    });
}

function escapeServiceHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// 8. Public Gallery Loader + Lightbox (Gallery.html only)
// Fetches every saved photo from the server, renders the cards, and
// wires up the click-to-open lightbox against that rendered data.
// Guarded so this does nothing on other pages.
const publicGalleryGrid = document.getElementById("publicGalleryGrid");

if (publicGalleryGrid) {
  const publicGalleryEmpty = document.getElementById("publicGalleryEmpty");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDesc = document.getElementById("lightboxDesc");
  const lightboxClose = document.getElementById("lightboxClose");

  function renderPublicGallery(photos) {
    publicGalleryGrid.innerHTML = "";
    if (publicGalleryEmpty) publicGalleryEmpty.style.display = photos.length ? "none" : "block";

    // Optional data-limit attribute: when present (e.g. on index.html preview
    // sections), only the first N photos are rendered. Pages without the
    // attribute (Gallery.html) keep showing everything — fully backward-compatible.
    const limitAttr = publicGalleryGrid.getAttribute("data-limit");
    const limit = limitAttr ? parseInt(limitAttr, 10) : Infinity;

    photos.slice(0, limit).forEach((p) => {
      const card = document.createElement("div");
      card.className = "gallery-card";
      card.innerHTML = `
        <div class="gallery-image">
          <img src="${escapeGalleryHtml(p.image || "")}" alt="${escapeGalleryHtml(p.title)}">
        </div>
        <div class="gallery-info">
          <h3 class="gallery-title">${escapeGalleryHtml(p.title)}</h3>
          <p class="gallery-desc">${nl2br(escapeGalleryHtml(p.desc))}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        if (!lightbox) return;
        lightboxImg.src = p.image || "";
        lightboxImg.alt = p.title;
        lightboxTitle.textContent = p.title;
        lightboxDesc.textContent = p.desc;
        lightbox.classList.add("open");
      });
      publicGalleryGrid.appendChild(card);
    });
  }

  if (lightbox) {
    lightboxClose.addEventListener("click", () => lightbox.classList.remove("open"));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") lightbox.classList.remove("open");
    });
  }

  fetch("/api/gallery")
    .then((res) => res.json())
    .then((photos) => renderPublicGallery(photos))
    .catch(() => {
      if (publicGalleryEmpty) {
        publicGalleryEmpty.textContent = "Couldn't load photos right now — please try again later.";
        publicGalleryEmpty.style.display = "block";
      }
    });
}

function escapeGalleryHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 9. Public Testimonials Loader (Services.html only)
// Fetches all testimonials from the server and renders them into
// the grid on the Services page. Guarded so this does nothing on other pages.
const publicTestimonialsGrid = document.getElementById("publicTestimonialsGrid");

if (publicTestimonialsGrid) {
  const publicTestimonialsEmpty = document.getElementById("publicTestimonialsEmpty");

  fetch("/api/testimonials")
    .then((res) => res.json())
    .then((testimonials) => {
      if (!testimonials.length) {
        if (publicTestimonialsEmpty) publicTestimonialsEmpty.style.display = "block";
        return;
      }

      testimonials.forEach((t) => {
        const card = document.createElement("div");
        card.className = "student-card";
        const photoHtml = t.photo
          ? `<img src="${escapeTestHtml(t.photo)}" alt="${escapeTestHtml(t.name)}" width="70" height="70" class="Testimonials-img">`
          : `<div class="testimonial-placeholder">${escapeTestHtml(t.name.charAt(0).toUpperCase())}</div>`;
        card.innerHTML = `
          <div class="info-client">
            ${photoHtml}
            <h5 class="Student-name">${escapeTestHtml(t.name)}</h5>
            ${t.service ? `<span class="testimonial-service-tag">${escapeTestHtml(t.service)}</span>` : ""}
          </div>
          <p class="info-para">${nl2br(escapeTestHtml(t.text))}</p>
        `;
        publicTestimonialsGrid.appendChild(card);
      });
    })
    .catch(() => {
      if (publicTestimonialsEmpty) {
        publicTestimonialsEmpty.textContent = "Couldn't load testimonials right now — please try again later.";
        publicTestimonialsEmpty.style.display = "block";
      }
    });
}

function escapeTestHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}


// Offer script
(function () {

  const FLYERS = [
    {
      tag: "New Batch",
      title: "Digital Marketing — New Batch Starts Aug 20",
      desc: "Evening batch, 6 weeks, seats limited to 20 students.",
      date: "Posted Aug 5, 2026",
      image: "",
      link: "#"
    },
    {
      tag: "Offer",
      title: "20% Off — Office Package (Excel, Word, PowerPoint)",
      desc: "Early-bird discount for enrollments before Aug 31.",
      date: "Posted Aug 3, 2026",
      image: "",
      link: "#"
    },
    {
      tag: "Event",
      title: "Free Career Counseling — Every Saturday",
      desc: "Drop by Charali branch, 10 AM–1 PM, no booking needed.",
      date: "Posted Jul 28, 2026",
      image: "",
      link: "#"
    }
  ];
 
  const tilts = [-2, 1.5, -1, 2, -1.5, 1];
 
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
 
  function renderFlyers() {
    const grid = document.getElementById('flyerGrid');
    const empty = document.getElementById('flyerEmpty');
 
    if (!FLYERS.length) {
      grid.style.display = 'none';
      empty.hidden = false;
      return;
    }
 
    grid.innerHTML = FLYERS.map((f, i) => {
      const tilt = tilts[i % tilts.length];
      const thumb = f.image
        ? `<img class="flyer-card__thumb" style="background:none;padding:0;object-fit:cover;" src="${esc(f.image)}" alt="${esc(f.title)}">`
        : `<div class="flyer-card__thumb"><span class="flyer-card__thumb-title">${esc(f.title)}</span></div>`;
 
      return `
        <article class="flyer-card" style="--tilt:${tilt}deg;">
          <span class="flyer-card__tag">${esc(f.tag)}</span>
          ${thumb}
          <h3 class="flyer-card__title">${esc(f.title)}</h3>
          <p class="flyer-card__desc">${esc(f.desc)}</p>
          <div class="flyer-card__meta"><span>${esc(f.date)}</span></div>
          <a class="flyer-card__cta" href="${esc(f.link)}" target="_blank" rel="noopener">View Flyer →</a>
        </article>
      `;
    }).join('');
  }
 
  renderFlyers();
})();