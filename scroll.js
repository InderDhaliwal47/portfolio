/*
  Scrollytelling engine — "one continuous drawing".
  GSAP ScrollTrigger drives:
    · pinned hero whose exit pushes the 3D camera through the tree
    · a schematic wire routed + drawn down the entire page, with
      solder joints that light as the trace passes each sheet
    · a pinned horizontal gallery for projects
    · scrubbed text/timeline/contact reveals and giant parallax numbers
    · velocity-reactive skew on section grids
  Desktop + motion-ok only; without it the site falls back to the
  IntersectionObserver reveal system in main.js.
*/
(() => {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  if (reduced || !desktop) return;

  gsap.registerPlugin(ScrollTrigger);

  // hand elements from the reveal system over to GSAP
  const strip = (sel) =>
    document.querySelectorAll(sel).forEach((el) => {
      el.classList.remove("reveal");
      el.classList.add("gs");
    });

  /* ============ HERO: pin + scrub exit, camera dives through ============ */
  window.__camPush = 0;
  gsap.timeline({
    scrollTrigger: {
      trigger: "#home",
      start: "top top",
      end: "+=75%",
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      onUpdate: (self) => { window.__camPush = self.progress; },
    },
  })
    .to(".hero-inner", { yPercent: -16, scale: 0.9, autoAlpha: 0, ease: "power1.in" }, 0)
    .to(".hero-scroll", { autoAlpha: 0 }, 0);

  /* ============ ABOUT: copy scrubs up line-block by line-block ============ */
  strip(".about-copy");
  gsap.utils.toArray("#about .about-copy > *").forEach((el) => {
    gsap.from(el, {
      y: 46,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 94%", end: "top 62%", scrub: 0.6 },
    });
  });

  /* ============ GIANT MARGIN NUMBERS: parallax scrub ============ */
  gsap.utils.toArray(".sec-num").forEach((el) => {
    gsap.fromTo(el, { yPercent: -22 }, {
      yPercent: 26,
      ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
    });
  });

  /* ============ PROJECTS: pinned horizontal gallery ============ */
  const proj = document.getElementById("projects");
  const grid = proj.querySelector(".project-grid");
  const hwrap = proj.querySelector(".hwrap");
  proj.classList.add("h-on");
  strip("#projects .project-card");
  const hAmount = () => Math.max(0, grid.scrollWidth - hwrap.clientWidth);
  gsap.to(grid, {
    x: () => -hAmount(),
    ease: "none",
    scrollTrigger: {
      trigger: proj,
      start: "top top",
      end: () => "+=" + (hAmount() + window.innerHeight * 0.25),
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  /* ============ SKILLS: display line fills with scroll ============ */
  gsap.fromTo(".skills-display .sd-fill",
    { clipPath: "inset(0 100% 0 0)" },
    {
      clipPath: "inset(0 0% 0 0)",
      ease: "none",
      scrollTrigger: { trigger: "#skills", start: "top 70%", end: "top 10%", scrub: 0.6 },
    });

  /* ============ RESUME: timeline draws, entries file in ============ */
  strip(".timeline");
  const timeline = document.querySelector(".timeline");
  gsap.fromTo(timeline, { "--tlp": 0 }, {
    "--tlp": 1,
    ease: "none",
    scrollTrigger: { trigger: timeline, start: "top 82%", end: "bottom 52%", scrub: 0.6 },
  });
  gsap.utils.toArray(".tl-item").forEach((item) => {
    gsap.from(item, {
      x: -44,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { trigger: item, start: "top 92%", end: "top 66%", scrub: 0.6 },
    });
  });

  /* ============ CONTACT: the two halves converge ============ */
  strip(".contact-copy");
  strip(".contact-form");
  gsap.from(".contact-copy", {
    x: -70,
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: { trigger: "#contact .contact-grid", start: "top 90%", end: "top 55%", scrub: 0.7 },
  });
  gsap.from(".contact-form", {
    x: 70,
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: { trigger: "#contact .contact-grid", start: "top 90%", end: "top 55%", scrub: 0.7 },
  });

  /* ============ VELOCITY SKEW: fast scrolling shears the sheets ============ */
  const skewTargets = gsap.utils.toArray(".about-grid, .skills-grid, .resume-grid, .contact-grid");
  if (skewTargets.length) {
    const proxy = { skew: 0 };
    const setter = gsap.quickSetter(skewTargets, "skewY", "deg");
    const clampSkew = gsap.utils.clamp(-1.4, 1.4);
    ScrollTrigger.create({
      onUpdate(self) {
        const v = clampSkew(self.getVelocity() / -350);
        if (Math.abs(v) > Math.abs(proxy.skew)) {
          proxy.skew = v;
          gsap.to(proxy, {
            skew: 0,
            duration: 0.8,
            ease: "power3",
            overwrite: true,
            onUpdate: () => setter(proxy.skew),
          });
        }
      },
    });
  }

  /* ============ THE WIRE: route, draw, light the joints ============ */
  const wire = document.getElementById("wire");
  const wirePath = document.getElementById("wirePath");
  const jointsG = document.getElementById("wireJoints");
  const mainEl = document.querySelector("main");
  let wireLen = 0;
  let jointData = []; // { el, y }

  const relY = (el) => {
    let y = 0, n = el;
    while (n && n !== mainEl) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  };

  function buildWire() {
    if (!wire || !wirePath) return;
    const mw = mainEl.clientWidth;
    const mh = mainEl.scrollHeight;
    wire.setAttribute("viewBox", `0 0 ${mw} ${mh}`);
    wire.setAttribute("width", mw);
    wire.setAttribute("height", mh);

    const cx = mw / 2;
    const hero = document.querySelector(".hero-inner");
    const blocks = gsap.utils.toArray("main .titleblock");
    const seal = document.querySelector(".seal");

    let d = "";
    jointsG.innerHTML = "";
    jointData = [];
    const addJoint = (x, y) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("class", "joint");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", 5);
      jointsG.appendChild(c);
      jointData.push({ el: c, y });
    };

    if (hero) {
      d = `M ${cx} ${relY(hero) + hero.offsetHeight - 30}`;
    } else {
      d = `M ${cx} 0`;
    }

    blocks.forEach((tb, i) => {
      const yc = relY(tb) + tb.offsetHeight / 2;
      const rect = { left: tb.offsetLeft, right: tb.offsetLeft + tb.offsetWidth };
      const sec = tb.closest("section");
      const secX = sec ? relYX(sec) : 0;
      const left = secX + rect.left;
      const right = secX + rect.right;
      const xj = i % 2 === 0 ? Math.max(24, left - 34) : Math.min(mw - 24, right + 34);
      d += ` V ${yc - 70} H ${xj} V ${yc}`;
      addJoint(xj, yc);
      d += ` H ${cx}`;
    });

    if (seal) {
      const sy = relY(seal) + seal.offsetHeight / 2;
      d += ` V ${sy}`;
      addJoint(cx, sy);
    } else {
      d += ` V ${mh - 40}`;
    }

    wirePath.setAttribute("d", d);
    wireLen = wirePath.getTotalLength();
    wirePath.style.strokeDasharray = wireLen;
  }

  // horizontal offset of an element relative to main (for titleblock edges)
  const relYX = (el) => {
    let x = 0, n = el;
    while (n && n !== mainEl) { x += n.offsetLeft; n = n.offsetParent; }
    return x;
  };

  const drawSetter = gsap.quickSetter(wirePath, "strokeDashoffset", "px");
  ScrollTrigger.create({
    trigger: mainEl,
    start: "top top",
    end: "bottom bottom",
    onRefresh: () => {
      buildWire();
      drawSetter(wireLen);
    },
    onUpdate: (self) => {
      drawSetter(wireLen * (1 - self.progress));
      // light joints the trace has reached; everything lights at the end
      const tip = window.scrollY + window.innerHeight * 0.85;
      const done = self.progress > 0.99;
      for (const j of jointData) j.el.classList.toggle("lit", done || tip > j.y);
    },
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
