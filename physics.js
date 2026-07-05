/*
  Parts bin — the skills chips are rigid bodies.
  When the Skills sheet first scrolls into view, every chip drops into its
  group card under gravity (Matter.js), collides, settles, and can be
  dragged and thrown with the mouse. Desktop + motion-ok only; elsewhere
  the chips stay as ordinary static tags.
*/
(() => {
  if (typeof Matter === "undefined") return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = window.matchMedia("(min-width: 900px)").matches
    && window.matchMedia("(pointer: fine)").matches;
  if (reduced || !desktop) return;

  const skills = document.getElementById("skills");
  if (!skills) return;

  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint } = Matter;
  const worlds = [];
  let started = false;

  function initGroup(group) {
    const chips = [...group.querySelectorAll(".tag")];
    if (!chips.length) return;

    // measure everything BEFORE absolutizing anything
    const gRect = group.getBoundingClientRect();
    const start = chips.map((chip) => {
      const r = chip.getBoundingClientRect();
      return {
        chip,
        x: r.left - gRect.left + r.width / 2,
        y: r.top - gRect.top + r.height / 2,
        w: r.width,
        h: r.height,
      };
    });

    const W = group.clientWidth;
    const H = Math.max(gRect.height + 100, 230);
    group.style.minHeight = H + "px";
    group.classList.add("phys");

    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.15;

    const t = 80; // wall thickness
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + t / 2, W + t * 2, t, { isStatic: true }), // floor
      Bodies.rectangle(-t / 2, H / 2 - H, t, H * 4, { isStatic: true }),    // left
      Bodies.rectangle(W + t / 2, H / 2 - H, t, H * 4, { isStatic: true }), // right
    ]);

    const bodies = start.map(({ chip, x, y, w, h }) => {
      chip.classList.add("chip-phys");
      chip.style.width = w + "px";
      const b = Bodies.rectangle(x, y, w, h, {
        restitution: 0.35,
        friction: 0.4,
        frictionAir: 0.015,
        angle: (Math.random() - 0.5) * 0.25,
      });
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12);
      Composite.add(engine.world, b);
      return { chip, b, w, h };
    });

    // drag + throw
    const mouse = Mouse.create(group);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.15, damping: 0.1 },
    });
    Composite.add(engine.world, mc);
    // Matter's Mouse hijacks the wheel — give scrolling back to the page
    mouse.element.removeEventListener("wheel", mouse.mousewheel);
    mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);

    worlds.push({ engine, bodies });
  }

  let lastT = 0;
  function loop(t) {
    const dt = Math.min(32, lastT ? t - lastT : 16);
    lastT = t;
    for (const w of worlds) {
      Matter.Engine.update(w.engine, dt);
      for (const { chip, b, w: cw, h } of w.bodies) {
        chip.style.transform =
          `translate(${(b.position.x - cw / 2).toFixed(1)}px, ${(b.position.y - h / 2).toFixed(1)}px) ` +
          `rotate(${b.angle.toFixed(3)}rad)`;
      }
    }
    requestAnimationFrame(loop);
  }

  const obs = new IntersectionObserver((entries) => {
    if (!started && entries.some((e) => e.isIntersecting)) {
      started = true;
      obs.disconnect();
      document.querySelectorAll("#skills .skill-group").forEach(initGroup);
      requestAnimationFrame(loop);
    }
  }, { threshold: 0.3 });
  obs.observe(skills);
})();
