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
  var HOMEWORKS = [{ hw: 1, path: 'homework-1/part-1/' }, { hw: 2, path: 'homework-2/' }];   // reading order, each with its first page
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

  // Part switch: slide the thumb to the chosen part, then follow its link (new-tab clicks are left alone).
  // Docked (page scrolled): the switch is a small tab under the header; clicking the current part opens it.
  document.addEventListener('click', function (e) {
    var bar = document.querySelector('.part-bar');
    var a = e.target.closest && e.target.closest('.seg3d a[href]');
    if (!a) {
      if (bar && !e.target.closest('.seg3d')) setOpen(bar, false);   // a click elsewhere folds it back
      return;
    }
    var seg = a.closest('.seg3d');
    if (a.getAttribute('aria-current') === 'page') {
      e.preventDefault();
      if (bar && bar.classList.contains('docked')) setOpen(bar, !bar.classList.contains('open'));
      return;
    }
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var links = Array.prototype.slice.call(seg.querySelectorAll('a'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    seg.setAttribute('data-active', String(links.indexOf(a) + 1));
    links.forEach(function (l) { l.removeAttribute('aria-current'); });
    a.setAttribute('aria-current', 'page');
    setTimeout(function () { window.location.href = a.href; }, 320);
  });

  var openedAt = 0;   // scroll position when the docked switch was opened
  function setOpen(bar, open) {
    bar.classList.toggle('open', open);
    openedAt = window.scrollY;
    var cur = bar.querySelector('a[aria-current]');
    if (cur && bar.classList.contains('docked')) cur.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('keydown', function (e) {
    var bar = document.querySelector('.part-bar.open');
    if (bar && e.key === 'Escape') setOpen(bar, false);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.part-bar');
    if (!bar) return;
    var cur = bar.querySelector('a[aria-current]');
    var ticking = false;
    function update() {
      ticking = false;
      var docked = window.scrollY > 12;
      if (docked !== bar.classList.contains('docked')) {
        bar.classList.toggle('docked', docked);
        if (cur) { if (docked) cur.setAttribute('aria-expanded', 'false'); else cur.removeAttribute('aria-expanded'); }
        if (!docked) setOpen(bar, false);
      }
      // scrolling on after opening the tab folds it again
      if (bar.classList.contains('open') && Math.abs(window.scrollY - openedAt) > 80) setOpen(bar, false);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  });

  // coming back with the browser's back button restores the page from cache: put the thumb back
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    document.querySelectorAll('.seg3d').forEach(function (seg) {
      var links = Array.prototype.slice.call(seg.querySelectorAll('a'));
      var here = links.findIndex(function (l) { return l.href === window.location.href.split('#')[0]; });
      if (here < 0) return;
      seg.setAttribute('data-active', String(here + 1));
      links.forEach(function (l, i) { if (i === here) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
    });
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
