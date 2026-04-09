/* global Vimeo */

(() => {
  const iframe = document.getElementById("heroVideo");
  const iframePreview = document.getElementById("heroVideoPreview");
  const buttons = Array.from(document.querySelectorAll(".js-soundToggle"));

  if (!iframe || buttons.length === 0 || typeof Vimeo === "undefined") return;

  let players;
  try {
    players = [new Vimeo.Player(iframe)];
    if (iframePreview) players.push(new Vimeo.Player(iframePreview));
  } catch (e) {
    console.warn("Vimeo Player init skipped:", e);
    return;
  }

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

  // About cards "reveal" animation controls `transform`.
  // Parallax would overwrite it and break the slide effect, so disable parallax for cards.
  return;

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

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    cards.forEach((card) => {
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    });
    return;
  }

  const totalCards = cards.length;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  let revealed = false;

  const update = () => {
    const rect = about.getBoundingClientRect();
    const viewH = window.innerHeight;

    // Cards sit in the bottom ~half of the section.
    // Use the midpoint of the section as the trigger reference.
    const cardZoneTop = rect.top + rect.height * 0.4;

    // Progress: 0 when cardZoneTop enters bottom of viewport,
    // 1 when cardZoneTop reaches 30% from top.
    let progress = (viewH - cardZoneTop) / (viewH * 0.7);
    progress = Math.max(0, Math.min(1, progress));

    // Once fully revealed, stop updating to avoid flicker on scroll back.
    if (progress >= 1 && !revealed) {
      revealed = true;
    }

    if (revealed) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      });
      return;
    }

    cards.forEach((card, i) => {
      // Stagger: each card starts a bit later.
      const start = (i / totalCards) * 0.6;
      const end = start + 0.5;
      let local = (progress - start) / (end - start);
      local = Math.max(0, Math.min(1, local));
      const eased = smoothstep(local);

      const y = (1 - eased) * 50;
      card.style.opacity = String(eased);
      card.style.transform = "translateY(" + y.toFixed(1) + "px)";
    });
  };

  const tick = () => {
    update();
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
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

/* ===== Typewriter — about lead (removed) ===== */

/* ===== Scroll reveal — formats items + target cards ===== */
(() => {
  const items = document.querySelectorAll(".formats__item, .target__card, .guide__content");
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        } else {
          entry.target.classList.remove("is-visible");
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
  );

  items.forEach((item) => observer.observe(item));
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

/* ===== Typewriter — about__lead ===== */
(() => {
  const el = document.querySelector(".about__lead");
  if (!el) return;

  const fullText = el.textContent;
  const charDelayMs = 6;
  let animId = 0;
  let hasPlayed = false;

  // Fix height after fonts are loaded to prevent layout shift
  const fixHeight = () => {
    el.textContent = fullText;
    el.style.minHeight = el.offsetHeight + "px";
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fixHeight);
  } else {
    window.addEventListener("load", fixHeight);
  }

  const typewrite = () => {
    if (hasPlayed) return;
    hasPlayed = true;
    const id = ++animId;
    // Re-measure after fonts
    el.style.minHeight = el.offsetHeight + "px";
    el.textContent = "";
    let i = 0;
    const tick = () => {
      if (id !== animId) return;
      if (i < fullText.length) {
        el.textContent += fullText[i];
        i++;
        setTimeout(tick, charDelayMs);
      }
    };
    tick();
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        typewrite();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(el);
})();

/* ===== About Slider — popup open/close ===== */
(() => {
  const backdrop = document.getElementById("aboutSliderBackdrop");
  const popup = document.getElementById("aboutSlider");
  const openBtn = document.querySelector('[data-open-popup="aboutSlider"]');
  const closeBtn = popup && popup.querySelector(".aboutSlider__close");
  if (!backdrop || !popup || !openBtn || !closeBtn) return;

  const header = document.querySelector(".siteHeader");
  const sideNav = document.querySelector(".sideNav");

  const open = () => {
    backdrop.classList.add("aboutSlider__backdrop--open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (header) header.style.display = "none";
    if (sideNav) sideNav.style.display = "none";
  };

  const close = () => {
    backdrop.classList.remove("aboutSlider__backdrop--open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (header) header.style.display = "";
    if (sideNav) sideNav.style.display = "";
  };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  // Клик по backdrop (вне попапа) закрывает
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("aboutSlider__backdrop--open")) close();
  });
})();

/* ===== About Slider — arrow, swipe, counter ===== */
(() => {
  const track = document.querySelector(".aboutSlider__track");
  const arrow = document.querySelector(".aboutSlider__arrow");
  const counter = document.querySelector(".aboutSlider__counter");
  const cards = document.querySelectorAll(".aboutSlider__card");
  if (!track || !arrow || !cards.length) return;

  const total = cards.length;

  const updateCounter = () => {
    if (!counter) return;
    const cardW = cards[0].offsetWidth + 20; // width + gap
    const idx = Math.round(track.scrollLeft / cardW) + 1;
    const current = Math.min(idx, total);
    counter.textContent =
      String(current).padStart(2, "0") + " / " + String(total).padStart(2, "0");
  };

  // Arrow click
  arrow.addEventListener("click", () => {
    const cardW = cards[0].offsetWidth + 20;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (track.scrollLeft >= maxScroll - 10) {
      track.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      track.scrollBy({ left: cardW, behavior: "smooth" });
    }
  });

  // Update counter on scroll
  track.addEventListener("scroll", updateCounter, { passive: true });

  // Touch swipe (native scroll already works, just ensure grab drag for mouse)
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  track.addEventListener("mousedown", (e) => {
    isDown = true;
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
    track.style.scrollBehavior = "auto";
  });

  track.addEventListener("mouseleave", () => { isDown = false; });
  track.addEventListener("mouseup", () => {
    isDown = false;
    track.style.scrollBehavior = "smooth";
  });

  track.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.5;
    track.scrollLeft = scrollLeft - walk;
  });

  // Equalise card heights
  const equaliseCards = () => {
    cards.forEach((c) => (c.style.height = "auto"));
    let maxH = 0;
    cards.forEach((c) => { if (c.scrollHeight > maxH) maxH = c.scrollHeight; });
    cards.forEach((c) => (c.style.minHeight = maxH + "px"));
  };

  equaliseCards();
  window.addEventListener("resize", equaliseCards);
  updateCounter();
})();
