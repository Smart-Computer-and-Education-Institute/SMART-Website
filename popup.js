/* ============================================================
   Site Popups Queue & Display (index.html)
   Driven by GET /api/public/site-popups (array of active popups)
   ============================================================ */

(function () {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function nl2br(escapedStr) {
    return escapedStr.replace(/\n/g, "<br>");
  }

  function shouldDisplayPopup(popup) {
    if (!popup || !popup.id) return false;
    const freq = popup.frequency || "everyLoad";
    const storageKey = "smart_popup_shown_" + popup.id;

    if (freq === "oncePerSession") {
      return !sessionStorage.getItem(storageKey);
    }

    if (freq === "oncePerDay") {
      const lastShown = localStorage.getItem(storageKey);
      if (!lastShown) return true;
      const parsedTime = parseInt(lastShown, 10);
      if (isNaN(parsedTime)) return true;
      return Date.now() - parsedTime >= ONE_DAY_MS;
    }

    // "everyLoad" or default
    return true;
  }

  function recordPopupDismissal(popup) {
    if (!popup || !popup.id) return;
    const freq = popup.frequency || "everyLoad";
    const storageKey = "smart_popup_shown_" + popup.id;

    if (freq === "oncePerSession") {
      sessionStorage.setItem(storageKey, "1");
    } else if (freq === "oncePerDay") {
      localStorage.setItem(storageKey, String(Date.now()));
    }
  }

  async function initSitePopups() {
    const overlay = document.getElementById("sitePopupOverlay");
    const card = document.getElementById("sitePopupCard");
    const closeBtn = document.getElementById("sitePopupClose");
    const dismissBtn = document.getElementById("sitePopupDismiss");
    const media = document.getElementById("sitePopupMedia");
    const img = document.getElementById("sitePopupImage");
    const tag = document.getElementById("sitePopupTag");
    const title = document.getElementById("sitePopupTitle");
    const body = document.getElementById("sitePopupBody");
    const ctaBtn = document.getElementById("sitePopupCta");

    if (!overlay || !card) return;

    let popupsList = [];
    try {
      const res = await fetch("/api/public/site-popups");
      if (!res.ok) return;
      popupsList = await res.json();
    } catch (_) {
      // Gracefully silent on network or server errors
      return;
    }

    if (!Array.isArray(popupsList) || popupsList.length === 0) {
      return;
    }

    // Filter queue by per-popup storage frequency rules
    const queue = popupsList.filter(shouldDisplayPopup);
    if (queue.length === 0) {
      return;
    }

    let currentPopup = null;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        dismissCurrentPopup();
      }
    }

    function dismissCurrentPopup() {
      if (!currentPopup) return;

      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", onKeyDown);

      recordPopupDismissal(currentPopup);
      currentPopup = null;

      // If more popups remain in queue, show next after brief pause (~400ms)
      if (queue.length > 0) {
        setTimeout(showNextPopup, 400);
      }
    }

    function showNextPopup() {
      if (queue.length === 0) return;

      currentPopup = queue.shift();

      // Populate tag
      if (currentPopup.tag) {
        tag.textContent = currentPopup.tag;
        tag.style.display = "inline-block";
      } else {
        tag.textContent = "";
        tag.style.display = "none";
      }

      // Populate title and body
      title.textContent = currentPopup.title || "Announcement";
      body.innerHTML = nl2br(escapeHtml(currentPopup.message || ""));

      // Populate image
      if (currentPopup.image) {
        img.src = currentPopup.image;
        media.style.display = "block";
      } else {
        img.src = "";
        media.style.display = "none";
      }

      // Populate CTA button
      const ctaLabel = currentPopup.ctaLabel ? currentPopup.ctaLabel.trim() : "Learn more";
      ctaBtn.textContent = ctaLabel;

      const ctaLink = currentPopup.ctaLink ? currentPopup.ctaLink.trim() : "";
      const isExternal = /^https?:\/\//i.test(ctaLink) && !ctaLink.startsWith(window.location.origin);

      if (ctaLink) {
        ctaBtn.href = ctaLink;
        if (isExternal) {
          ctaBtn.target = "_blank";
          ctaBtn.rel = "noopener noreferrer";
        } else {
          ctaBtn.target = "_self";
          ctaBtn.removeAttribute("rel");
        }
      } else {
        ctaBtn.href = "javascript:void(0)";
        ctaBtn.target = "_self";
        ctaBtn.removeAttribute("rel");
      }

      // Attach event listeners
      closeBtn.onclick = dismissCurrentPopup;
      if (dismissBtn) dismissBtn.onclick = dismissCurrentPopup;

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          dismissCurrentPopup();
        }
      };

      ctaBtn.onclick = (e) => {
        if (!ctaLink || ctaLink === "javascript:void(0)") {
          e.preventDefault();
          dismissCurrentPopup();
        } else if (isExternal) {
          // Opened in new tab, dismiss modal and advance queue
          dismissCurrentPopup();
        } else {
          // Internal link navigation: record dismissal immediately
          recordPopupDismissal(currentPopup);
        }
      };

      // Display popup with animation
      overlay.classList.add("active");
      overlay.setAttribute("aria-hidden", "false");
      document.addEventListener("keydown", onKeyDown);
    }

    // Initial popup display delay (~800ms)
    setTimeout(showNextPopup, 800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSitePopups);
  } else {
    initSitePopups();
  }
})();
