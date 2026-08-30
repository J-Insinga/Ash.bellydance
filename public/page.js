"use strict";

(() => {
  const header = document.getElementById("siteHeader");
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.getElementById("mainNav");
  const revealElements = document.querySelectorAll(".reveal");

  function updateMenu() {
    const open = mainNav?.classList.contains("mobile-open") || false;
    menuToggle?.setAttribute("aria-expanded", String(open));
    const tr = typeof window.BYFIGGY_T === "function" ? window.BYFIGGY_T : ((k, f) => f || k);
    menuToggle?.setAttribute("aria-label", open ? tr("closeMenu", "Fermer le menu") : tr("openMenu", "Ouvrir le menu"));
  }

  menuToggle?.addEventListener("click", () => {
    mainNav?.classList.toggle("mobile-open");
    updateMenu();
  });

  mainNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("mobile-open");
      updateMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      mainNav?.classList.remove("mobile-open");
      updateMenu();
    }
  });

  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealElements.forEach((el) => observer.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add("is-visible"));
  }
  updateMenu();
})();
