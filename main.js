// Blueprint portfolio — boot sequence, reveals, nav, HUD, ruler,
// pencil cursor trail, decode-scramble titles, card tilt, stamp easter egg

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

/* ============ Plotter boot sequence ============ */
// Plays once per session; everything hero-side waits for bootDone.
const bootEl = document.getElementById("boot");
let bootSeen = false;
try { bootSeen = sessionStorage.getItem("booted") === "1"; } catch (e) { /* storage blocked */ }

const bootDone = new Promise((resolve) => {
  const finish = () => {
    document.body.classList.add("booted");
    resolve();
  };
  if (!bootEl || reducedMotion || bootSeen) {
    if (bootEl) bootEl.remove();
    finish();
    return;
  }
  try { sessionStorage.setItem("booted", "1"); } catch (e) { /* storage blocked */ }
  requestAnimationFrame(() => {
    document.getElementById("bootFill").classList.add("is-run");
  });
  setTimeout(() => bootEl.classList.add("is-done"), 950);
  setTimeout(() => { bootEl.remove(); finish(); }, 1450);
  // Safety: never leave the page hidden if transitions stall
  setTimeout(finish, 2500);
});

/* ============ Hero role: word-by-word rise ============ */
// Wrap each word in a delayed span; the paragraph then builds itself
// after the stamp lands. Takes over from the generic reveal.
if (!reducedMotion) {
  const role = document.querySelector(".hero-role");
  if (role) {
    role.classList.remove("reveal");
    let wi = 0;
    const wrapWords = (textNode) => {
      const frag = document.createDocumentFragment();
      for (const part of textNode.textContent.split(/(\s+)/)) {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); continue; }
        const s = document.createElement("span");
        s.className = "w";
        s.style.setProperty("--wi", wi++);
        s.textContent = part;
        frag.appendChild(s);
      }
      textNode.replaceWith(frag);
    };
    [...role.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) wrapWords(n);
      else if (n.nodeType === Node.ELEMENT_NODE) {
        n.classList.add("w");
        n.style.setProperty("--wi", wi++);
      }
    });
  }
}

/* ============ Grid drift: the paper moves under the drawing ============ */
if (!reducedMotion) {
  window.addEventListener("scroll", () => {
    // modulo the 100px major-grid period so the offset never grows
    document.documentElement.style.setProperty(
      "--grid-drift", `${-((window.scrollY * 0.06) % 100).toFixed(2)}px`
    );
  }, { passive: true });
}

/* ============ Mobile menu ============ */
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

links.addEventListener("click", (e) => {
  if (e.target.matches(".nav-link")) {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

/* ============ Decode-scramble text ============ */
// Characters resolve left-to-right like a document being declassified.
const SCRAMBLE_CHARS = "▪▫/\\|=+<>#_0123456789ABCDEF";
function scrambleText(el, duration = 650) {
  if (reducedMotion) return;
  // generation token: a newer call supersedes any scramble still running,
  // so rapid updates (e.g. the HUD) never resolve to a stale value
  const gen = (el._scrambleGen = (el._scrambleGen || 0) + 1);
  const final = el.textContent;
  el.setAttribute("aria-label", final);
  const start = performance.now();
  (function frame(now) {
    if (el._scrambleGen !== gen) return;
    const p = Math.min(1, (now - start) / duration);
    const settled = Math.floor(final.length * p);
    let out = final.slice(0, settled);
    for (let i = settled; i < final.length; i++) {
      out += final[i] === " " ? " "
        : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(frame);
    else {
      el.textContent = final;
      el.removeAttribute("aria-label");
    }
  })(start);
}

/* ============ Scroll reveal ============ */
// In-view elements reveal after boot with a stagger; the observer handles
// the rest. Never depends on IntersectionObserver firing for first paint.
function onRevealed(el) {
  if (el.matches(".titleblock")) {
    const title = el.querySelector(".tb-title");
    if (title) scrambleText(title, 700);
  }
  if (el.matches(".hero-eyebrow")) scrambleText(el, 800);
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    let batch = 0;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.transitionDelay = `${batch++ * 80}ms`;
        el.classList.add("is-visible");
        onRevealed(el);
        revealObserver.unobserve(el);
      }
    }
  },
  { threshold: 0.12 }
);

const initialReveals = [];
document.querySelectorAll(".reveal").forEach((el) => {
  const rect = el.getBoundingClientRect();
  const inView = rect.top < window.innerHeight && rect.bottom > 0;
  if (inView) initialReveals.push(el);
  else revealObserver.observe(el);
});

bootDone.then(() => {
  initialReveals.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add("is-visible");
      onRevealed(el);
    }, 150 + i * 110);
  });
});

/* ============ Active section → nav, HUD, 3D formation ============ */
const SHEETS = {
  home: ["SHEET 01 — HOME", "STRUCT — AVL TREE · SEARCH"],
  about: ["SHEET 02 — ABOUT", "STRUCT — LINKED LIST · TRAVERSAL"],
  projects: ["SHEET 03 — PROJECTS", "STRUCT — GRAPH · BFS"],
  skills: ["SHEET 04 — SKILLS", "STRUCT — ARRAY · BUBBLE SORT"],
  resume: ["SHEET 05 — RESUME", "STRUCT — QUEUE · FIFO"],
  contact: ["SHEET 06 — CONTACT", "STRUCT — SPIRAL"],
};
const hudSheet = document.getElementById("hudSheet");
const hudStruct = document.getElementById("hudStruct");
const navLinks = [...document.querySelectorAll(".nav-link")];

const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((link) =>
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`)
        );
        if (SHEETS[id]) {
          if (hudSheet) hudSheet.textContent = SHEETS[id][0];
          if (hudStruct && hudStruct.textContent !== SHEETS[id][1]) {
            hudStruct.textContent = SHEETS[id][1];
            scrambleText(hudStruct, 400);
          }
          document.title = `${SHEETS[id][0]} · CSE @ NITJ`;
        }
        // tell the 3D scene which structure to morph into
        document.dispatchEvent(new CustomEvent("sheetchange", { detail: { id } }));
      }
    }
  },
  { rootMargin: "-40% 0px -55% 0px" }
);
document.querySelectorAll("section[id]").forEach((s) => sectionObserver.observe(s));

/* ============ HUD cursor coordinates ============ */
const hudXY = document.getElementById("hudXY");
if (hudXY && finePointer) {
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
  window.addEventListener("pointermove", (e) => {
    hudXY.textContent = `X ${pad(e.clientX)} · Y ${pad(e.clientY)}`;
  }, { passive: true });
}

/* ============ Margin ruler: scroll gauge ============ */
const rulerMarker = document.getElementById("rulerMarker");
const rulerPct = document.getElementById("rulerPct");
if (rulerMarker && rulerPct) {
  const updateRuler = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    const track = rulerMarker.parentElement.clientHeight - rulerMarker.clientHeight;
    rulerMarker.style.transform = `translateY(${(p * track).toFixed(1)}px)`;
    rulerPct.textContent = `${String(Math.round(p * 100)).padStart(3, "0")}%`;
  };
  window.addEventListener("scroll", updateRuler, { passive: true });
  window.addEventListener("resize", updateRuler, { passive: true });
  updateRuler();
}

/* ============ Pencil cursor trail ============ */
// A graphite line follows the cursor and evaporates, like sketching on
// the blueprint. Desktop fine-pointer only.
const trailCanvas = document.getElementById("trail");
if (trailCanvas && finePointer && !reducedMotion && window.innerWidth >= 1024) {
  const ctx = trailCanvas.getContext("2d");
  const LIFE = 0.8; // seconds a segment survives
  let points = [];
  let running = false;

  const sizeTrail = () => {
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
  };
  sizeTrail();
  window.addEventListener("resize", sizeTrail, { passive: true });

  window.addEventListener("pointermove", (e) => {
    points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (!running) { running = true; requestAnimationFrame(draw); }
  }, { passive: true });

  function draw(now) {
    ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    points = points.filter((p) => now - p.t < LIFE * 1000);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (b.t - a.t > 90) continue; // pen lifted
      const age = (now - b.t) / (LIFE * 1000);
      ctx.strokeStyle = `rgba(255, 194, 75, ${(0.4 * (1 - age)).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // drafting crosshair at the pen tip
    const tip = points[points.length - 1];
    if (tip && now - tip.t < 300) {
      ctx.strokeStyle = "rgba(255, 194, 75, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tip.x - 7, tip.y); ctx.lineTo(tip.x - 2, tip.y);
      ctx.moveTo(tip.x + 2, tip.y); ctx.lineTo(tip.x + 7, tip.y);
      ctx.moveTo(tip.x, tip.y - 7); ctx.lineTo(tip.x, tip.y - 2);
      ctx.moveTo(tip.x, tip.y + 2); ctx.lineTo(tip.x, tip.y + 7);
      ctx.stroke();
    }
    if (points.length) requestAnimationFrame(draw);
    else { running = false; ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height); }
  }
} else if (trailCanvas) {
  trailCanvas.remove();
}

/* ============ Plotter-head sweep on nav jumps ============ */
const sweep = document.getElementById("sweep");
if (sweep && !reducedMotion) {
  document.querySelectorAll('.nav-link, .nav-brand, a[href^="#"].btn, .hero-scroll').forEach((a) => {
    a.addEventListener("click", () => {
      sweep.classList.remove("is-run");
      void sweep.offsetWidth; // restart the animation
      sweep.classList.add("is-run");
    });
  });
} else if (sweep) {
  sweep.remove();
}

/* ============ Magnetic buttons ============ */
// CTAs lean toward a nearby cursor, like the pen pulling to a snap point.
if (finePointer && !reducedMotion) {
  const magnets = [...document.querySelectorAll(".btn")];
  const RANGE = 90, PULL = 0.22, MAX_SHIFT = 7;
  window.addEventListener("pointermove", (e) => {
    for (const btn of magnets) {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const reach = RANGE + Math.max(r.width, r.height) / 2;
      if (d < reach) {
        const tx = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dx * PULL));
        const ty = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy * PULL));
        btn.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
      } else if (btn.style.transform) {
        btn.style.transform = "";
      }
    }
  }, { passive: true });
}

/* ============ Stamp easter egg ============ */
// Clicking [REDACTED] gets you nowhere — officially.
const stamp = document.querySelector(".redacted");
if (stamp) {
  let tries = 0;
  let toast = null;
  let hideTimer = null;
  stamp.addEventListener("click", () => {
    tries++;
    stamp.classList.remove("denied");
    void stamp.offsetWidth; // restart the shake animation
    stamp.classList.add("denied");
    if (!toast) {
      toast = document.createElement("span");
      toast.className = "stamp-toast";
      stamp.closest(".hero-name").appendChild(toast);
    }
    toast.textContent = tries < 5 ? "ACCESS DENIED" : "NICE TRY — IDENTITY STAYS CLASSIFIED";
    toast.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove("show"), 1400);
  });
}

/* ============ 3D tilt + glare on project cards ============ */
if (finePointer && !reducedMotion) {
  const MAX_TILT = 6;
  document.querySelectorAll(".project-card:not(.is-slot)").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * MAX_TILT;
      const ry = (px - 0.5) * MAX_TILT;
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      card.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      card.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

/* ============ Resume guard: friendly toast until the PDF exists ============ */
const resumeBtn = document.querySelector('a[href="resume.pdf"]');
if (resumeBtn) {
  let missing = false;
  fetch("resume.pdf", { method: "HEAD" })
    .then((r) => { missing = !r.ok; })
    .catch(() => { missing = true; });
  resumeBtn.addEventListener("click", (e) => {
    if (!missing) return;
    e.preventDefault();
    let toast = resumeBtn.parentElement.querySelector(".doc-toast");
    if (!toast) {
      toast = document.createElement("span");
      toast.className = "doc-toast";
      toast.textContent = "DOCUMENT PENDING — RESUME.PDF NOT YET FILED";
      resumeBtn.parentElement.insertBefore(toast, resumeBtn.nextSibling);
    }
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  });
}

/* ============ Contact form: transmit feedback ============ */
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", () => {
    const btn = contactForm.querySelector('button[type="submit"]');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = "TRANSMITTING …";
    scrambleText(btn, 500);
    setTimeout(() => { btn.textContent = original; }, 2600);
  });
}
