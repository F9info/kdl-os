(function () {
  "use strict";

  /* Scroll-reveal animations (vertical only — fade/zoom up/down, no left/right) */
  if (window.AOS) {
    AOS.init({
      duration: 650,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
      disable: function () {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }
    });
  }

  /* Mobile nav toggle (legacy header — no-ops on pages using the v2 header) */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("main-nav");

  function closeNav() {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  function openNav() {
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      expanded ? closeNav() : openNav();
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024) closeNav();
    });
  }

  /* Sticky header shadow (legacy header — no-ops on pages using the v2 header) */
  var header = document.querySelector(".site-header");
  if (header) {
    window.addEventListener(
      "scroll",
      function () {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
      },
      { passive: true }
    );
  }

  /* Product category tabs */
  var tabButtons = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".product-panel");

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab");

      tabButtons.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");

      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.getAttribute("data-panel") === target);
      });
    });
  });

  /* Hero case-study slider */
  if (window.jQuery) {
    jQuery(".hero-slider").slick({
      slidesToShow: 1,
      slidesToScroll: 1,
      infinite: false,
      autoplay: false,
      arrows: false,
      dots: true,
      speed: 500,
      adaptiveHeight: false
    });
  }

  /* Hero scope tabs: swap the preview image/caption within the active slide */
  function activateScopeTab(tab) {
    var slide = tab.closest(".hero-slide");
    if (!slide) return;

    slide.querySelectorAll(".scope-tab").forEach(function (t) {
      t.classList.remove("is-active");
    });
    tab.classList.add("is-active");

    var img = slide.querySelector("[data-preview-img]");
    var cap = slide.querySelector("[data-preview-cap]");
    if (img) img.src = tab.getAttribute("data-img");
    if (cap) cap.textContent = tab.getAttribute("data-cap");
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".scope-tab");
    if (!tab) return;
    activateScopeTab(tab);
    restartScopeAutoplay(tab.closest(".scope-tabs"));
  });

  /* Auto-advance the scope tabs, one after another, pausing on hover/touch */
  var scopeAutoplayTimers = new WeakMap();

  function startScopeAutoplay(tabsEl) {
    if (!tabsEl || scopeAutoplayTimers.has(tabsEl)) return;
    var timer = setInterval(function () {
      var tabs = Array.prototype.slice.call(tabsEl.querySelectorAll(".scope-tab"));
      if (!tabs.length) return;
      var activeIndex = tabs.findIndex(function (t) { return t.classList.contains("is-active"); });
      var next = tabs[(activeIndex + 1) % tabs.length];
      activateScopeTab(next);
    }, 3200);
    scopeAutoplayTimers.set(tabsEl, timer);
  }

  function stopScopeAutoplay(tabsEl) {
    var timer = scopeAutoplayTimers.get(tabsEl);
    if (timer) {
      clearInterval(timer);
      scopeAutoplayTimers.delete(tabsEl);
    }
  }

  function restartScopeAutoplay(tabsEl) {
    if (!tabsEl) return;
    stopScopeAutoplay(tabsEl);
    startScopeAutoplay(tabsEl);
  }

  document.querySelectorAll(".scope-tabs").forEach(function (tabsEl) {
    startScopeAutoplay(tabsEl);
    tabsEl.addEventListener("mouseenter", function () { stopScopeAutoplay(tabsEl); });
    tabsEl.addEventListener("mouseleave", function () { startScopeAutoplay(tabsEl); });
    tabsEl.addEventListener("touchstart", function () { stopScopeAutoplay(tabsEl); }, { passive: true });
  });

  /* Villa project gallery slick slider */
  if (window.jQuery) {
    jQuery(".villa-gallery-slider").slick({
      slidesToShow: 3,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 3200,
      speed: 600,
      arrows: false,
      dots: true,
      pauseOnHover: true,
      infinite: true,
      responsive: [
        { breakpoint: 1024, settings: { slidesToShow: 2 } },
        { breakpoint: 640, settings: { slidesToShow: 1 } }
      ]
    });
  }

  /* Villa testimonial quote slider */
  if (window.jQuery) {
    jQuery(".quote-slider").slick({
      slidesToShow: 1,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 5000,
      speed: 500,
      arrows: false,
      dots: true,
      pauseOnHover: true,
      infinite: true,
      adaptiveHeight: true
    });
  }

  /* Clients slick slider */
  if (window.jQuery) {
    jQuery(".client-slider").slick({
      slidesToShow: 4,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 2200,
      speed: 600,
      arrows: false,
      dots: true,
      pauseOnHover: true,
      infinite: true,
      responsive: [
        { breakpoint: 1024, settings: { slidesToShow: 3 } },
        { breakpoint: 640, settings: { slidesToShow: 2 } }
      ]
    });
  }

  /* Our Brands — category filter grid */
  var brandFilterBtns = document.querySelectorAll(".brand-filter-btn");
  var brandItems = document.querySelectorAll(".brand-grid .brand-logo");
  brandFilterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-brand-filter");

      brandFilterBtns.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");

      brandItems.forEach(function (item) {
        item.hidden = !(target === "all" || item.getAttribute("data-category") === target);
      });
    });
  });

  /* Back to top (legacy header — no-ops on pages using the v2 header) */
  var toTop = document.getElementById("to-top");
  if (toTop) {
    window.addEventListener(
      "scroll",
      function () {
        toTop.classList.toggle("is-visible", window.scrollY > 600);
      },
      { passive: true }
    );
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Lead / contact forms — mail clients only read a mailto link's own
     "subject" and "body" params (RFC 6068), not arbitrary field names
     like Name= or Phone=, so a plain method="get" submit to a mailto:
     action opens an empty email. Build subject/body from the fields
     ourselves so the enquiry details actually reach the inbox. */
  document.querySelectorAll('form.contact-form[action^="mailto:"]').forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var address = form.getAttribute("action").replace("mailto:", "");
      var lines = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
        var value = (el.value || "").trim();
        if (!value) return;
        lines.push(el.name + ": " + value);
      });
      var subject = "New website enquiry — Subhadra Group";
      var body = lines.join("\n");
      window.location.href = "mailto:" + address + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  });

  /* Product gallery click-to-zoom lightbox */
  var galleryItems = document.querySelectorAll("[data-full]");
  var lightbox = document.getElementById("lightbox");
  if (galleryItems.length && lightbox) {
    var lightboxImg = document.getElementById("lightbox-img");
    var lightboxTitle = document.getElementById("lightbox-title");
    var lightboxClose = document.getElementById("lightbox-close");

    function openLightbox(src, title) {
      lightboxImg.src = src;
      lightboxImg.alt = title;
      lightboxTitle.textContent = title;
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    }

    galleryItems.forEach(function (item) {
      item.addEventListener("click", function () {
        openLightbox(item.getAttribute("data-full"), item.getAttribute("data-title"));
      });
    });
    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }

  /* Video testimonial modal */
  var videoTestiButtons = document.querySelectorAll(".btn-video-testi");
  var videoTestiModal = document.getElementById("video-testi-modal");
  if (videoTestiButtons.length && videoTestiModal) {
    var videoTestiTitle = document.getElementById("video-testi-title");
    var videoTestiClose = document.getElementById("video-testi-close");

    function openVideoTesti(title) {
      videoTestiTitle.textContent = title || "Video Testimonial";
      videoTestiModal.classList.add("is-open");
      videoTestiModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function closeVideoTesti() {
      videoTestiModal.classList.remove("is-open");
      videoTestiModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    videoTestiButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        openVideoTesti(btn.getAttribute("data-video-title"));
      });
    });
    videoTestiClose.addEventListener("click", closeVideoTesti);
    videoTestiModal.addEventListener("click", function (e) {
      if (e.target === videoTestiModal) closeVideoTesti();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeVideoTesti();
    });
  }
})();
