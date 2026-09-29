(function () {
  "use strict";

  /* Scroll-reveal */
  if (window.AOS) {
    AOS.init({
      duration: 800,
      easing: "ease-out-cubic",
      once: true,
      offset: 60,
      disable: function () {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }
    });
  }

  /* Sticky / transparent-to-solid header */
  var header = document.querySelector(".v2-header");
  function syncHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  /* Mobile nav */
  var toggle = document.getElementById("v2-nav-toggle");
  var mobileNav = document.getElementById("v2-mobile-nav");

  function closeMobileNav() {
    if (!mobileNav || !toggle) return;
    mobileNav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    mobileNav.querySelectorAll(".v2-mobile-nav-toggle").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });
    mobileNav.querySelectorAll(".v2-mobile-submenu.is-open").forEach(function (sub) {
      sub.classList.remove("is-open");
    });
  }
  function openMobileNav() {
    if (!mobileNav || !toggle) return;
    mobileNav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      expanded ? closeMobileNav() : openMobileNav();
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024) closeMobileNav();
    });

    /* Mobile nav submenu accordion (e.g. About > About Us / Leadership) */
    mobileNav.querySelectorAll(".v2-mobile-nav-toggle").forEach(function (btn) {
      var submenu = document.getElementById(btn.getAttribute("aria-controls"));
      if (!submenu) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        submenu.classList.toggle("is-open", !expanded);
      });
    });
  }

  /* Product category tabs */
  var tabButtons = document.querySelectorAll(".v2-tab-btn");
  var panels = document.querySelectorAll(".v2-product-panel");
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

  /* Our Brands category tabs */
  var brandTabButtons = document.querySelectorAll(".v2-brand-tab");
  var brandPanels = document.querySelectorAll(".v2-brand-panel");
  brandTabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-cat");
      brandTabButtons.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      brandPanels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.getAttribute("data-panel") === target);
      });
    });
  });

  /* Hero product/service slider — auto-advancing crossfade with dot nav */
  (function () {
    var slider = document.getElementById("v2-hero-slider");
    if (!slider) return;

    var slides = Array.prototype.slice.call(slider.querySelectorAll(".v2-hero-slide"));
    var dots = Array.prototype.slice.call(slider.querySelectorAll(".v2-hero-dots button"));
    var hoverZone = slider;
    var headline = document.getElementById("v2-hero-headline");
    var lede = document.getElementById("v2-hero-lede");
    var brandTracks = Array.prototype.slice.call(document.querySelectorAll(".v2-hero-brands-track"));
    var seeWorkBtn = document.getElementById("v2-hero-see-work");
    if (!slides.length || !dots.length) return;

    var index = 0;
    var timer = null;

    function goTo(next) {
      if (next === index) return;
      slides[index].classList.remove("is-active");
      dots[index].classList.remove("is-active");
      index = next;
      slides[index].classList.add("is-active");
      dots[index].classList.add("is-active");
      if (headline) {
        var h = dots[index].getAttribute("data-headline");
        if (h) headline.innerHTML = h;
      }
      if (lede) {
        var d = dots[index].getAttribute("data-desc");
        if (d) lede.textContent = d;
      }
      brandTracks.forEach(function (track) {
        track.classList.toggle("is-active", track.getAttribute("data-track") === String(index));
      });
      if (seeWorkBtn) {
        seeWorkBtn.style.display = dots[index].getAttribute("data-hide-cta") === "work" ? "none" : "";
        var workHref = dots[index].getAttribute("data-work-href");
        if (workHref) seeWorkBtn.setAttribute("href", workHref);
      }
    }

    function next() {
      goTo((index + 1) % slides.length);
    }

    function start() {
      if (timer) return;
      timer = setInterval(next, 6500);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        goTo(i);
        stop();
        start();
      });
    });

    hoverZone.addEventListener("mouseenter", stop);
    hoverZone.addEventListener("mouseleave", start);
    hoverZone.addEventListener("touchstart", stop, { passive: true });

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      start();
    }
  })();

  /* Featured-project slider — Slick, one full case study at a time */
  if (window.jQuery && jQuery.fn.slick) {
    jQuery(".v2-case-slick").slick({
      slidesToShow: 1,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 5000,
      speed: 600,
      arrows: false,
      dots: true,
      pauseOnHover: true,
      infinite: true,
      adaptiveHeight: true
    });
  }

  /* Client-showcase category media — Slick, one photo per client, dots + autoplay */
  if (window.jQuery && jQuery.fn.slick) {
    jQuery(".client-media-slick").each(function () {
      var $el = jQuery(this);
      if ($el.hasClass("slick-initialized")) return;
      $el.slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3200,
        speed: 500,
        arrows: false,
        dots: true,
        pauseOnHover: true,
        infinite: true,
        adaptiveHeight: false
      });
      // Guards against a stale/oversized track width if the slider is
      // initialized while its grid column hasn't settled yet (e.g. mobile).
      setTimeout(function () { $el.slick("setPosition"); }, 50);
    });
    jQuery(window).on("resize orientationchange", function () {
      jQuery(".client-media-slick.slick-initialized").slick("setPosition");
    });
  }

  /* FAQ accordion */
  document.querySelectorAll(".v2-faq-item").forEach(function (item) {
    var btn = item.querySelector(".v2-faq-q");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");
      item.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  /* Animated stats — CountUp.js, triggered once the strip enters view */
  function initStats() {
    var statEls = document.querySelectorAll(".stat-number");
    if (!statEls.length) return;

    var CountUpCtor = window.countUp && window.countUp.CountUp;

    function animate(el) {
      if (!el.hasAttribute("data-target")) return;
      var target = parseFloat(el.getAttribute("data-target") || "0");
      var suffixEl = el.parentElement.querySelector(".stat-suffix");
      var suffix = suffixEl ? "" : (el.getAttribute("data-suffix") || "");

      if (CountUpCtor) {
        var counter = new CountUpCtor(el, target, {
          duration: 2.2,
          separator: ",",
          suffix: suffix
        });
        if (!counter.error) {
          counter.start();
          return;
        }
      }
      /* Fallback if CountUp failed to load */
      el.textContent = target + suffix;
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      statEls.forEach(animate);
      return;
    }

    var seen = new WeakSet();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !seen.has(entry.target)) {
          seen.add(entry.target);
          animate(entry.target);
        }
      });
    }, { threshold: 0.4 });

    statEls.forEach(function (el) { observer.observe(el); });
  }
  initStats();

  /* Back to top */
  var toTop = document.getElementById("v2-to-top");
  if (toTop) {
    window.addEventListener("scroll", function () {
      toTop.classList.toggle("is-visible", window.scrollY > 600);
    }, { passive: true });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Lead / contact form -> build a real mailto subject+body from fields */
  document.querySelectorAll('form.v2-form[action^="mailto:"]').forEach(function (form) {
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
})();
