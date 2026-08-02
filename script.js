// 1. Mobile Navigation
const hamBtn = document.getElementById("hamBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (hamBtn && mobileMenu) {
  hamBtn.addEventListener("click", () => {
    hamBtn.classList.toggle("open");
    mobileMenu.classList.toggle("open");
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      hamBtn.classList.remove("open");
      mobileMenu.classList.remove("open");

      mobileMenu
        .querySelectorAll("a")
        .forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

// 2. Active Link on Desktop Nav
document.querySelectorAll(".nav-links").forEach((link) => {
  link.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-links")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// 3. JS for Terminal
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

// 4. Course Filtering Logic
document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = document.querySelectorAll(".chip");
  const courseCards = document.querySelectorAll(".course-card");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const filterValue = button.getAttribute("data-filter");

      courseCards.forEach((card) => {
        if (
          filterValue === "all" ||
          card.getAttribute("data-category") === filterValue
        ) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
});

// 5. Stats Count-Up Animation
const animateCount = (el) => {
  const target = parseInt(el.getAttribute("data-count"), 10);
  const duration = 1500;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
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
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  statsObserver.observe(statsStrip);
}

// 6. Course Detail Modal
const courseCardsForModal = document.querySelectorAll(".course-card");
const courseModal = document.getElementById("courseModal");
const courseModalClose = document.getElementById("courseModalClose");

if (courseModal) {
  courseCardsForModal.forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.querySelector("h3");
      const desc = card.querySelector(".para");
      const duration = card.querySelector(".course-duration");
      const category = card.getAttribute("data-category");

      document.getElementById("courseModalCategory").textContent = category || "";
      document.getElementById("courseModalTitle").textContent = title ? title.textContent : "";
      document.getElementById("courseModalDesc").textContent = desc ? desc.textContent : "";
      document.getElementById("courseModalDuration").textContent = duration ? duration.textContent : "";

      courseModal.classList.add("open");
    });
  });

  if (courseModalClose) {
    courseModalClose.addEventListener("click", () => {
      courseModal.classList.remove("open");
    });
  }

  courseModal.addEventListener("click", (e) => {
    if (e.target === courseModal) {
      courseModal.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      courseModal.classList.remove("open");
    }
  });
}

// 7. Gallery Lightbox Guarded
const galleryCards = document.querySelectorAll(".gallery-card");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxDesc = document.getElementById("lightboxDesc");
const lightboxClose = document.getElementById("lightboxClose");

if (lightbox) {
  galleryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const img = card.querySelector("img");
      const title = card.querySelector(".gallery-title");
      const desc = card.querySelector(".gallery-desc");

      if (lightboxImg && img) {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
      }
      if (lightboxTitle) lightboxTitle.textContent = title ? title.textContent : "";
      if (lightboxDesc) lightboxDesc.textContent = desc ? desc.textContent : "";

      lightbox.classList.add("open");
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", () => {
      lightbox.classList.remove("open");
    });
  }

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      lightbox.classList.remove("open");
    }
  });
}

// 8. Public Notices Loader (Notice.html only)
const publicNoticeList = document.getElementById("publicNoticeList");

if (publicNoticeList) {
  fetch("/api/notices?status=published")
    .then((res) => res.json())
    .then((notices) => {
      const empty = document.getElementById("publicNoticeEmpty");

      if (!notices.length) {
        if (empty) empty.style.display = "block";
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
      if (empty) {
        empty.textContent = "Couldn't load notices right now — please try again later.";
        empty.style.display = "block";
      }
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