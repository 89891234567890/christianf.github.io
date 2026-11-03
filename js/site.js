/* Shared layout + page rendering. Content comes from content.json,
   which the admin portal edits. */
(() => {
  const PAGES = [
    { href: 'index.html', key: 'home', label: 'Home' },
    { href: 'portfolio.html', key: 'portfolio', label: 'Portfolio' },
    { href: 'about.html', key: 'about', label: 'About me' },
    { href: 'resume.html', key: 'resume', label: 'Resume' },
    { href: 'contact.html', key: 'contact', label: 'Contact' },
  ];
  const page = document.body.dataset.page;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paras = s => String(s || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const href = u => /^(https?:|mailto:|\/|#)/i.test(u) ? u : 'https://' + String(u).replace(/^\/+/, '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */
  try { const t = localStorage.getItem('cfa-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}

  /* ---------- chrome: nav drawer, theme toggle, footer ---------- */
  function chrome(site) {
    const projCount = (window.__content.projects || []).filter(p => !p.hidden).length;
    const nav = document.createElement('div');
    nav.innerHTML = `
      <button class="nav-toggle" aria-expanded="false" aria-controls="drawer"><span class="bars"><span></span></span>Menu</button>
      <nav class="drawer" id="drawer" aria-label="Site">
        <ol>${PAGES.map(p => `<li><a href="${p.href}" ${p.key === page || (page === 'project' && p.key === 'portfolio') ? 'aria-current="page"' : ''}>${p.label}${p.key === 'portfolio' ? `<small>${projCount} projects</small>` : ''}</a></li>`).join('')}</ol>
        <div class="drawer-foot">${esc(site.name)}<br>${esc(site.role)}, ${esc(site.school)}<br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></div>
      </nav>
      <div class="scrim"></div>
      <button class="theme-toggle" aria-label="Switch light or dark theme" title="Switch theme">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>
      </button>`;
    document.body.prepend(...nav.children);
    const btn = $('.nav-toggle'), drawer = $('#drawer');
    const set = open => {
      document.body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open);
      btn.lastChild.textContent = open ? 'Close' : 'Menu';
      if (open) drawer.querySelector('a').focus();
    };
    btn.addEventListener('click', () => set(!document.body.classList.contains('nav-open')));
    $('.scrim').addEventListener('click', () => set(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { set(false); btn.focus(); } });
    $('.theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('cfa-theme', next); } catch {}
    });
    const foot = document.createElement('footer');
    foot.className = 'site-foot';
    foot.innerHTML = `<div class="wrap"><span>${esc(site.name)} · ${esc(site.location)}</span><span><a href="mailto:${esc(site.email)}">${esc(site.email)}</a>${site.linkedin ? ` &nbsp; <a href="${esc(href(site.linkedin))}" target="_blank" rel="noopener">LinkedIn</a>` : ''} &nbsp; <a href="${esc(site.resumePdf)}" download>Download resume</a></span></div>`;
    document.body.append(foot);
  }

  /* ---------- visits ---------- */
  function track() {
    const id = new URLSearchParams(location.search).get('id');
    const path = '/' + (page === 'home' ? '' : page) + (id ? '/' + id : '');
    try {
      fetch('api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, ref: document.referrer }), keepalive: true }).catch(() => {});
    } catch {}
  }

  /* ---------- viewers ---------- */
  function turntable(el, frames, { auto = true } = {}) {
    el.classList.add('turntable');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Rotatable 3D render. Drag left or right to turn the model.');
    el.tabIndex = 0;
    const img = new Image(); img.alt = ''; img.src = frames[0];
    el.append(img);
    const cache = frames.map(src => { const i = new Image(); i.src = src; return i; });
    let idx = 0, dragging = false, startX = 0, startIdx = 0, spin = auto && !reduced, timer;
    const show = i => { idx = ((i % frames.length) + frames.length) % frames.length; img.src = cache[idx].src; };
    const tick = () => { if (spin && !dragging) show(idx + 1); };
    timer = setInterval(tick, 110);
    el.addEventListener('pointerdown', e => { dragging = true; spin = false; startX = e.clientX; startIdx = idx; el.setPointerCapture(e.pointerId); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (dragging) show(startIdx - Math.round((e.clientX - startX) / 10)); });
    const end = () => { dragging = false; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('click', e => { if (Math.abs(idx - startIdx) > 0) { e.preventDefault(); e.stopPropagation(); } }, true);
    el.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { spin = false; show(idx - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { spin = false; show(idx + 1); e.preventDefault(); } });
    return () => clearInterval(timer);
  }

  async function modelViewer(el, url, { auto = true } = {}) {
    el.classList.add('model-view');
    el.innerHTML = '<div class="loading">Loading 3D model…</div>';
    try {
      const lib = f => new URL('js/vendor/' + f, document.baseURI).href;
      const THREE = await import(lib('three.module.js'));
      const { OrbitControls } = await import(lib('addons/controls/OrbitControls.js'));
      const ext = url.split('?')[0].split('.').pop().toLowerCase();
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1e5);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.6); dir.position.set(3, 5, 4); scene.add(dir);
      let obj;
      if (ext === 'stl') {
        const { STLLoader } = await import(lib('addons/loaders/STLLoader.js'));
        const geo = await new STLLoader().loadAsync(url);
        geo.computeVertexNormals();
        obj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.25, roughness: 0.55 }));
        obj.rotation.x = -Math.PI / 2;
      } else if (ext === 'obj') {
        const { OBJLoader } = await import(lib('addons/loaders/OBJLoader.js'));
        obj = await new OBJLoader().loadAsync(url);
        obj.traverse(c => { if (c.isMesh) c.material = new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.25, roughness: 0.55 }); });
      } else {
        const { GLTFLoader } = await import(lib('addons/loaders/GLTFLoader.js'));
        obj = (await new GLTFLoader().loadAsync(url)).scene;
      }
      const pivot = new THREE.Group(); pivot.add(obj); scene.add(pivot);
      const box = new THREE.Box3().setFromObject(pivot);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      camera.position.set(size * 0.75, size * 0.5, size * 0.95);
      camera.near = size / 100; camera.far = size * 100; camera.updateProjectionMatrix();
      el.innerHTML = '';
      el.append(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.autoRotate = auto && !reduced; controls.autoRotateSpeed = 1.6;
      controls.enableZoom = el.dataset.zoom !== 'off';
      renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });
      const fit = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      new ResizeObserver(fit).observe(el); fit();
      const loop = () => { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); };
      loop();
    } catch (err) {
      console.error(err);
      el.innerHTML = '<div class="loading">The 3D model could not be loaded.</div>';
    }
  }

  const SPEC_ART = {
    'millennium-falcon': `<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M30 70 L100 40 L170 70 L100 100 Z"/><path d="M30 70 V100 L100 130 V100"/><path d="M170 70 V100 L100 130"/>${[[58,62],[86,50],[86,74],[114,62],[114,86],[142,74]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="11" ry="5"/><path d="M${x-11} ${y} v-7 M${x+11} ${y} v-7"/><ellipse cx="${x}" cy="${y-7}" rx="11" ry="5"/>`).join('')}<path d="M178 70 L190 70 M178 100 L190 100 M184 70 V100" stroke-width="1"/><text x="186" y="90" font-size="9" fill="currentColor" stroke="none" text-anchor="end" transform="rotate(-90 186 90)">9.6</text></svg>`,
  };
  function specCover(p) {
    const art = SPEC_ART[p.id] || `<p class="spec-file">${esc((p.tools || [])[0] || 'CAD')} model<br><span>Renders coming soon</span></p>`;
    const specs = (p.specs || []).slice(0, 3).map(s => `<dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd>`).join('');
    return `<div class="spec-cover" aria-hidden="true">${art}<dl>${specs}</dl></div>`;
  }

  /* Mount the interactive cover for a project into el */
  function mountPreview(el, p, opts = {}) {
    const pv = p.preview || {};
    if (pv.type === 'turntable' && pv.frames && pv.frames.length) { turntable(el, pv.frames, opts); return 'Drag to rotate'; }
    if (pv.type === 'model' && pv.model) {
      if (opts.lazy) {
        el.innerHTML = p.cover ? `<img src="${esc(p.cover)}" alt="" style="width:100%;height:100%;object-fit:cover">` : specCover(p);
        const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); modelViewer(el, pv.model, opts); } }, { rootMargin: '200px' });
        io.observe(el);
      } else modelViewer(el, pv.model, opts);
      return 'Drag to rotate';
    }
    if (p.cover) { el.innerHTML = `<img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy">`; return ''; }
    el.innerHTML = specCover(p); return '';
  }

  function titleBlock(p, i, n, { compact = false } = {}) {
    const sheet = `${String(i + 1).padStart(2, '0')} of ${String(n).padStart(2, '0')}`;
    if (compact) return `
      <div class="tblock">
        <div class="full title-cell"><span class="k">Project</span><span class="v">${esc(p.title)}</span></div>
        <div><span class="k">Context</span><span class="v">${esc(p.category)}</span></div>
        <div><span class="k">Date</span><span class="v">${esc(p.period)}</span></div>
      </div>`;
    return `
      <div class="tblock">
        <div class="full title-cell"><span class="k">Project</span><h1 class="v">${esc(p.title)}</h1></div>
        <div class="wide"><span class="k">Context</span><span class="v">${esc(p.context || p.category)}</span></div>
        <div><span class="k">Date</span><span class="v">${esc(p.period)}</span></div>
        <div><span class="k">Sheet</span><span class="v">${sheet}</span></div>
        <div class="wide"><span class="k">My role</span><span class="v">${esc(p.role)}</span></div>
        <div><span class="k">Team</span><span class="v">${esc(p.team)}</span></div>
        <div><span class="k">Status</span><span class="v">${esc(p.status)}</span></div>
      </div>`;
  }

  /* ---------- pages ---------- */
  const R = {};

  R.home = c => {
    const s = c.site;
    const parts = s.name.split(' ');
    const first = parts.shift(), rest = parts.join(' ');
    const zones = (n, letters) => Array.from({ length: n }, (_, i) => `<span>${letters ? 'ABCDEF'[i] : i + 1}</span>`).join('');
    const featured = c.projects.filter(p => !p.hidden).slice(0, 3);
    return `
    <div class="wrap">
      <div class="sheet">
        <div class="zones top">${zones(8)}</div><div class="zones bottom">${zones(8)}</div>
        <div class="zones left">${zones(4, 1)}</div><div class="zones right">${zones(4, 1)}</div>
        <div class="hero">
          <figure class="hero-photo"><img src="${esc(s.photo)}" alt="Portrait of ${esc(s.name)}"></figure>
          <div class="hero-text">
            <h1 class="hero-name"><span>${esc(first)}</span><span>${esc(rest)}</span></h1>
            <p class="hero-role">${esc(s.role)}, ${esc(s.school)}. ${esc(s.seeking)}.</p>
            <p class="hero-headline">${esc(s.headline)}</p>
            <div class="tblock" style="grid-template-columns:1fr;max-width:280px">
              <div style="border-bottom:0"><span class="k">Based in</span><span class="v">${esc(s.location)}</span></div>
            </div>
            <div class="hero-actions">
              <a class="btn primary" href="portfolio.html">View portfolio</a>
              <a class="btn" href="${esc(s.resumePdf)}" download>Download resume</a>
              <a class="btn" href="contact.html">Contact me</a>
            </div>
          </div>
        </div>
      </div>

      <section class="block"><div class="block-head"><h2>Summary</h2></div><p class="summary">${esc(s.summary)}</p></section>

      <section class="block"><div class="block-head"><h2>Strengths</h2></div>
        <div class="grid-2">${s.strengths.map(x => `<div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('')}</div></section>

      <section class="block"><div class="block-head"><h2>Skills</h2></div>
        <div class="skills">${s.skills.map(g => `<div><h3>${esc(g.group)}</h3><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div></section>

      <section class="block"><div class="block-head"><h2>Selected work</h2><a href="portfolio.html">All ${c.projects.filter(p => !p.hidden).length} projects</a></div>
        <div class="featured">${featured.map((p, i) => card(p, i, featured.length)).join('')}</div></section>

      <section class="block"><div class="block-head"><h2>History</h2></div>
        <ol class="timeline">${s.history.map(h => `<li><span class="when">${esc(h.when)}</span><div><h3>${esc(h.title)}</h3><p>${esc(h.detail)}</p></div></li>`).join('')}</ol></section>

      <section class="block"><div class="block-head"><h2>Outside the shop</h2></div>
        <div class="grid-2">${s.interests.map(x => `<div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('')}</div></section>
    </div>`;
  };

  function card(p, i, n) {
    return `<a class="card" href="project.html?id=${encodeURIComponent(p.id)}" data-cat="${esc(p.category)}">
      <div class="cover" data-preview="${esc(p.id)}">${p.status === 'In progress' ? '<span class="badge">In progress</span>' : ''}</div>
      ${titleBlock(p, i, n, { compact: true })}
      <div class="blurb">${esc(p.blurb)}<span class="more">View project</span></div>
    </a>`;
  }

  R.portfolio = c => {
    const list = c.projects.filter(p => !p.hidden);
    const cats = [...new Set(list.map(p => p.category))];
    return `<div class="wrap">
      <header class="page-head"><h1>Portfolio</h1><p>Design projects from robotics, coursework and my own builds. Scroll sideways or use the arrows, and open any project for photos, CAD and the full write-up.</p></header>
      <div class="rail-controls">
        <div class="filters" role="group" aria-label="Filter projects"><button class="chip" aria-pressed="true" data-f="">All</button>${cats.map(k => `<button class="chip" aria-pressed="false" data-f="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        <div class="arrows"><button class="arrow" data-dir="-1" aria-label="Scroll left"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg></button><button class="arrow" data-dir="1" aria-label="Scroll right"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg></button></div>
      </div>
      <div class="rail-outer"><div class="rail" tabindex="0" aria-label="Projects">${list.map((p, i) => card(p, i, list.length)).join('')}</div></div>
      <div class="rail-progress" aria-hidden="true"><span></span></div>
    </div>`;
  };

  function wireRail() {
    const rail = $('.rail'); if (!rail) return;
    const bar = $('.rail-progress span');
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      document.querySelectorAll('.arrow').forEach(b => { b.disabled = b.dataset.dir < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= max - 2; });
      if (bar) { const vis = rail.clientWidth / rail.scrollWidth; bar.style.width = vis * 100 + '%'; bar.style.left = (max ? rail.scrollLeft / max : 0) * (1 - vis) * 100 + '%'; }
    };
    rail.addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
    document.querySelectorAll('.arrow').forEach(b => b.addEventListener('click', () => {
      const step = rail.querySelector('.card').offsetWidth + 22;
      rail.scrollBy({ left: step * Number(b.dataset.dir), behavior: reduced ? 'auto' : 'smooth' });
    }));
    // Vertical wheel scrolls the rail sideways until it reaches an end
    rail.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = rail.scrollWidth - rail.clientWidth;
      if ((e.deltaY > 0 && rail.scrollLeft < max - 1) || (e.deltaY < 0 && rail.scrollLeft > 1)) { e.preventDefault(); rail.scrollLeft += e.deltaY; }
    }, { passive: false });
    // Click-and-drag with a mouse (touch already scrolls natively)
    let down = false, sx = 0, sl = 0, moved = false;
    rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target.closest('.turntable,.model-view')) return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; });
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) { moved = true; rail.classList.add('dragging'); } rail.scrollLeft = sl - dx; });
    addEventListener('pointerup', () => { if (!down) return; down = false; setTimeout(() => rail.classList.remove('dragging'), 0); });
    rail.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
    rail.addEventListener('dragstart', e => e.preventDefault());
    rail.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); $('.arrow[data-dir="' + (e.key === 'ArrowRight' ? 1 : -1) + '"]').click(); } });
    document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === ch));
      rail.querySelectorAll('.card').forEach(cd => { cd.hidden = ch.dataset.f && cd.dataset.cat !== ch.dataset.f; });
      rail.scrollLeft = 0; update();
    }));
  }

  function mountCards(c) {
    document.querySelectorAll('[data-preview]').forEach(el => {
      const p = c.projects.find(x => x.id === el.dataset.preview);
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;inset:0';
      el.append(holder);
      const hint = mountPreview(holder, p, { lazy: true, auto: true });
      if (hint) el.insertAdjacentHTML('beforeend', `<span class="hint">${hint}</span>`);
    });
  }

  R.project = c => {
    const id = new URLSearchParams(location.search).get('id');
    const list = c.projects.filter(p => !p.hidden);
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return `<div class="wrap"><header class="page-head"><h1>Project not found</h1><p>This project may have been renamed or hidden. <a href="portfolio.html">Browse all projects</a>.</p></header></div>`;
    const p = list[i];
    document.title = `${p.title} · ${c.site.name}`;
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    const pv = p.preview || {};
    const interactive = (pv.type === 'turntable' && pv.frames?.length) || (pv.type === 'model' && pv.model);
    const slides = [];
    if (interactive) slides.push({ kind: 'preview', caption: pv.type === 'model' ? '3D model. Drag to orbit, scroll to zoom.' : 'Rendered turntable. Drag to rotate.' });
    (p.gallery || []).forEach(g => slides.push({ kind: g.src.match(/\.(stl|glb|gltf|obj)$/i) ? 'model' : g.src.match(/\.mp4$/i) ? 'video' : 'img', ...g }));
    if (!slides.length) slides.push({ kind: 'spec', caption: 'Photos and renders for this project are coming soon.' });
    const sec = (p.sections || []).map(s => `<section><h2>${esc(s.heading)}</h2>${paras(s.body)}${s.bullets?.length ? `<ul>${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</section>`).join('');
    return `<div class="wrap">
      <div class="proj-top"><a href="portfolio.html">All projects</a><span>${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</span></div>
      <div class="gallery">
        <div class="stage" aria-roledescription="carousel" aria-label="${esc(p.title)} images">
          ${slides.map((s, k) => `<div class="slide${k ? '' : ' on'}" data-k="${k}" data-kind="${s.kind}" ${s.src ? `data-src="${esc(s.src)}"` : ''}>${s.kind === 'img' ? `<img src="${esc(s.src)}" alt="${esc(s.caption || p.title)}" ${k ? 'loading="lazy"' : ''}>` : s.kind === 'video' ? `<video src="${esc(s.src)}" controls playsinline style="width:100%;height:100%"></video>` : s.kind === 'spec' ? specCover(p) : ''}</div>`).join('')}
          ${slides.length > 1 ? `<button class="arrow nav prev" aria-label="Previous image"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg></button><button class="arrow nav next" aria-label="Next image"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg></button>` : ''}
        </div>
        <div class="stage-caption"><span class="cap" aria-live="polite">${esc(slides[0].caption || '')}</span><span class="count">1 / ${slides.length}</span></div>
        ${slides.length > 1 ? `<div class="thumbs">${slides.map((s, k) => `<button aria-label="Show image ${k + 1}" aria-current="${!k}" data-k="${k}">${s.kind === 'img' ? `<img src="${esc(s.src)}" alt="" loading="lazy">` : `<span class="t3d">${s.kind === 'video' ? 'Video' : '3D'}</span>`}</button>`).join('')}</div>` : ''}
      </div>
      <div class="proj-head">${titleBlock(p, i, list.length)}</div>
      <div class="proj-body">
        <div>
          <p class="outcome">${esc(p.outcome)}</p>
          ${sec}
        </div>
        <aside class="proj-side">
          ${p.tools?.length ? `<div><h2>Tools</h2><div class="tags">${p.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>` : ''}
          ${p.specs?.length ? `<div><h2>Specifications</h2><dl class="specs">${p.specs.map(s => `<dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd>`).join('')}</dl></div>` : ''}
          ${p.timeline?.length ? `<div><h2>Timeline</h2><ol class="steps">${p.timeline.map(t => `<li><b>${esc(t.date)}</b><span>${esc(t.text)}</span></li>`).join('')}</ol></div>` : ''}
        </aside>
      </div>
      <nav class="pager" aria-label="More projects">
        <a href="project.html?id=${encodeURIComponent(prev.id)}"><small>Previous project</small><b>${esc(prev.title)}</b></a>
        <a class="next" href="project.html?id=${encodeURIComponent(next.id)}"><small>Next project</small><b>${esc(next.title)}</b></a>
      </nav>
    </div>`;
  };

  function wireGallery(c) {
    const stage = $('.stage'); if (!stage) return;
    const id = new URLSearchParams(location.search).get('id');
    const p = c.projects.find(x => x.id === id);
    const slides = [...stage.querySelectorAll('.slide')];
    const thumbs = [...document.querySelectorAll('.thumbs button')];
    const mounted = new Set();
    let cur = 0;
    const mount = k => {
      if (mounted.has(k)) return; mounted.add(k);
      const s = slides[k];
      if (s.dataset.kind === 'preview') mountPreview(s, p, { auto: true });
      if (s.dataset.kind === 'model') modelViewer(s, s.dataset.src, { auto: true });
    };
    const caps = slides.map((s, k) => {
      const g = (p.gallery || []); const off = slides[0].dataset.kind === 'preview' ? 1 : 0;
      if (s.dataset.kind === 'preview') return p.preview.type === 'model' ? '3D model. Drag to orbit, scroll to zoom.' : 'Rendered turntable. Drag to rotate.';
      if (s.dataset.kind === 'spec') return 'Photos and renders for this project are coming soon.';
      return g[k - off]?.caption || '';
    });
    const go = k => {
      cur = (k + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle('on', j === cur));
      thumbs.forEach((t, j) => t.setAttribute('aria-current', j === cur));
      thumbs[cur]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      $('.stage-caption .cap').textContent = caps[cur];
      $('.stage-caption .count').textContent = `${cur + 1} / ${slides.length}`;
      mount(cur);
    };
    mount(0);
    $('.nav.prev')?.addEventListener('click', () => go(cur - 1));
    $('.nav.next')?.addEventListener('click', () => go(cur + 1));
    thumbs.forEach(t => t.addEventListener('click', () => go(Number(t.dataset.k))));
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,.turntable')) return;
      if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1);
    });
    let sx = null;
    stage.addEventListener('touchstart', e => { if (!e.target.closest('.turntable,.model-view')) sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); sx = null; });
  }

  R.about = c => {
    const a = c.about, s = c.site;
    return `<div class="wrap">
      <header class="page-head"><h1>${esc(a.heading)}</h1></header>
      <div class="about">
        <div><img src="${esc(s.photo)}" alt="Portrait of ${esc(s.name)}">
          <dl class="specs" style="margin-top:22px">${(a.facts || []).map(f => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join('')}</dl>
        </div>
        <div class="prose">
          <p class="intro">${esc(a.intro)}</p>
          ${(a.paragraphs || []).map(x => `<p>${esc(x)}</p>`).join('')}
          <div class="hero-actions"><a class="btn primary" href="portfolio.html">See my projects</a><a class="btn" href="contact.html">Contact me</a></div>
        </div>
      </div>
    </div>`;
  };

  R.resume = c => {
    const pdf = c.site.resumePdf;
    return `<div class="wrap">
      <header class="page-head"><h1>Resume</h1><p>The latest version of my resume. Download a copy or view it below.</p></header>
      <div class="resume-actions"><a class="btn primary" href="${esc(pdf)}" download>Download resume (PDF)</a><a class="btn" href="${esc(pdf)}" target="_blank" rel="noopener">Open in a new tab</a></div>
      <object class="resume-frame" data="${esc(pdf)}#view=FitH" type="application/pdf" aria-label="Resume PDF">
        <div class="notice">Your browser can't show the PDF here. <a href="${esc(pdf)}" download>Download the resume</a> instead.</div>
      </object>
    </div>`;
  };

  R.contact = c => {
    const s = c.site, ct = c.contact;
    return `<div class="wrap">
      <header class="page-head"><h1>${esc(ct.heading)}</h1><p>${esc(ct.intro)}</p></header>
      <div class="contact">
        <form class="form" novalidate>
          <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>
          <div class="field"><label for="f-email">Your email</label><input id="f-email" name="email" type="email" autocomplete="email" required><div class="help">I'll reply to this address.</div></div>
          <div class="field"><label for="f-company">Company or organization <span style="font-weight:400">(optional)</span></label><input id="f-company" name="company" autocomplete="organization"></div>
          <div class="field"><label for="f-msg">Message</label><textarea id="f-msg" name="message" required></textarea></div>
          <div class="hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <div><button class="btn primary" type="submit">Send message</button></div>
          <div class="status" role="status" aria-live="polite"></div>
        </form>
        <aside class="proj-side">
          <div><h2>Direct</h2><dl class="specs"><dt>Email</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd>${s.phone ? `<dt>Phone</dt><dd>${esc(s.phone)}</dd>` : ''}<dt>Location</dt><dd>${esc(s.location)}</dd>${s.linkedin ? `<dt>LinkedIn</dt><dd><a href="${esc(href(s.linkedin))}" target="_blank" rel="noopener">Profile</a></dd>` : ''}</dl></div>
          <div><h2>Resume</h2><a class="btn" href="${esc(s.resumePdf)}" download>Download resume</a></div>
        </aside>
      </div>
    </div>`;
  };

  function wireContact(c) {
    const form = $('form.form'); if (!form) return;
    const status = $('.status', form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { status.innerHTML = '<div class="notice err">Enter a valid email address so I can reply.</div>'; $('#f-email').focus(); return; }
      if (!data.message.trim()) { status.innerHTML = '<div class="notice err">Write a message before sending.</div>'; $('#f-msg').focus(); return; }
      const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await fetch('api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (r.status === 404 || r.status === 405) throw new Error('static');
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'send failed');
        form.reset();
        status.innerHTML = '<div class="notice ok">Message sent. Thanks, I\'ll get back to you by email.</div>';
      } catch (err) {
        if (err.message === 'static' || err instanceof TypeError) {
          const body = encodeURIComponent(`${data.message}\n\n${data.name}${data.company ? ', ' + data.company : ''}\n${data.email}`);
          location.href = `mailto:${c.site.email}?subject=${encodeURIComponent('Portfolio inquiry from ' + (data.name || data.email))}&body=${body}`;
          status.innerHTML = '<div class="notice">Your email app should open with the message filled in.</div>';
        } else status.innerHTML = `<div class="notice err">${esc(err.message)}</div>`;
      } finally { btn.disabled = false; btn.textContent = 'Send message'; }
    });
  }

  /* ---------- boot ---------- */
  async function boot() {
    let c;
    try { c = await (await fetch('content.json?v=' + Date.now(), { cache: 'no-store' })).json(); }
    catch { document.getElementById('main').innerHTML = '<div class="wrap"><p class="notice err">The site content could not be loaded. Run the site with <code>node server.js</code> or check that content.json exists.</p></div>'; return; }
    window.__content = c;
    chrome(c.site);
    const main = document.getElementById('main');
    main.innerHTML = R[page](c);
    if (page !== 'project') document.title = (page === 'home' ? `${c.site.name} · Mechanical engineering portfolio` : `${PAGES.find(p => p.key === page).label} · ${c.site.name}`);
    if (page === 'portfolio' || page === 'home') mountCards(c);
    if (page === 'portfolio') wireRail();
    if (page === 'project') wireGallery(c);
    if (page === 'contact') wireContact(c);
    track();
  }
  boot();
})();
