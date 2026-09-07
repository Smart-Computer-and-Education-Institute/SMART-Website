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

  // Sticky Header Scroll elevation listener
  const header = document.querySelector(".primary-header");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Initialize smooth scroll reveals across sections and cards
  initScrollReveals();
});

// Minimal & Smooth Scroll-Triggered Reveal System
let revealObserver;
function initScrollReveals() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return; // Don't animate if user prefers reduced motion
  }

  if (!revealObserver && "IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
  }

  const selectors = [
    ".preview-section",
    ".Hero",
    ".about-wrap",
    ".about-grid",
    ".offer-section",
    ".founder-section",
    ".gallery-card",
    ".service-card",
    ".flyer-card",
    ".notice-public-card",
    ".timeshift-card",
    ".student-card",
    ".info-card",
    ".form-panel",
    ".map-panel",
    ".job-card",
    ".header-section",
    ".contact-grid"
  ];

  document.querySelectorAll(selectors.join(",")).forEach((el) => {
    if (!el.classList.contains("reveal-on-scroll")) {
      el.classList.add("reveal-on-scroll");
    }
    if (revealObserver && !el.classList.contains("is-visible")) {
      revealObserver.observe(el);
    }
  });

  // Add staggered animation classes to card grids
  document.querySelectorAll(
    ".gallery-grid, .service-grid, .flyer-board__grid, .info-grid, .jobs-grid, .days-grid, .gird-layout"
  ).forEach((grid) => {
    grid.classList.add("reveal-stagger");
  });
}

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
  const flatSettings = { ...settings, ...(settings.socialLinks || {}) };
  document.querySelectorAll("[data-contact]").forEach((el) => {
    const field = el.getAttribute("data-contact");
    let value = flatSettings[field];
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
      } else {
        // Generic link fields (e.g. mapDirectionsUrl, social links): set href and show if present, else hide.
        el.style.display = value ? "" : "none";
        if (value) el.href = value;
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

  if (settings.footerCtaText !== undefined) {
    const showCta = Boolean(settings.footerCtaText && settings.footerCtaText.trim());
    document.querySelectorAll(".footer-cta").forEach((cta) => {
      cta.style.display = showCta ? "" : "none";
    });
  }

  // Render dynamic custom social links in all footer social containers
  applyFooterSocialLinks(settings);
}

const FOOTER_SOCIAL_ICONS = {
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M13.5 22v-8.5h2.85l.43-3.32h-3.28V8.05c0-.96.27-1.62 1.65-1.62h1.76V3.46A23.6 23.6 0 0 0 14.2 3.3c-2.51 0-4.23 1.53-4.23 4.34v2.42H7.1v3.32h2.87V22h3.53Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5.2 3-5.2 3Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 2h-3v13.2a2.8 2.8 0 1 1-2-2.68V9.4a5.9 5.9 0 1 0 5 5.83V8.9a7.3 7.3 0 0 0 4 1.2V7a4.3 4.3 0 0 1-4-5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.04 2c-5.5 0-9.98 4.47-9.98 9.97 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.96 9.96 0 0 0 4.84 1.24h.01c5.5 0 9.98-4.47 9.98-9.97A9.97 9.97 0 0 0 12.04 2zm5.83 14.12c-.24.68-1.39 1.33-1.93 1.37-.5.05-1.12.06-3.62-.97-3.2-1.32-5.26-4.57-5.42-4.78-.16-.21-1.3-1.74-1.3-3.32 0-1.58.83-2.35 1.12-2.67.3-.32.65-.4.87-.4.22 0 .43 0 .62.01.2.01.47-.08.73.55.27.65.92 2.25 1 2.42.08.16.14.36.03.57-.11.22-.16.35-.33.54-.16.2-.34.44-.49.59-.16.16-.33.34-.14.67.19.32.84 1.38 1.8 2.24 1.24 1.11 2.29 1.45 2.61 1.61.33.16.52.14.71-.08.2-.22.84-.98 1.06-1.32.22-.34.44-.29.74-.18.3.11 1.93.91 2.26 1.07.33.16.55.25.63.38.08.14.08.8-.16 1.48z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.7 8.03c-.13.58-.47.72-.96.45l-2.61-1.92-1.26 1.21c-.14.14-.26.26-.53.26l.19-2.66 4.84-4.37c.21-.19-.05-.29-.32-.1l-5.99 3.77-2.58-.81c-.56-.18-.57-.56.12-.83l10.07-3.88c.47-.17.88.11.73.85z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.078.078 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
  threads: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c2.5 0 4.79-.92 6.54-2.45l-1.36-1.42A7.95 7.95 0 0 1 12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 1.5-.4 2.89-1.13 4.07-.63 1.02-1.57 1.63-2.62 1.63-1.06 0-1.75-.68-1.75-1.95V10.2c0-1.89-1.2-3.2-3.12-3.2-2.17 0-3.88 1.74-3.88 4.05 0 2.37 1.63 4.14 3.88 4.14 1.28 0 2.34-.58 2.87-1.55.45 1.61 1.7 2.65 3.5 2.65 1.73 0 3.23-.97 4.13-2.44A9.92 9.92 0 0 0 22 12c0-5.52-4.48-10-10-10zm.12 13.25c-1.25 0-2.15-.94-2.15-2.25 0-1.34.9-2.25 2.15-2.25s2.15.91 2.15 2.25c0 1.31-.9 2.25-2.15 2.25z"/></svg>',
  reddit: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm5.748-12.87a1.44 1.44 0 0 0-1.433 1.26 7.42 7.42 0 0 0-3.905-1.146l.794-3.738 2.597.553a1.14 1.14 0 1 0 .232-.705l-2.993-.637a.382.382 0 0 0-.45.293l-.914 4.3a7.48 7.48 0 0 0-3.957 1.173 1.44 1.44 0 1 0-1.706 2.327c-.017.158-.026.319-.026.482 0 2.455 2.865 4.453 6.4 4.453s6.4-1.998 6.4-4.453c0-.16-.009-.32-.025-.477a1.438 1.438 0 0 0-.414-2.686zM9.354 13.5c0-.623.504-1.127 1.127-1.127.622 0 1.127.504 1.127 1.127 0 .622-.505 1.127-1.127 1.127-.623 0-1.127-.505-1.127-1.127zm5.292 2.604c-.65.65-1.89.7-2.646.7-.755 0-1.996-.05-2.646-.7-.146-.146-.146-.383 0-.529.146-.146.383-.146.53 0 .471.472 1.467.529 2.116.529.649 0 1.645-.057 2.116-.53.147-.146.384-.146.53 0 .146.147.146.384 0 .53zm-.12-1.477a1.127 1.127 0 1 1 0-2.254 1.127 1.127 0 0 1 0 2.254z"/></svg>',
  pinterest: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-3.66 19.31c-.05-.83-.09-2.1.02-3 .1-.83.67-4.32.67-4.32s-.17-.34-.17-.84c0-.79.46-1.38 1.03-1.38.48 0 .72.36.72.8 0 .49-.31 1.22-.47 1.9-.13.57.29 1.03.85 1.03 1.02 0 1.8-1.08 1.8-2.63 0-1.38-.99-2.34-2.4-2.34-1.64 0-2.6 1.23-2.6 2.5 0 .5.19 1.03.43 1.32.05.06.05.11.04.17-.04.16-.13.54-.15.62-.02.1-.09.12-.19.07-.72-.34-1.17-1.39-1.17-2.24 0-1.82 1.32-3.5 3.82-3.5 2.01 0 3.57 1.43 3.57 3.35 0 2-1.26 3.61-3 3.61-.59 0-1.14-.31-1.33-.67l-.36 1.38c-.13.5-.48 1.13-.72 1.51A10 10 0 1 0 12 2z"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.03 2c-3.1 0-5.46 2.05-5.46 4.93 0 .7.15 1.43.34 1.88.08.18.06.27-.05.37-.3.26-.96.53-1.63.8-.45.18-.54.43-.52.64.03.28.4.52.88.58.55.07.96.22 1.17.48.24.3.17.84.05 1.43-.05.23-.23.95-.61 1.63-.44.78-.99 1.24-.99 1.76 0 .37.28.67.92.83.67.17 1.63.14 2.88-.36.43-.17.78-.11 1.02.05.77.5 1.39.73 2.02.73s1.25-.23 2.02-.73c.24-.16.59-.22 1.02-.05 1.25.5 2.21.53 2.88.36.64-.16.92-.46.92-.83 0-.52-.55-.98-.99-1.76-.38-.68-.56-1.4-.61-1.63-.12-.59-.19-1.13.05-1.43.21-.26.62-.41 1.17-.48.48-.06.85-.3.88-.58.02-.21-.07-.46-.52-.64-.67-.27-1.33-.54-1.63-.8-.11-.1-.13-.19-.05-.37.19-.45.34-1.18.34-1.88C17.49 4.05 15.13 2 12.03 2z"/></svg>',
  twitch: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2.149 0l-1.612 4.119v16.036h5.031v3.845h3.845l3.665-3.845h4.942l5.98-5.979V0H2.149zm17.605 13.084l-3.396 3.396h-4.943l-3.037 3.037v-3.037H5.21V2.149h14.544v10.935zm-3.665-6.155h-2.149v6.242h2.149V6.929zm-5.733 0H8.207v6.242h2.149V6.929z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.75.75 0 0 1-1.03.248c-2.822-1.725-6.375-2.115-10.56-1.16a.75.75 0 1 1-.334-1.462c4.58-.95 8.528-.507 11.676 1.417.36.22.47.69.248 1.03v-.073zm1.226-2.723a.938.938 0 0 1-1.29.31c-3.23-1.986-8.156-2.56-11.977-1.4a.938.938 0 1 1-.546-1.794c4.375-1.328 9.809-.686 13.503 1.587.42.26.55.82.31 1.24v.057zm.105-2.835C14.05 8.784 7.674 8.57 3.987 9.69a1.125 1.125 0 1 1-.652-2.154c4.244-1.288 11.295-1.04 15.74 1.6a1.125 1.125 0 1 1-1.158 1.93z"/></svg>',
  medium: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>',
  viber: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M22.84 16.42c-.22-.38-2.61-3.13-3.8-3.23-.39-.03-.78.14-1.07.45-.39.42-.77.85-1.16 1.28-.15.16-.33.22-.54.14-.52-.19-1.17-.46-1.92-.88-1.56-.87-2.97-2.14-4.14-3.69-.53-.7-.94-1.39-1.22-2.02-.09-.2-.04-.37.11-.53.4-.41.8-.81 1.2-1.22.34-.35.5-.77.42-1.26-.09-1.05-2.07-3.95-2.45-4.22-.36-.26-.78-.37-1.22-.27-.64.14-1.35.6-1.89 1.19-.8 1-.98 2.15-.55 3.35.8 2.27 2.22 4.49 4.14 6.47 2.18 2.25 4.69 3.86 7.23 4.67 1.34.42 2.61.16 3.65-.74.6-.53 1.07-1.24 1.2-1.91.09-.43-.02-.84-.28-1.2z"/></svg>',
  messenger: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.12 7.15.16.14.26.35.26.57l-.07 1.78c-.03.73.74 1.22 1.38.87l1.98-1.08c.18-.1.38-.13.58-.08.88.24 1.8.37 2.75.37 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.06 13.06-2.58-2.75-5.04 2.75 5.54-5.88 2.65 2.75 4.97-2.75-5.54 5.88z"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

function detectPlatformIcon(label, url) {
  const combined = `${label || ""} ${url || ""}`.toLowerCase();
  if (/facebook|fb\.com|fb\.me/.test(combined)) return "facebook";
  if (/instagram|instagr\.am/.test(combined)) return "instagram";
  if (/youtube|youtu\.be/.test(combined)) return "youtube";
  if (/tiktok/.test(combined)) return "tiktok";
  if (/whatsapp|wa\.me/.test(combined)) return "whatsapp";
  if (/twitter|x\.com/.test(combined)) return "twitter";
  if (/linkedin/.test(combined)) return "linkedin";
  if (/github/.test(combined)) return "github";
  if (/telegram|t\.me/.test(combined)) return "telegram";
  if (/discord|discord\.gg/.test(combined)) return "discord";
  if (/threads/.test(combined)) return "threads";
  if (/reddit/.test(combined)) return "reddit";
  if (/pinterest/.test(combined)) return "pinterest";
  if (/snapchat/.test(combined)) return "snapchat";
  if (/twitch/.test(combined)) return "twitch";
  if (/spotify/.test(combined)) return "spotify";
  if (/medium/.test(combined)) return "medium";
  if (/viber/.test(combined)) return "viber";
  if (/messenger|m\.me/.test(combined)) return "messenger";
  return "website";
}

function applyFooterSocialLinks(settings) {
  const containers = document.querySelectorAll(".footer-social");
  if (!containers.length) return;

  let links = Array.isArray(settings.customSocialLinks) ? settings.customSocialLinks : [];
  if (!links.length && settings.socialLinks) {
    const sl = settings.socialLinks;
    const LEGACY = [
      { key: "facebook", label: "Facebook" },
      { key: "instagram", label: "Instagram" },
      { key: "youtube", label: "YouTube" },
      { key: "tiktok", label: "TikTok" },
    ];
    links = LEGACY.filter((p) => sl[p.key]).map((p) => ({ label: p.label, url: sl[p.key] }));
  }

  const validLinks = links.filter((item) => item && item.url).slice(0, 10);

  containers.forEach((container) => {
    container.innerHTML = "";
    if (!validLinks.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";
    validLinks.forEach((item) => {
      const platform = detectPlatformIcon(item.label, item.url);
      const svg = FOOTER_SOCIAL_ICONS[platform] || FOOTER_SOCIAL_ICONS.website;
      const a = document.createElement("a");
      a.className = "footer-social-link";
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const labelText = item.label || platform.charAt(0).toUpperCase() + platform.slice(1);
      a.setAttribute("aria-label", labelText);
      a.title = labelText;
      a.innerHTML = svg;
      container.appendChild(a);
    });
  });
}

if (document.querySelector("[data-contact], .footer-social")) {
  fetch("/api/public/settings")
    .then((res) => res.json())
    .then(applyContactSettings)
    .catch(() => { });
}

// Footer dynamic year & back-to-top handler
onDomReady(() => {
  document.querySelectorAll("#year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  const backToTop = document.getElementById("footerBackToTop");
  if (backToTop) {
    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});

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
    const strVal = String(value).trim();
    if (!strVal || strVal.toLowerCase() === "test" || strVal.toLowerCase() === "test test") return;

    if (el.hasAttribute("data-about-multiline")) {
      // Render newlines as <br> tags inside the existing element so the
      // surrounding CSS (font, spacing) still applies. Each \n\n in the
      // stored text produces a double-break, visually separating paragraphs.
      el.innerHTML = escapeAboutHtml(strVal).replace(/\n/g, "<br>");
    } else {
      el.textContent = strVal;
    }
  });
}

// Also swap [data-about-img] elements when a photo URL is stored in the about doc.
// Only overrides src if the stored URL is non-empty — keeps the hardcoded fallback
// image for any slot the admin hasn't uploaded to yet or if photo fails to load.
function applyAboutPhotos(data) {
  document.querySelectorAll("[data-about-img]").forEach((img) => {
    const field = img.getAttribute("data-about-img");
    if (data[field] && typeof data[field] === "string" && data[field].trim()) {
      const fallbackSrc = img.getAttribute("src") || "";
      img.onerror = function () {
        this.onerror = null;
        if (fallbackSrc && this.src !== fallbackSrc) this.src = fallbackSrc;
      };
      img.src = data[field];
    }
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

  if (typeof initScrollReveals === "function") {
    initScrollReveals();
  }
}

if (document.querySelector("[data-about]") || document.querySelector("[data-about-img]") || document.getElementById("customAboutSections")) {
  fetch("/api/public/about")
    .then((res) => res.json())
    .then((data) => {
      applyAboutContent(data);
      applyAboutPhotos(data);
      applyCustomAboutSections(data);
    })
    .catch(() => { }); // silently fall back to hardcoded HTML if fetch fails
}

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

onDomReady(animateProgressBar);

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
      initScrollReveals();

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
    const descEl = document.getElementById("serviceModalDesc");
    if (descEl) descEl.innerHTML = nl2br(escapeServiceHtml(s.desc || ""));
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
      .catch(() => { }); // the "All Services" chip still works fine on its own
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
          <img src="${escapeGalleryHtml(p.image || "")}" alt="${escapeGalleryHtml(p.title)}" loading="lazy" decoding="async">
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
    initScrollReveals();
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
      initScrollReveals();
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


// 10. Contact Inquiry Form handler (Contact.html)
onDomReady(() => {
  const inquiryForm = document.getElementById("inquiryForm") || document.querySelector(".form-panel form");
  if (inquiryForm) {
    inquiryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("name")?.value.trim() || "";
      const email = document.getElementById("email")?.value.trim() || "";
      const subject = document.getElementById("subject")?.value.trim() || "Course Inquiry";
      const message = document.getElementById("message")?.value.trim() || "";

      const mailtoUrl = `mailto:smartinstitute@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("From: " + name + " (" + email + ")\n\n" + message)}`;
      window.location.href = mailtoUrl;

      let feedback = document.getElementById("inquiryFeedback");
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = "inquiryFeedback";
        feedback.style.cssText =
          "margin-top:16px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;font-size:0.9rem;font-weight:500;";
        inquiryForm.appendChild(feedback);
      }
      feedback.textContent = "Opening your email client to send your inquiry. Thank you!";
      inquiryForm.reset();
    });
  }
});