/**
 * OriginPass DPP badge — lightweight storefront controller.
 * Opens a mobile drawer/modal with passport summary, or navigates to the full URL.
 */
(function () {
  "use strict";

  var MODAL_ID = "originpass-dpp-modal";
  var activeRoot = null;
  var lastFocus = null;
  var cache = Object.create(null);

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function ensureModal() {
    var el = document.getElementById(MODAL_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = MODAL_ID;
    el.className = "originpass-dpp-modal";
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="originpass-dpp-modal__backdrop" data-op-close></div>' +
      '<div class="originpass-dpp-modal__panel" role="document">' +
      '  <div class="originpass-dpp-modal__header">' +
      '    <div>' +
      '      <h2 class="originpass-dpp-modal__title" id="originpass-dpp-modal-title">Digital Product Passport</h2>' +
      '      <p class="originpass-dpp-modal__brand" data-op-brand hidden></p>' +
      "    </div>" +
      '    <button type="button" class="originpass-dpp-modal__close" data-op-close aria-label="Close">&times;</button>' +
      "  </div>" +
      '  <div class="originpass-dpp-modal__body" data-op-body>' +
      '    <p class="originpass-dpp-modal__status" data-op-status>Loading passport…</p>' +
      "  </div>" +
      '  <div class="originpass-dpp-modal__footer">' +
      '    <a class="originpass-dpp-modal__cta" data-op-full href="#" target="_blank" rel="noopener noreferrer">Open full passport</a>' +
      "  </div>" +
      "</div>";

    document.body.appendChild(el);

    el.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest("[data-op-close]")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && el.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });

    return el;
  }

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? "hidden" : "";
  }

  function openModal(root) {
    activeRoot = root;
    lastFocus = document.activeElement;
    var modal = ensureModal();
    var accent = root.style.getPropertyValue("--op-custom-accent") || "";
    var text = root.style.getPropertyValue("--op-custom-text") || "";
    var panel = qs(".originpass-dpp-modal__panel", modal);
    if (panel) {
      if (accent) panel.style.setProperty("--op-accent", accent.trim() || null);
      if (text) panel.style.setProperty("--op-accent-text", text.trim() || null);
    }

    var full = qs("[data-op-full]", modal);
    var passportUrl = root.getAttribute("data-passport-url") || "#";
    if (full) {
      full.href = passportUrl;
      full.textContent = root.getAttribute("data-label-open-full") || "Open full passport";
    }

    var closeBtn = qs(".originpass-dpp-modal__close", modal);
    if (closeBtn) {
      closeBtn.setAttribute("aria-label", root.getAttribute("data-label-close") || "Close");
    }

    modal.setAttribute("aria-hidden", "false");
    lockScroll(true);
    if (closeBtn) closeBtn.focus();

    loadSummary(root, modal);
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    lockScroll(false);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    activeRoot = null;
  }

  function renderLoading(modal, root) {
    var body = qs("[data-op-body]", modal);
    if (!body) return;
    body.innerHTML =
      '<p class="originpass-dpp-modal__status">' +
      escapeHtml(root.getAttribute("data-label-loading") || "Loading passport…") +
      "</p>";
  }

  function renderError(modal, root) {
    var body = qs("[data-op-body]", modal);
    if (!body) return;
    body.innerHTML =
      '<p class="originpass-dpp-modal__status" data-state="error">' +
      escapeHtml(root.getAttribute("data-label-error") || "Passport details are unavailable right now.") +
      "</p>";
  }

  function section(label, value) {
    if (!value) return "";
    return (
      '<section class="originpass-dpp-modal__section">' +
      "<h3>" +
      escapeHtml(label) +
      "</h3>" +
      "<p>" +
      escapeHtml(value) +
      "</p>" +
      "</section>"
    );
  }

  function renderSummary(modal, root, data) {
    var body = qs("[data-op-body]", modal);
    var title = qs("#originpass-dpp-modal-title", modal);
    var brand = qs("[data-op-brand]", modal);
    if (!body) return;

    var productTitle = (data && data.productTitle) || "Digital Product Passport";
    if (title) title.textContent = productTitle;

    if (brand) {
      if (data && data.brandName) {
        brand.hidden = false;
        brand.textContent = data.brandName;
      } else {
        brand.hidden = true;
        brand.textContent = "";
      }
    }

    var html = "";
    if (data && data.imageUrl) {
      html +=
        '<img class="originpass-dpp-modal__media" src="' +
        escapeAttr(data.imageUrl) +
        '" alt="" loading="lazy" decoding="async" width="448" height="336" />';
    }

    html += section(root.getAttribute("data-label-story") || "Story", data && data.story);
    html += section(root.getAttribute("data-label-materials") || "Materials", data && data.materials);
    html += section(root.getAttribute("data-label-origin") || "Origin", data && data.productionLocation);
    html += section(root.getAttribute("data-label-care") || "Care", data && data.careInstructions);

    if (!html) {
      renderError(modal, root);
      return;
    }

    body.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function loadSummary(root, modal) {
    var summaryUrl = root.getAttribute("data-summary-url");
    if (!summaryUrl) {
      renderError(modal, root);
      return;
    }

    if (cache[summaryUrl]) {
      renderSummary(modal, root, cache[summaryUrl]);
      return;
    }

    renderLoading(modal, root);

    fetch(summaryUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then(function (data) {
        cache[summaryUrl] = data;
        if (activeRoot === root) renderSummary(modal, root, data);
      })
      .catch(function () {
        if (activeRoot === root) renderError(modal, root);
      });
  }

  function onTriggerClick(e) {
    var root = e.currentTarget.closest(".originpass-dpp");
    if (!root) return;

    var behavior = root.getAttribute("data-click-behavior") || "modal";
    var url = root.getAttribute("data-passport-url");

    if (behavior === "link") {
      if (!url) return;
      var target = root.getAttribute("data-link-target") || "_blank";
      if (target === "_self") {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    e.preventDefault();
    openModal(root);
  }

  function bind(root) {
    if (!root || root.getAttribute("data-op-bound") === "1") return;
    root.setAttribute("data-op-bound", "1");
    var trigger = qs("[data-op-trigger]", root);
    if (!trigger) return;
    trigger.addEventListener("click", onTriggerClick);
  }

  function init() {
    var nodes = document.querySelectorAll(".originpass-dpp");
    for (var i = 0; i < nodes.length; i++) bind(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("shopify:section:load", init);
  document.addEventListener("shopify:block:select", init);
})();
