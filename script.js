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

