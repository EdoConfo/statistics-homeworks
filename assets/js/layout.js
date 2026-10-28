// Shared header and footer for every page: <site-header></site-header> and <site-footer></site-footer>.
// <site-header homework="1"> also shows "Homework 1" in the middle of the bar, with arrows to the previous and next
// homework in HOMEWORKS (parts of a homework are switched by the slider at the top of its pages, not here).
// Add an entry to HOMEWORKS for every new homework-N folder.
// Loaded as a classic script in <head> so the elements are replaced as the parser reaches them (no flash).
// Links are resolved against this script's URL, so the same markup works from any folder depth.
// Pages load it as layout.js?v=N: bump N in every page after changing this file, or browsers keep the old copy for up to 10 minutes.
(function () {
  var ROOT = new URL('../../', document.currentScript.src).href;
  var REPO = 'https://github.com/EdoConfo/statistics-homeworks';
  var COURSE = 'Statistics · Cybersecurity 2026–2027';
  var AUTHOR = 'Edoardo Conforti · 2151055';
  var HOMEWORKS = [{ hw: 1, path: 'homework-1/part-1/' }, { hw: 2, path: 'homework-2/' }, { hw: 3, path: 'homework-3/' }];   // reading order, each with its first page
  var GITHUB_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  var CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  function hwName(h) { return 'Homework ' + h.hw; }

  function hwLink(i, icon, label) {
    var h = HOMEWORKS[i];
    if (!h) return '<span class="hw-arrow" aria-hidden="true"></span>';  // keeps the title centred
    return '<a class="hw-arrow" href="' + ROOT + h.path + '" aria-label="' + label + ': ' + hwName(h) +
      '" title="' + hwName(h) + '">' + icon + '</a>';
  }

  function header(hw) {
    var cur = { hw: parseInt(hw, 10) };
    var i = HOMEWORKS.findIndex(function (h) { return h.hw === cur.hw; });
    var middle = cur.hw ? '<div class="header-title">' + hwLink(i - 1, CHEVRON_LEFT, 'Previous') +
      '<span>' + hwName(cur) + '</span>' + hwLink(i < 0 ? -1 : i + 1, CHEVRON_RIGHT, 'Next') + '</div>' : '';
    return '<header class="site-header"><div class="wrap">' +
      '<a class="brand" href="' + ROOT + '">Statistics Homeworks</a>' +
      middle +
      '<nav class="nav" aria-label="Main">' +
        '<span class="header-author">' + AUTHOR + '</span>' +
        '<a class="icon-btn" href="' + REPO + '" aria-label="Source on GitHub" title="Source on GitHub">' + GITHUB_ICON + '</a>' +
        '<button class="theme-toggle" type="button" aria-label="Toggle theme"></button>' +
      '</nav>' +
    '</div></header>';
  }

  var FOOTER =
    '<footer class="site-footer"><div class="wrap">' +
      '<span>' + AUTHOR + ' · ' + COURSE + '</span>' +
      '<span><a href="' + REPO + '">Source on GitHub</a></span>' +
    '</div></footer>';

  function define(name, render) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        var tpl = document.createElement('template');
        tpl.innerHTML = render(this);
        this.replaceWith(tpl.content);
      }
    });
  }

  define('site-header', function (el) { return header(el.getAttribute('homework')); });
  define('site-footer', function () { return FOOTER; });

  // Section rail: one dash per <section id> with an <h2> in <main>, or per element marked
  // data-rail="Label" when the page has any; hovering it reveals the names.
  document.addEventListener('DOMContentLoaded', function () {
    var marked = document.querySelectorAll('main [data-rail][id]');
    var sections = marked.length ? Array.prototype.slice.call(marked) : Array.prototype.filter.call(
      document.querySelectorAll('main section[id]'),
      function (s) { return s.querySelector('h2'); }
    );
    if (sections.length < 2) return;

    var rail = document.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'Sections');
    var list = document.createElement('ol');
    var links = sections.map(function (s) {
      var a = document.createElement('a');
      a.href = '#' + s.id;
      a.innerHTML = '<span class="rail-dash" aria-hidden="true"></span><span class="rail-label"></span>';
      a.querySelector('.rail-label').textContent = s.dataset.rail || s.querySelector('h2').textContent;
      var li = document.createElement('li');
      li.appendChild(a);
      list.appendChild(li);
      return a;
    });
    rail.appendChild(list);
    document.body.appendChild(rail);

    // Wave: each dash grows with its closeness to the reading position, so the bump glides between sections.
    // pos is fractional: 2.4 means 40% of the way through section 2.
    var ticking = false;
    var dashes = links.map(function (a) { return a.querySelector('.rail-dash'); });
    function update() {
      ticking = false;
      var line = window.innerHeight / 3;
      var tops = sections.map(function (s) { return s.getBoundingClientRect().top - line; });
      var pos = 0;
      for (var i = 0; i < tops.length; i++) {
        if (tops[i] > 0) break;
        var next = i + 1 < tops.length ? tops[i + 1] : tops[i] + sections[i].offsetHeight;
        pos = i + Math.min(1, -tops[i] / Math.max(1, next - tops[i]));
      }
      // pos counts section starts; the wave peaks at a section's middle, so shift by half a section.
      var last = sections.length - 1;
      var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      var centre = atEnd ? last : Math.min(last, Math.max(0, pos - 0.5));
      var active = atEnd ? last : Math.min(last, Math.floor(pos));
      dashes.forEach(function (d, i) {
        var g = Math.exp(-Math.pow(i - centre, 2) / 1.4);   // 1 at the reading position, fading over ~2 neighbours
        d.style.width = (8 + 14 * g).toFixed(1) + 'px';
        d.style.opacity = (0.2 + 0.8 * g).toFixed(2);
      });
      links.forEach(function (a, i) {
        a.classList.toggle('active', i === active);
        if (i === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Part switch: a tab that hangs from the header of a homework split into parts (.part-bar > .seg3d).
  // At the top of the page it shows every part; once the page scrolls it shrinks to the current one (.compact) and
  // clicking it unfolds the others (.open). The header's bottom line and the outline of the tab are drawn as one SVG
  // path, and the header and the tab share one glass surface cut to the same outline, so the blur flows from one into
  // the other and the tab grows out of the header without a seam, whatever lies underneath.
  // A sideways swipe (trackpad or touch) also changes part: fingers to the left for the next part, to the right for the previous one.

  // a part reached by switching slides in from the side it came from (set before the page is painted)
  try {
    var entering = sessionStorage.getItem('part-enter');
    if (entering) {
      sessionStorage.removeItem('part-enter');
      document.documentElement.classList.add('part-enter-' + entering);
    }
  } catch (e) { /* storage unavailable: no entry animation */ }

  var NS = 'http://www.w3.org/2000/svg';
  var FILLET = 12;     // radius of the curves where the header line bends into the tab
  var CORNER = 16;     // radius of the tab's bottom corners
  var part = null;     // { bar, seg, links, open, openedAt }

  function onParsed(fn) {
    // readyState turns 'interactive' when parsing ends, before deferred and module scripts run (they may wait on the network)
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('readystatechange', function once() {
      document.removeEventListener('readystatechange', once);
      fn();
    });
  }

  function shape(bar, seg) {
    var header = document.querySelector('.site-header');
    if (!header) return;
    // the glass sits behind the header's content, covers the header and hangs below it in the shape of the tab
    var glass = document.createElement('div');
    glass.className = 'part-glass';
    header.insertBefore(glass, header.firstChild);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'part-shape');
    svg.setAttribute('aria-hidden', 'true');
    var line = document.createElementNS(NS, 'path');
    line.setAttribute('class', 'line');
    svg.appendChild(line);
    bar.insertBefore(svg, seg);

    function draw() {
      var W = bar.clientWidth, box = seg.getBoundingClientRect(), head = header.getBoundingClientRect();
      var x0 = box.left - bar.getBoundingClientRect().left, x1 = x0 + box.width, h = box.height;
      var r = FILLET, R = Math.min(CORNER, h / 2);
      // the tab from the left fillet to the right one, top edge at y (bar coordinates, shifted down by dy)
      var tab = function (y, dy) {
        return 'A' + r + ',' + r + ' 0 0 1 ' + x0 + ',' + (y + r + dy) + 'V' + (h - R + dy) +
          'A' + R + ',' + R + ' 0 0 0 ' + (x0 + R) + ',' + (h + dy) + 'H' + (x1 - R) +
          'A' + R + ',' + R + ' 0 0 0 ' + x1 + ',' + (h - R + dy) + 'V' + (y + r + dy) +
          'A' + r + ',' + r + ' 0 0 1 ' + (x1 + r) + ',' + (y + dy);
      };
      line.setAttribute('d', 'M0,0.5H' + (x0 - r) + tab(0.5, 0) + 'H' + W);   // 0.5: the header's 1px line, centred on its pixel row
      // in header coordinates: the header's rectangle with the tab hanging from its bottom edge
      var top = bar.getBoundingClientRect().top - head.top;
      glass.style.clipPath = 'path("M0,0H' + head.width + 'V' + top + 'H' + (x1 + r) +
        'A' + r + ',' + r + ' 0 0 0 ' + x1 + ',' + (top + r) + 'V' + (top + h - R) +
        'A' + R + ',' + R + ' 0 0 1 ' + (x1 - R) + ',' + (top + h) + 'H' + (x0 + R) +
        'A' + R + ',' + R + ' 0 0 1 ' + x0 + ',' + (top + h - R) + 'V' + (top + r) +
        'A' + r + ',' + r + ' 0 0 0 ' + (x0 - r) + ',' + top + 'H0Z")';
    }
    var ro = new ResizeObserver(draw);   // fires every frame while the tab's width is animating
    ro.observe(seg);
    ro.observe(bar);
    draw();
    bar.classList.add('shaped');
  }

  function setOpen(open) {
    if (!part) return;
    part.open = open;
    part.openedAt = window.scrollY;
    layoutPart();
  }

  function layoutPart() {
    var scrolled = window.scrollY > 12;
    if (!scrolled) part.open = false;
    var compact = scrolled && !part.open;
    part.bar.classList.toggle('compact', compact);
    part.bar.classList.toggle('open', scrolled && part.open);
    var cur = part.seg.querySelector('a[aria-current]');
    if (cur) { if (scrolled) cur.setAttribute('aria-expanded', String(!compact)); else cur.removeAttribute('aria-expanded'); }
  }

  /** Slide the thumb and the page towards the chosen part, then follow its link. */
  function switchTo(a) {
    var i = part.links.indexOf(a), from = part.links.findIndex(function (l) { return l.getAttribute('aria-current') === 'page'; });
    if (i < 0 || i === from) return;
    var forward = i > from;
    part.seg.setAttribute('data-active', String(i + 1));
    part.links.forEach(function (l) { l.removeAttribute('aria-current'); l.removeAttribute('aria-expanded'); });
    a.setAttribute('aria-current', 'page');
    part.bar.classList.remove('compact');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { window.location.href = a.href; return; }
    try { sessionStorage.setItem('part-enter', forward ? 'from-right' : 'from-left'); } catch (e) { /* no entry animation */ }
    document.documentElement.classList.remove('part-enter-from-left', 'part-enter-from-right');
    document.documentElement.classList.add(forward ? 'part-leave-left' : 'part-leave-right');
    setTimeout(function () { window.location.href = a.href; }, 300);
  }

  function step(dir) {
    if (!part || document.documentElement.classList.contains('drawer-open')) return;
    var from = part.links.findIndex(function (l) { return l.getAttribute('aria-current') === 'page'; });
    var to = part.links[from + dir];
    if (to) switchTo(to);
  }

  /** True when the element (or an ancestor) would itself scroll sideways by dx, or is a control that drags sideways. */
  function sideways(el, dx) {
    for (; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
      if (el.matches('input, textarea, select, [data-no-swipe]')) return true;
      var ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
        if (dx === 0 || (dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0)) return true;
      }
    }
    return false;
  }

  onParsed(function () {
    var bar = document.querySelector('.part-bar');
    if (!bar) return;
    var seg = bar.querySelector('.seg3d');
    part = { bar: bar, seg: seg, links: Array.prototype.slice.call(seg.querySelectorAll('a')), open: false, openedAt: 0 };
    shape(bar, seg);
    layoutPart();

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        // scrolling on after opening the tab folds it again
        if (part.open && Math.abs(window.scrollY - part.openedAt) > 80) part.open = false;
        layoutPart();
      });
    }, { passive: true });

    // trackpad: horizontal wheel deltas add up over one gesture; inertia keeps the gesture alive, so it fires once
    var acc = 0, last = -1e9, fired = false;
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;   // pinch zoom
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
      var dx = e.deltaX * k, dy = e.deltaY * k;
      if (e.timeStamp - last > 250) { acc = 0; fired = false; }
      last = e.timeStamp;
      if (fired) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) { acc = 0; return; }   // mostly vertical: an ordinary scroll
      if (sideways(e.target, dx)) { acc = 0; return; }
      acc += dx;
      if (Math.abs(acc) > 120) { fired = true; step(acc > 0 ? 1 : -1); }
    }, { passive: true });

    // touch: one quick, mostly horizontal swipe
    var touch = null;
    document.addEventListener('touchstart', function (e) {
      touch = e.touches.length === 1 && !sideways(e.target, 0)
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp } : null;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!touch) return;
      var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y, quick = e.timeStamp - touch.t < 700;
      touch = null;
      if (quick && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  });

  // clicks: another part switches; the current part folds or unfolds the tab once the page has scrolled
  document.addEventListener('click', function (e) {
    if (!part) return;
    var a = e.target.closest && e.target.closest('.seg3d a[href]');
    if (!a) {
      if (part.open && !e.target.closest('.seg3d')) setOpen(false);   // a click elsewhere folds it back
      return;
    }
    if (a.getAttribute('aria-current') === 'page') {
      e.preventDefault();
      if (window.scrollY > 12) setOpen(!part.open);
      return;
    }
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new-tab clicks are left alone
    e.preventDefault();
    switchTo(a);
  });

  document.addEventListener('keydown', function (e) {
    if (part && part.open && e.key === 'Escape') setOpen(false);
  });

  // coming back with the browser's back button restores the page from cache: undo the exit and put the thumb back
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || !part) return;
    document.documentElement.classList.remove('part-leave-left', 'part-leave-right', 'part-enter-from-left', 'part-enter-from-right');
    var here = part.links.findIndex(function (l) { return l.href === window.location.href.split('#')[0]; });
    if (here < 0) return;
    part.seg.setAttribute('data-active', String(here + 1));
    part.links.forEach(function (l, i) { if (i === here) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
    part.open = false;
    layoutPart();
  });

  // Stage panel: values are written by the page through Stage.set(name, text) into [data-stage-value=name];
  // while reading, the innermost [data-stage] element under the reading line lights up the panel items whose
  // data-for shares one of its keys.
  window.Stage = {
    set: function (name, text) {
      document.querySelectorAll('[data-stage-value="' + name + '"]').forEach(function (el) { el.textContent = text; });
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.stage'));
    if (!panels.length) return;
    var marks = Array.prototype.slice.call(document.querySelectorAll('[data-stage]'));
    var items = Array.prototype.slice.call(document.querySelectorAll('.stage [data-for]'));
    var current = null, ticking = false;

    function update() {
      ticking = false;
      var line = window.innerHeight * 0.4, best = null, bestH = Infinity;
      marks.forEach(function (m) {
        var r = m.getBoundingClientRect();
        if (r.top <= line && r.bottom > line && r.height < bestH) { best = m; bestH = r.height; }
      });
      var key = best ? best.getAttribute('data-stage') : '';
      if (key === current) return;
      current = key;
      var keys = key.split(/\s+/);
      var lit = [];
      items.forEach(function (it) {
        var on = !!key && it.getAttribute('data-for').split(/\s+/).some(function (k) { return keys.indexOf(k) >= 0; });
        it.classList.toggle('active', on);
        if (on) lit.push(it);
      });
      // groups with nothing lit fold away while another group is being read
      var refolded = false;
      document.querySelectorAll('.stage-block').forEach(function (b) {
        var fold = lit.length > 0 && !b.querySelector('.active');
        if (fold !== b.classList.contains('folded')) { b.classList.toggle('folded', fold); refolded = true; }
      });
      if (refolded) setTimeout(function () { follow(lit); }, 480);   // measure once the folding has settled
      else follow(lit);
    }

    // a panel taller than the window scrolls itself: the whole lit stretch if it fits, else its last item
    function follow(lit) {
      panels.forEach(function (p) {
        var mine = lit.filter(function (it) { return p.contains(it); });
        if (p.scrollHeight <= p.clientHeight) { if (p.scrollTop) p.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (!mine.length) return;
        var base = p.getBoundingClientRect().top - p.scrollTop;
        var top = mine[0].getBoundingClientRect().top - base;
        var last = mine[mine.length - 1].getBoundingClientRect();
        var bottom = last.bottom - base;
        var target = bottom - top <= p.clientHeight - 32 ? top - 16 : last.top - base - 16;
        if (top < p.scrollTop || bottom > p.scrollTop + p.clientHeight) {
          p.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        }
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Assignment drawer: a page that holds <template id="assignment"> gets a side tab that slides the text in.
  document.addEventListener('DOMContentLoaded', function () {
    var tpl = document.getElementById('assignment');
    if (!tpl) return;

    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'drawer-tab';
    tab.textContent = 'Assignment';
    tab.setAttribute('aria-controls', 'assignment-drawer');
    tab.setAttribute('aria-expanded', 'false');

    var backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';

    var drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.id = 'assignment-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'assignment-title');
    drawer.innerHTML =
      '<div class="drawer-head"><h2 id="assignment-title">Assignment</h2>' +
      '<button class="drawer-close" type="button" aria-label="Close">×</button></div>' +
      '<div class="drawer-body"></div>';
    drawer.querySelector('.drawer-body').appendChild(tpl.content.cloneNode(true));

    var root = document.documentElement;
    var close = drawer.querySelector('.drawer-close');

    function setOpen(open) {
      root.classList.toggle('drawer-open', open);
      tab.setAttribute('aria-expanded', String(open));
      if (open) close.focus(); else tab.focus();
    }

    tab.addEventListener('click', function () { setOpen(true); });
    close.addEventListener('click', function () { setOpen(false); });
    backdrop.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('drawer-open')) setOpen(false);
    });

    document.body.append(tab, backdrop, drawer);
  });
})();
