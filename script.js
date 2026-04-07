/* global Vimeo */

(() => {
  const iframe = document.getElementById("heroVideo");
  const iframePreview = document.getElementById("heroVideoPreview");
  const buttons = Array.from(document.querySelectorAll(".js-soundToggle"));

  if (!iframe || buttons.length === 0 || typeof Vimeo === "undefined") return;

  const players = [new Vimeo.Player(iframe)];
  if (iframePreview) players.push(new Vimeo.Player(iframePreview));

  // Keep background + preview in sync (best-effort).
  const SYNC_THRESHOLD_S = 0.18;
  const SYNC_INTERVAL_MS = 500;

  const sync = {
    intervalId: 0,
    running: false,
  };

  const safe = async (fn) => {
    try {
      return await fn();
    } catch {
      return undefined;
    }
  };

  const startSyncIfNeeded = () => {
    if (players.length < 2 || sync.running) return;
    sync.running = true;

    const master = players[0];
    const slave = players[1];

    const tick = async () => {
      const [tMaster, tSlave] = await Promise.all([safe(() => master.getCurrentTime()), safe(() => slave.getCurrentTime())]);
      if (typeof tMaster !== "number" || typeof tSlave !== "number") return;
      const drift = tSlave - tMaster;
      if (Math.abs(drift) > SYNC_THRESHOLD_S) {
        await safe(() => slave.setCurrentTime(tMaster));
      }
    };

    sync.intervalId = window.setInterval(tick, SYNC_INTERVAL_MS);

    master.on("play", () => {
      void safe(() => slave.play());
    });
    master.on("pause", () => {
      void safe(() => slave.pause());
    });

    // Initial alignment after both are ready.
    (async () => {
      await Promise.all([safe(() => master.ready()), safe(() => slave.ready())]);
      const t = await safe(() => master.getCurrentTime());
      if (typeof t === "number") {
        await safe(() => slave.setCurrentTime(t));
      }
      const paused = await safe(() => master.getPaused());
      if (paused === false) void safe(() => slave.play());
    })();
  };

  const setUiMuted = (muted) => {
    const isMuted = Boolean(muted);
    for (const btn of buttons) {
      btn.setAttribute("aria-pressed", String(!isMuted));
      btn.setAttribute("aria-label", isMuted ? "Включить звук" : "Выключить звук");
    }
  };

  const setMutedAll = async (muted) => {
    await Promise.allSettled(players.map((p) => p.setMuted(muted)));
  };

  const setVolumeAll = async (vol) => {
    await Promise.allSettled(players.map((p) => p.setVolume(vol)));
  };

  const ensureMuted = async () => {
    try {
      await setMutedAll(true);
      setUiMuted(true);
    } catch {
      setUiMuted(true);
    }
  };

  ensureMuted();

  players[0].on("loaded", async () => {
    try {
      const muted = await players[0].getMuted();
      setUiMuted(muted);
    } catch {
      setUiMuted(true);
    }
  });

  // Start sync once the first player is loaded.
  players[0].on("loaded", startSyncIfNeeded);

  const toggle = async () => {
    try {
      const muted = await players[0].getMuted();
      if (muted) {
        await setMutedAll(false);
        await setVolumeAll(1);
        setUiMuted(false);
      } else {
        await setMutedAll(true);
        setUiMuted(true);
      }
    } catch {
      setUiMuted(true);
    }
  };

  for (const btn of buttons) {
    btn.addEventListener("click", toggle);
  }
})();

/* ===== Burger menu ===== */
(() => {
  const openBtn = document.querySelector(".iconBtn--menu");
  const overlay = document.querySelector(".js-burgerOverlay");
  const closeBtn = document.querySelector(".js-burgerClose");

  if (!openBtn || !overlay) return;

  const open = () => {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  // Close on link click (nav items + CTA button)
  overlay.querySelectorAll(".burgerOverlay__item, .burgerOverlay__cta").forEach((link) => {
    link.addEventListener("click", close);
  });

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });
})();

/* ===== Accordion — stages section ===== */
(() => {
  const items = document.querySelectorAll(".js-accordion");
  if (!items.length) return;

  items.forEach((item) => {
    const btn = item.querySelector(".stages__header");
    const body = item.querySelector(".stages__body");
    if (!btn || !body) return;

    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      // Close all others
      items.forEach((other) => {
        if (other !== item && other.classList.contains("is-open")) {
          other.classList.remove("is-open");
          const otherBtn = other.querySelector(".stages__header");
          const otherBody = other.querySelector(".stages__body");
          if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          if (otherBody) otherBody.style.maxHeight = "0";
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        body.style.maxHeight = "0";
      } else {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });
})();

/* ===== Slider — example section ===== */
(() => {
  const card = document.querySelector(".example__card");
  const slides = document.querySelectorAll(".example__slide");
  const prevBtn = document.querySelector(".js-exPrev");
  const nextBtn = document.querySelector(".js-exNext");

  if (!slides.length || !prevBtn || !nextBtn || !card) return;

  let current = 0;

  const show = (index) => {
    slides.forEach((s) => s.classList.remove("is-active"));
    current = (index + slides.length) % slides.length;
    slides[current].classList.add("is-active");
  };

  prevBtn.addEventListener("click", () => show(current - 1));
  nextBtn.addEventListener("click", () => show(current + 1));

  // Swipe support
  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  card.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  card.addEventListener("touchend", (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) show(current + 1);
    else show(current - 1);
  }, { passive: true });
})();

/* ===== Parallax — about cards (≥768px) ===== */
(() => {
  if (window.innerWidth < 768) return;

  const section = document.querySelector(".about");
  if (!section) return;

  const cards = [
    { el: document.querySelector(".about__card--1"), speed: 0.02 },
    { el: document.querySelector(".about__card--2"), speed: 0.04 },
    { el: document.querySelector(".about__card--3"), speed: 0.06 },
    { el: document.querySelector(".about__card--4"), speed: 0.08 },
    { el: document.querySelector(".about__card--5"), speed: 0.10 },
  ].filter((c) => c.el);

  if (cards.length === 0) return;

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const windowH = window.innerHeight;

      // Only apply when section is in or near the viewport
      if (sectionTop < windowH && rect.bottom > 0) {
        const scrolled = windowH - sectionTop;
        for (const card of cards) {
          const offset = -(scrolled * card.speed);
          card.el.style.transform = `translateY(${offset}px)`;
        }
      }

      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // initial check
})();

/* ===== Smooth bg-1 → bg-red transition (single overlay) ===== */
(() => {
  const redLayer = document.querySelector(".bgLayer--red");
  const first = document.querySelector(".about");
  const last = document.querySelector(".formats");

  if (!redLayer || !first || !last) return;

  redLayer.style.opacity = "0";
  let prevOpacity = "0";

  const update = () => {
    const wh = window.innerHeight;
    const firstRect = first.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();

    const startY = firstRect.top + firstRect.height / 2;
    const endY = lastRect.top + lastRect.height / 2;
    const range = endY - startY;

    if (range !== 0) {
      const viewMid = wh / 2;
      const progress = Math.max(0, Math.min(1, (viewMid - startY) / range));
      const val = progress.toFixed(3);

      if (val !== prevOpacity) {
        redLayer.style.opacity = val;
        prevOpacity = val;
      }
    }
  };

  // rAF loop for smooth updates
  const tick = () => { update(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  // Fallback: setInterval for environments where rAF may not fire
  setInterval(update, 50);

  // Also listen to all scroll targets
  const handler = () => requestAnimationFrame(update);
  window.addEventListener("scroll", handler, { passive: true });
  document.addEventListener("scroll", handler, { passive: true });
  document.body.addEventListener("scroll", handler, { passive: true });
  window.addEventListener("resize", handler, { passive: true });

  update();
})();

/* ===== FAQ accordion ===== */
(() => {
  const items = document.querySelectorAll(".faq__item");
  if (!items.length) return;

  items.forEach((item) => {
    const header = item.querySelector(".faq__header");
    const body = item.querySelector(".faq__body");
    if (!header || !body) return;

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      // Close all other items
      items.forEach((other) => {
        if (other !== item && other.classList.contains("is-open")) {
          other.classList.remove("is-open");
          other.querySelector(".faq__header").setAttribute("aria-expanded", "false");
          other.querySelector(".faq__body").style.maxHeight = "0";
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove("is-open");
        header.setAttribute("aria-expanded", "false");
        body.style.maxHeight = "0";
      } else {
        item.classList.add("is-open");
        header.setAttribute("aria-expanded", "true");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });
})();

/* ===== Scroll reveal — about cards (scroll-driven) ===== */
(() => {
  if (window.innerWidth < 768) return;

  const about = document.querySelector(".about");
  const cards = document.querySelectorAll(".about__card");
  if (!about || !cards.length) return;

  const totalCards = cards.length;

  const update = () => {
    const rect = about.getBoundingClientRect();
    const viewH = window.innerHeight;

    // Section not in view — hide all
    if (rect.bottom < 0 || rect.top > viewH) {
      cards.forEach((card) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(50px)";
      });
      return;
    }

    // Progress: 0 when section top enters bottom of viewport,
    //           1 when section top reaches ~40% from top
    const progress = Math.max(0, Math.min(1, (viewH - rect.top) / (viewH * 0.7)));

    cards.forEach((card, i) => {
      // Each card has its own range within the overall progress
      const cardStart = i / (totalCards + 1);
      const cardEnd = (i + 1.5) / (totalCards + 1);
      const cardProgress = Math.max(0, Math.min(1, (progress - cardStart) / (cardEnd - cardStart)));

      // Eased progress for smoother feel
      const eased = cardProgress * cardProgress * (3 - 2 * cardProgress); // smoothstep

      const y = (1 - eased) * 50;
      card.style.opacity = eased.toFixed(3);
      card.style.transform = "translateY(" + y.toFixed(1) + "px)";
    });
  };

  // rAF loop — same pattern as other scroll animations
  const tick = () => { update(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setInterval(update, 50);
  update();
})();

/* ===== Parallax — guide section background ===== */
(() => {
  const guide = document.querySelector(".guide");
  const bgImg = document.querySelector(".guide__bg img");
  if (!guide || !bgImg) return;
  if (window.innerWidth < 768) return;

  const speed = 2.5;
  let prevShift = "";

  const update = () => {
    const rect = guide.getBoundingClientRect();
    const viewH = window.innerHeight;

    if (rect.bottom >= 0 && rect.top <= viewH) {
      const progress = (viewH - rect.top) / (viewH + rect.height);
      const shift = ((progress - 0.5) * 20 * speed).toFixed(3);

      if (shift !== prevShift) {
        bgImg.style.transform = "translateY(" + shift + "%)";
        prevShift = shift;
      }
    }
  };

  // rAF loop — same pattern as background transition
  const tick = () => { update(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  // Fallback
  setInterval(update, 50);

  update();
})();

/* ===== Parallax — author background ===== */
(() => {
  const section = document.querySelector(".author");
  const bgImg = document.querySelector(".author__bgImg");
  if (!section || !bgImg) return;
  if (window.innerWidth < 768) return;

  const speed = 1.25;
  let prevShift = "";

  const update = () => {
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;

    if (rect.bottom >= 0 && rect.top <= viewH) {
      const progress = (viewH - rect.top) / (viewH + rect.height);
      const shift = ((progress - 0.5) * 20 * speed).toFixed(3);

      if (shift !== prevShift) {
        bgImg.style.transform = "translateY(" + shift + "%)";
        prevShift = shift;
      }
    }
  };

  const tick2 = () => { update(); requestAnimationFrame(tick2); };
  requestAnimationFrame(tick2);
  setInterval(update, 50);
  update();
})();

/* ===== FAQ/Contacts background video visibility ===== */
(() => {
  const videoBg = document.querySelector(".faqBgVideo");
  const faq = document.querySelector(".faq");
  const contacts = document.querySelector(".contacts");
  if (!videoBg || !faq) return;

  videoBg.style.opacity = "0";
  videoBg.style.transition = "opacity 0.5s ease";

  const update = () => {
    const faqRect = faq.getBoundingClientRect();
    const contactsRect = contacts ? contacts.getBoundingClientRect() : faqRect;
    const viewH = window.innerHeight;

    const topEdge = faqRect.top;
    const bottomEdge = contacts ? contactsRect.bottom : faqRect.bottom;
    const visible = topEdge < viewH && bottomEdge > 0;

    videoBg.style.opacity = visible ? "1" : "0";
  };

  const tick3 = () => { update(); requestAnimationFrame(tick3); };
  requestAnimationFrame(tick3);
  setInterval(update, 50);
  update();
})();

/* ===== Scroll reveal — target rows (pairs) ===== */
(() => {
  const section = document.querySelector(".target");
  const rows = document.querySelectorAll(".target__row");
  if (!section || !rows.length) return;

  // Initial state
  rows.forEach((row) => {
    row.style.opacity = "0";
    row.style.transform = "translateY(40px)";
    row.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  rows.forEach((row, i) => {
    row.style.transitionDelay = (i * 0.15) + "s";
    observer.observe(row);
  });
})();

/* ===== Parallax — about section cards ===== */
(() => {
  if (window.innerWidth < 768) return;

  const about = document.querySelector(".about");
  const lead = document.querySelector(".about__lead");
  if (!about || !lead) return;

  const speed = 0.3;
  let prevShift = "";

  const update = () => {
    const rect = about.getBoundingClientRect();
    const viewH = window.innerHeight;

    if (rect.bottom >= 0 && rect.top <= viewH) {
      const progress = (viewH - rect.top) / (viewH + rect.height);
      const shift = ((progress - 0.5) * 15 * speed).toFixed(3);

      if (shift !== prevShift) {
        lead.style.transform = "translateY(" + shift + "px)";
        prevShift = shift;
      }
    }
  };

  const tick4 = () => { update(); requestAnimationFrame(tick4); };
  requestAnimationFrame(tick4);
  setInterval(update, 50);
  update();
})();

/* ===== Hide side nav when footer is visible ===== */
(() => {
  const nav = document.querySelector(".sideNav");
  const footer = document.querySelector(".footer");
  if (!nav || !footer) return;

  const check = () => {
    const footerRect = footer.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (footerRect.top < viewH) {
      nav.style.opacity = "0";
      nav.style.pointerEvents = "none";
    } else {
      nav.style.opacity = "1";
      nav.style.pointerEvents = "";
    }
  };

  nav.style.transition = "opacity 0.3s ease";
  const tick5 = () => { check(); requestAnimationFrame(tick5); };
  requestAnimationFrame(tick5);
  check();
})();

/* ===== Contacts decor — trigger draw animation on scroll ===== */
(() => {
  const svg = document.querySelector(".contacts__decor-desktop");
  if (!svg) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        svg.classList.add("cd-animate");
        observer.unobserve(svg);
      }
    });
  }, { threshold: 0.15 });

  observer.observe(svg);
})();

/* ===== Side nav — active section highlight (desktop) ===== */
(() => {
  const navItems = document.querySelectorAll(".sideNav__item");
  if (!navItems.length) return;

  const sections = [];
  navItems.forEach((item) => {
    const id = item.getAttribute("href")?.replace("#", "");
    const el = id && document.getElementById(id);
    if (el) sections.push({ id, el, link: item });
  });

  if (!sections.length) return;

  const update = () => {
    const viewH = window.innerHeight;
    const threshold = viewH * 0.4;
    let activeId = sections[0].id;

    for (const s of sections) {
      if (s.el.getBoundingClientRect().top <= threshold) {
        activeId = s.id;
      }
    }

    navItems.forEach((item) => item.classList.remove("sideNav__item--active"));
    const active = sections.find((s) => s.id === activeId);
    if (active) active.link.classList.add("sideNav__item--active");
  };

  window.addEventListener("scroll", update, { passive: true });
  document.body.addEventListener("scroll", update, { passive: true });
  update();
})();
