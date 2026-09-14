/* ============================================
   admin/inquiries.js — Contact inquiries management
   ============================================ */

let inquiries = [];
let currentFilter = "all";
let searchQuery = "";
let selectedInquiry = null;

const inquiryTableBody = document.getElementById("inquiryTableBody");
const inquiryEmptyState = document.getElementById("inquiryEmptyState");
const inquiryCount = document.getElementById("inquiryCount");
const inquiryChipRow = document.getElementById("inquiryChipRow");
const inquirySearchInput = document.getElementById("inquirySearchInput");
const sidebarInquiryBadge = document.getElementById("sidebarInquiryBadge");

const modalOverlay = document.getElementById("inquiryDetailModalOverlay");
const modalSubject = document.getElementById("modalInquirySubject");
const modalBody = document.getElementById("inquiryDetailBody");
const detailStatusSelect = document.getElementById("detailStatusSelect");
const updateStatusBtn = document.getElementById("updateStatusBtn");
const replyEmailBtn = document.getElementById("replyEmailBtn");
const replyWhatsAppBtn = document.getElementById("replyWhatsAppBtn");
const deleteInquiryBtn = document.getElementById("deleteInquiryBtn");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getStatusBadge(status) {
  const s = (status || "unread").toLowerCase();
  if (s === "unread") {
    return '<span class="badge badge-amber">Unread</span>';
  } else if (s === "replied") {
    return '<span class="badge badge-green">Replied</span>';
  } else {
    return '<span class="badge" style="background:#f1f5f9; color:#475569;">Read</span>';
  }
}

async function loadInquiries() {
  if (inquiryCount) inquiryCount.textContent = "Loading...";

  try {
    const res = await fetch("/api/inquiries");
    if (res.status === 401) {
      window.location.href = "../login.html";
      return;
    }
    if (!res.ok) throw new Error("Failed to fetch inquiries");

    inquiries = await res.json();
    renderInquiries();
    updateBadges();
  } catch (err) {
    console.error("Error loading inquiries:", err);
    if (inquiryTableBody) {
      inquiryTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--color-danger);">Could not load inquiries. Please check your connection or refresh.</td></tr>`;
    }
  }
}

function updateBadges() {
  const unreadCount = inquiries.filter((i) => i.status === "unread").length;
  if (sidebarInquiryBadge) {
    if (unreadCount > 0) {
      sidebarInquiryBadge.textContent = unreadCount;
      sidebarInquiryBadge.style.display = "inline-flex";
    } else {
      sidebarInquiryBadge.style.display = "none";
    }
  }
}

function renderInquiries() {
  if (!inquiryTableBody) return;

  const q = searchQuery.toLowerCase().trim();
  const filtered = inquiries.filter((item) => {
    // Status filter
    if (currentFilter !== "all" && (item.status || "unread").toLowerCase() !== currentFilter) {
      return false;
    }
    // Search query filter
    if (q) {
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchEmail = (item.email || "").toLowerCase().includes(q);
      const matchSubject = (item.subject || "").toLowerCase().includes(q);
      const matchPhone = (item.phone || "").toLowerCase().includes(q);
      const matchMsg = (item.message || "").toLowerCase().includes(q);
      return matchName || matchEmail || matchSubject || matchPhone || matchMsg;
    }
    return true;
  });

  if (inquiryCount) {
    const unreadTotal = inquiries.filter((i) => i.status === "unread").length;
    inquiryCount.textContent = `${inquiries.length} total (${unreadTotal} unread) · Showing ${filtered.length}`;
  }

  if (filtered.length === 0) {
    inquiryTableBody.innerHTML = "";
    if (inquiryEmptyState) inquiryEmptyState.style.display = "block";
    return;
  }

  if (inquiryEmptyState) inquiryEmptyState.style.display = "none";

  inquiryTableBody.innerHTML = filtered
    .map(
      (item) => `
      <tr style="cursor:pointer;" onclick="openInquiryModal('${item.id}')">
        <td>
          <div class="cell-title" style="${item.status === 'unread' ? 'font-weight:700;' : ''}">
            ${escapeHtml(item.name)}
          </div>
          <div class="cell-sub">${escapeHtml(item.email)}</div>
        </td>
        <td>
          ${item.phone ? `<a href="tel:${escapeHtml(item.phone)}" onclick="event.stopPropagation();" style="color:var(--color-primary);">${escapeHtml(item.phone)}</a>` : '<span style="color:var(--color-text-muted);">—</span>'}
        </td>
        <td>
          <span style="${item.status === 'unread' ? 'font-weight:600;' : ''}">${escapeHtml(item.subject)}</span>
        </td>
        <td style="color:var(--color-text-secondary); font-size:12.5px; white-space:nowrap;">
          ${formatDate(item.createdAt)}
        </td>
        <td>
          ${getStatusBadge(item.status)}
        </td>
        <td style="text-align:right;" onclick="event.stopPropagation();">
          <div class="row-actions">
            <button class="btn btn-secondary btn-sm" onclick="openInquiryModal('${item.id}')" title="View inquiry">
              View
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteInquiry('${item.id}')" title="Delete inquiry">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

async function openInquiryModal(id) {
  selectedInquiry = inquiries.find((x) => String(x.id) === String(id));
  if (!selectedInquiry) return;

  if (modalSubject) {
    modalSubject.textContent = selectedInquiry.subject || "Inquiry Details";
  }

  // Format clean WhatsApp number (Nepal default: +977)
  let cleanPhoneForWa = (selectedInquiry.phone || "").replace(/[^0-9+]/g, "");
  if (cleanPhoneForWa && !cleanPhoneForWa.startsWith("+")) {
    if (cleanPhoneForWa.length === 10) cleanPhoneForWa = "977" + cleanPhoneForWa;
  } else if (cleanPhoneForWa.startsWith("+")) {
    cleanPhoneForWa = cleanPhoneForWa.slice(1);
  }

  if (modalBody) {
    modalBody.innerHTML = `
      <div style="background:var(--color-bg); padding:16px; border-radius:var(--radius-md); display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <span style="font-size:11.5px; font-weight:600; text-transform:uppercase; color:var(--color-text-muted); display:block; margin-bottom:2px;">From</span>
          <strong style="font-size:14px;">${escapeHtml(selectedInquiry.name)}</strong>
        </div>
        <div>
          <span style="font-size:11.5px; font-weight:600; text-transform:uppercase; color:var(--color-text-muted); display:block; margin-bottom:2px;">Received</span>
          <span style="font-size:13px; color:var(--color-text-secondary);">${formatDate(selectedInquiry.createdAt)}</span>
        </div>
        <div>
          <span style="font-size:11.5px; font-weight:600; text-transform:uppercase; color:var(--color-text-muted); display:block; margin-bottom:2px;">Email</span>
          <a href="mailto:${escapeHtml(selectedInquiry.email)}" style="color:var(--color-primary); font-weight:500;">${escapeHtml(selectedInquiry.email)}</a>
        </div>
        <div>
          <span style="font-size:11.5px; font-weight:600; text-transform:uppercase; color:var(--color-text-muted); display:block; margin-bottom:2px;">Phone</span>
          ${selectedInquiry.phone ? `<a href="tel:${escapeHtml(selectedInquiry.phone)}" style="color:var(--color-primary); font-weight:500;">${escapeHtml(selectedInquiry.phone)}</a>` : '<span style="color:var(--color-text-muted);">Not provided</span>'}
        </div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:600; text-transform:uppercase; color:var(--color-text-muted);">Message Body</span>
          <button type="button" class="btn btn-secondary btn-sm" id="copyMsgBtn" style="padding:4px 8px; font-size:11.5px;">Copy Message</button>
        </div>
        <div style="background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:16px; font-size:14px; line-height:1.6; white-space:pre-wrap; max-height:260px; overflow-y:auto; color:var(--color-text);">
${escapeHtml(selectedInquiry.message)}
        </div>
      </div>
    `;

    const copyBtn = document.getElementById("copyMsgBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(selectedInquiry.message);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy Message"), 1500);
      });
    }
  }

  // Configure Status select
  if (detailStatusSelect) {
    detailStatusSelect.value = selectedInquiry.status || "unread";
  }

  // Configure Reply Email button
  if (replyEmailBtn) {
    const subjectPrefix = selectedInquiry.subject.startsWith("Re:") ? selectedInquiry.subject : `Re: ${selectedInquiry.subject}`;
    replyEmailBtn.href = `mailto:${encodeURIComponent(selectedInquiry.email)}?subject=${encodeURIComponent(subjectPrefix)}&body=${encodeURIComponent(`Dear ${selectedInquiry.name},\n\nThank you for reaching out to Smart Computer & Education Institute.\n\n`)}`;
    replyEmailBtn.onclick = () => {
      updateInquiryStatus(selectedInquiry.id, "replied", false);
    };
  }

  // Configure WhatsApp button
  if (replyWhatsAppBtn) {
    if (cleanPhoneForWa) {
      const waText = encodeURIComponent(`Hello ${selectedInquiry.name}, thank you for contacting Smart Computer & Education Institute regarding "${selectedInquiry.subject}".`);
      replyWhatsAppBtn.href = `https://wa.me/${cleanPhoneForWa}?text=${waText}`;
      replyWhatsAppBtn.style.display = "inline-flex";
      replyWhatsAppBtn.onclick = () => {
        updateInquiryStatus(selectedInquiry.id, "replied", false);
      };
    } else {
      replyWhatsAppBtn.style.display = "none";
    }
  }

  // If status is unread, automatically mark as read upon viewing
  if (selectedInquiry.status === "unread") {
    updateInquiryStatus(selectedInquiry.id, "read", false);
  }

  if (modalOverlay) {
    modalOverlay.classList.add("open");
  }
}

function closeInquiryModal() {
  if (modalOverlay) {
    modalOverlay.classList.remove("open");
  }
  selectedInquiry = null;
}

async function updateInquiryStatus(id, newStatus, showPrompt = true) {
  try {
    const res = await fetch(`/api/inquiries/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) throw new Error("Failed to update status");

    const updated = await res.json();
    const idx = inquiries.findIndex((x) => String(x.id) === String(id));
    if (idx !== -1) {
      inquiries[idx].status = updated.status;
    }
    if (selectedInquiry && String(selectedInquiry.id) === String(id)) {
      selectedInquiry.status = updated.status;
      if (detailStatusSelect) detailStatusSelect.value = updated.status;
    }

    renderInquiries();
    updateBadges();

    if (showPrompt && typeof showToast === "function") {
      showToast(`Inquiry status updated to ${newStatus}`);
    }
  } catch (err) {
    console.error("Error updating status:", err);
    alert("Could not update status. Please try again.");
  }
}

async function deleteInquiry(id) {
  const item = inquiries.find((x) => String(x.id) === String(id));
  const name = item ? item.name : "this inquiry";
  if (!confirm(`Are you sure you want to delete inquiry from ${name}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/inquiries/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete inquiry");

    inquiries = inquiries.filter((x) => String(x.id) !== String(id));
    closeInquiryModal();
    renderInquiries();
    updateBadges();
  } catch (err) {
    console.error("Error deleting inquiry:", err);
    alert("Could not delete inquiry. Please try again.");
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadInquiries();

  // Chips
  if (inquiryChipRow) {
    inquiryChipRow.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      inquiryChipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter || "all";
      renderInquiries();
    });
  }

  // Search input
  if (inquirySearchInput) {
    inquirySearchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderInquiries();
    });
  }

  // Modal close handlers
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeInquiryModal);
  });
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeInquiryModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay?.classList.contains("open")) {
      closeInquiryModal();
    }
  });

  // Update status from modal select
  if (updateStatusBtn && detailStatusSelect) {
    updateStatusBtn.addEventListener("click", () => {
      if (selectedInquiry) {
        updateInquiryStatus(selectedInquiry.id, detailStatusSelect.value, true);
      }
    });
  }

  // Delete from modal
  if (deleteInquiryBtn) {
    deleteInquiryBtn.addEventListener("click", () => {
      if (selectedInquiry) {
        deleteInquiry(selectedInquiry.id);
      }
    });
  }
});
