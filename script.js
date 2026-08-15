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

// Footer copyright year — was previously never actually set by anything.
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

      notices
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .forEach((n) => {
          const card = document.createElement("div");
          card.className = "notice-public-card";
          card.innerHTML = `
            <div class="notice-public-top">
              <h3>${escapeNoticeHtml(n.title)}</h3>
              <span class="notice-public-date">${formatNoticeDate(n.date)}</span>
            </div>
            <p>${escapeNoticeHtml(n.content)}</p>
          `;
          publicNoticeList.appendChild(card);
        });
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
    const rows = allServices.filter(
      (s) => serviceFilter === "all" || s.category === serviceFilter
    );
    publicServiceGrid.innerHTML = "";
    if (publicServiceEmpty) publicServiceEmpty.style.display = rows.length ? "none" : "block";

    rows.forEach((s) => {
      const card = document.createElement("div");
      card.className = "service-card";
      card.setAttribute("data-category", s.category);
      card.innerHTML = `
        <h3>${escapeServiceHtml(s.name)}</h3>
        <div class="para">${escapeServiceHtml(s.desc)}</div>
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

    photos.forEach((p) => {
      const card = document.createElement("div");
      card.className = "gallery-card";
      card.innerHTML = `
        <div class="gallery-image">
          <img src="${escapeGalleryHtml(p.image || "")}" alt="${escapeGalleryHtml(p.title)}">
        </div>
        <div class="gallery-info">
          <h3 class="gallery-title">${escapeGalleryHtml(p.title)}</h3>
          <p class="gallery-desc">${escapeGalleryHtml(p.desc)}</p>
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
          <p class="info-para">${escapeTestHtml(t.text)}</p>
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



/* ===================================
   CAREER SECTION - JAVASCRIPT
   Smart Computer & Education Institute
   =================================== */

// ===================================
// GLOBAL VARIABLES
// ===================================
let selectedFile = null;
let currentJobTitle = '';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupFileUploadDragDrop();
});

// ===================================
// EVENT LISTENERS
// ===================================
function initializeEventListeners() {
    // File upload area click
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => {
            document.getElementById('cvFile').click();
        });
    }

    // File input change
    const cvFileInput = document.getElementById('cvFile');
    if (cvFileInput) {
        cvFileInput.addEventListener('change', handleFileSelect);
    }

    // Modal close on outside click
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeApplication();
            }
        });
    }

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeApplication();
        }
    });
}

// ===================================
// FILE UPLOAD FUNCTIONS
// ===================================
function setupFileUploadDragDrop() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    
    if (!fileUploadArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileUploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        fileUploadArea.classList.remove('dragover');
    }

    fileUploadArea.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        validateAndSetFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndSetFile(file);
    }
}

function validateAndSetFile(file) {
    const errorElement = document.getElementById('cvError');
    errorElement.textContent = '';

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        errorElement.textContent = 'File size exceeds 5MB. Please upload a smaller file.';
        clearFileInput();
        return;
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errorElement.textContent = 'Invalid file format. Please upload PDF, DOC, DOCX, or TXT file.';
        clearFileInput();
        return;
    }

    selectedFile = file;
    displayFilePreview(file);
}

function displayFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    document.getElementById('fileUploadArea').style.display = 'none';
    preview.style.display = 'block';
}

function removeFile() {
    selectedFile = null;
    clearFileInput();
    
    document.getElementById('fileUploadArea').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('cvError').textContent = '';
}

function clearFileInput() {
    const cvFileInput = document.getElementById('cvFile');
    cvFileInput.value = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===================================
// APPLICATION MODAL
// ===================================
function openApplication(buttonElement) {
    const jobTitle = buttonElement.closest('.job-card').querySelector('.job-title').textContent;
    currentJobTitle = jobTitle;
    document.getElementById('modalJobTitle').textContent = `Apply for ${jobTitle}`;
    document.getElementById('applicationModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    document.getElementById('applicationForm').reset();
    removeFile();
    clearFormErrors();
}

function closeApplication() {
    document.getElementById('applicationModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    document.getElementById('applicationForm').reset();
    removeFile();
    clearFormErrors();
    selectedFile = null;
}

// ===================================
// FORM VALIDATION
// ===================================
function clearFormErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.textContent = '');
}

function validateForm() {
    clearFormErrors();
    let isValid = true;

    // Full Name validation
    const fullName = document.getElementById('fullName').value.trim();
    if (!fullName || fullName.length < 2) {
        document.getElementById('fullNameError').textContent = 'Please enter a valid full name';
        isValid = false;
    }

    // Phone validation
    const phone = document.getElementById('phone').value.trim();
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phone || !phoneRegex.test(phone)) {
        document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
        isValid = false;
    }

    // Email validation
    const email = document.getElementById('email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        document.getElementById('emailError').textContent = 'Please enter a valid email address';
        isValid = false;
    }

    // Experience validation
    const experience = document.getElementById('experience').value;
    if (!experience || experience < 0 || experience > 60) {
        document.getElementById('experienceError').textContent = 'Please enter valid years of experience';
        isValid = false;
    }

    // Education validation
    const education = document.getElementById('education').value;
    if (!education) {
        document.getElementById('educationError').textContent = 'Please select your educational qualification';
        isValid = false;
    }

    // CV validation
    if (!selectedFile) {
        document.getElementById('cvError').textContent = 'Please upload your CV/Resume';
        isValid = false;
    }

    // Terms validation
    if (!document.getElementById('terms').checked) {
        document.getElementById('termsError').textContent = 'Please agree to the terms and conditions';
        isValid = false;
    }

    return isValid;
}

// ===================================
// FORM SUBMISSION
// ===================================
function handleSubmit(event) {
    event.preventDefault();

    // Validate form
    if (!validateForm()) {
        showErrorMessage('Please fill in all required fields correctly');
        return;
    }

    // Collect form data
    const formData = new FormData();
    formData.append('fullName', document.getElementById('fullName').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('experience', document.getElementById('experience').value);
    formData.append('currentPosition', document.getElementById('currentPosition').value);
    formData.append('education', document.getElementById('education').value);
    formData.append('field', document.getElementById('field').value);
    formData.append('skills', document.getElementById('skills').value);
    formData.append('coverLetter', document.getElementById('coverLetter').value);
    formData.append('jobTitle', currentJobTitle);
    
    if (selectedFile) {
        formData.append('cvFile', selectedFile);
    }

    // Simulate form submission (replace with actual API call)
    submitApplication(formData);
}

function submitApplication(formData) {
    // Show loading state
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Simulate API delay
    setTimeout(() => {
        const fullName = formData.get('fullName');
        const email = formData.get('email');
        const jobTitle = formData.get('jobTitle');

        // Show success message
        showSuccessMessage(fullName, email, jobTitle);

        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        // Close modal
        closeApplication();

        // Log application data (for testing)
        console.log('Application submitted:', {
            fullName: formData.get('fullName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            experience: formData.get('experience'),
            education: formData.get('education'),
            jobTitle: formData.get('jobTitle'),
            file: selectedFile ? selectedFile.name : 'No file'
        });

        // TODO: Send to backend API
        // Example: fetch('/api/applications', { method: 'POST', body: formData })
    }, 1500);
}

// ===================================
// SUCCESS & ERROR MESSAGES
// ===================================
function showSuccessMessage(fullName, email, jobTitle) {
    const successMsg = document.getElementById('successMessage');
    const successDetails = document.getElementById('successDetails');
    
    successDetails.innerHTML = `
        <strong>${fullName}</strong> - Your application for <strong>${jobTitle}</strong> 
        has been submitted successfully. We'll contact you at <strong>${email}</strong> soon.
    `;
    
    successMsg.classList.add('show');

    setTimeout(() => {
        successMsg.classList.remove('show');
    }, 5000);
}

function showErrorMessage(message) {
    const errorMsg = document.getElementById('errorMessage');
    const errorDetails = document.getElementById('errorDetails');
    
    errorDetails.textContent = message;
    errorMsg.classList.add('show');

    setTimeout(() => {
        errorMsg.classList.remove('show');
    }, 4000);
}

// ===================================
// JOB FILTERING
// ===================================
function filterJobs(category) {
    const cards = document.querySelectorAll('.job-card');
    const buttons = document.querySelectorAll('.filter-btn');
    
    // Update active button
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Filter cards with animation
    cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.animation = 'none';
            setTimeout(() => {
                card.style.display = 'block';
                card.style.animation = 'slideUp 0.3s ease';
            }, 0);
        } else {
            card.style.display = 'none';
        }
    });
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Add real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !emailRegex.test(this.value)) {
                document.getElementById('emailError').textContent = 'Please enter a valid email address';
            } else {
                document.getElementById('emailError').textContent = '';
            }
        });
    }

    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('blur', function() {
            const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
            if (this.value && !phoneRegex.test(this.value)) {
                document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
            } else {
                document.getElementById('phoneError').textContent = '';
            }
        });
    }

    const fullNameInput = document.getElementById('fullName');
    if (fullNameInput) {
        fullNameInput.addEventListener('blur', function() {
            if (this.value && this.value.trim().length < 2) {
                document.getElementById('fullNameError').textContent = 'Name must be at least 2 characters';
            } else {
                document.getElementById('fullNameError').textContent = '';
            }
        });
    }
});

// ===================================
// ANALYTICS & TRACKING (Optional)
// ===================================
function trackEvent(eventName, eventData) {
    // Replace with your analytics service (Google Analytics, Mixpanel, etc.)
    console.log(`Event: ${eventName}`, eventData);
    
    // Example: Google Analytics
    // if (window.gtag) {
    //     gtag('event', eventName, eventData);
    // }
}

// Track when user opens application modal
function trackApplicationOpen(jobTitle) {
    trackEvent('application_opened', { job_title: jobTitle });
}

// Track when user submits application
function trackApplicationSubmit(jobTitle, email) {
    trackEvent('application_submitted', { 
        job_title: jobTitle,
        email: email 
    });
}

// Track job filter
function trackJobFilter(category) {
    trackEvent('job_filtered', { category: category });
}

// carrer section flyer script
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