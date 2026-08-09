// 1. Grab the button and the menu
const hamBtn = document.getElementById("hamBtn");
const mobileMenu = document.getElementById("mobileMenu");

// 2. Click hamburger → open/close menu
hamBtn.addEventListener("click", () => {
  hamBtn.classList.toggle("open"); // toggles X animation
  mobileMenu.classList.toggle("open"); // slides menu open/closed
});

// 3. Click any mobile link → close menu automatically
mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    hamBtn.classList.remove("open");
    mobileMenu.classList.remove("open");

    // also update active link
    mobileMenu
      .querySelectorAll("a")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// 4. Active link on desktop nav
document.querySelectorAll(".nav-links").forEach((link) => {
  link.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-links")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
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
  fetch("/api/notices?status=published")
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

// 7. Public Courses Loader + Filtering + Detail Modal (Course.html only)
// Fetches only active courses from the server, renders them into the
// grid, and wires up the category chips + click-to-open modal against
// that rendered data. Guarded so this does nothing on other pages.
const publicCourseGrid = document.getElementById("publicCourseGrid");

if (publicCourseGrid) {
  let allCourses = [];
  let courseFilter = "all";

  const publicCourseEmpty = document.getElementById("publicCourseEmpty");
  const courseModal = document.getElementById("courseModal");
  const courseModalClose = document.getElementById("courseModalClose");

  function renderPublicCourses() {
    const rows = allCourses.filter(
      (c) => courseFilter === "all" || c.category === courseFilter
    );
    publicCourseGrid.innerHTML = "";
    if (publicCourseEmpty) publicCourseEmpty.style.display = rows.length ? "none" : "block";

    rows.forEach((c) => {
      const card = document.createElement("div");
      card.className = "course-card";
      card.setAttribute("data-category", c.category);
      card.innerHTML = `
        <h3>${escapeCourseHtml(c.name)}</h3>
        <div class="para">${escapeCourseHtml(c.desc)}</div>
        <span class="course-duration">${escapeCourseHtml(c.duration)}</span>
      `;
      card.addEventListener("click", () => openCourseDetailModal(c));
      publicCourseGrid.appendChild(card);
    });
  }

  function openCourseDetailModal(c) {
    if (!courseModal) return;
    document.getElementById("courseModalCategory").textContent = c.category || "";
    document.getElementById("courseModalTitle").textContent = c.name || "";
    document.getElementById("courseModalDesc").textContent = c.desc || "";
    document.getElementById("courseModalDuration").textContent = c.duration || "";
    courseModal.classList.add("open");
  }

  if (courseModal && courseModalClose) {
    courseModalClose.addEventListener("click", () => courseModal.classList.remove("open"));
    courseModal.addEventListener("click", (e) => {
      if (e.target === courseModal) courseModal.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") courseModal.classList.remove("open");
    });
  }

  document.querySelectorAll(".filter-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      courseFilter = chip.getAttribute("data-filter");
      renderPublicCourses();
    });
  });

  fetch("/api/courses?status=active")
    .then((res) => res.json())
    .then((courses) => {
      allCourses = courses;
      renderPublicCourses();
    })
    .catch(() => {
      if (publicCourseEmpty) {
        publicCourseEmpty.textContent = "Couldn't load courses right now — please try again later.";
        publicCourseEmpty.style.display = "block";
      }
    });
}

function escapeCourseHtml(str) {
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

// 9. Public Testimonials Loader (Course.html only)
// Fetches all testimonials from the server and renders them into
// the grid on the Course page. Guarded so this does nothing on other pages.
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
            ${t.course ? `<span class="testimonial-course-tag">${escapeTestHtml(t.course)}</span>` : ""}
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


