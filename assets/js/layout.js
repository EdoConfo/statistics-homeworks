// Shared header and footer for every page: <site-header></site-header> and <site-footer></site-footer>.
// <site-header homework="1" part="2"> also shows "Homework 1 · Part 2" in the middle of the bar, with arrows to the
// previous and next page in PAGES. Add an entry to PAGES for every new homework-N/part-M folder.
// Loaded as a classic script in <head> so the elements are replaced as the parser reaches them (no flash).
// Links are resolved against this script's URL, so the same markup works from any folder depth.
(function () {
  var ROOT = new URL('../../', document.currentScript.src).href;
  var REPO = 'https://github.com/EdoConfo/statistics-homeworks';
  var COURSE = 'Statistics · Cybersecurity 2026–2027';
  var AUTHOR = 'Edoardo Conforti · 2151055';
  var PAGES = [{ hw: 1, part: 1 }, { hw: 1, part: 2 }];   // reading order
  var GITHUB_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  var CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  function pageName(p) { return 'Homework ' + p.hw + (p.part ? ' · Part ' + p.part : ''); }
  function pagePath(p) { return 'homework-' + p.hw + '/' + (p.part ? 'part-' + p.part + '/' : ''); }

  function hwLink(i, icon, label) {
    var p = PAGES[i];
    if (!p) return '<span class="hw-arrow" aria-hidden="true"></span>';  // keeps the title centred
    return '<a class="hw-arrow" href="' + ROOT + pagePath(p) + '" aria-label="' + label + ': ' + pageName(p) +
      '" title="' + pageName(p) + '">' + icon + '</a>';
  }

  function header(hw, part) {
    var cur = { hw: parseInt(hw, 10), part: parseInt(part, 10) || 0 };
    var i = PAGES.findIndex(function (p) { return p.hw === cur.hw && p.part === cur.part; });
    var middle = cur.hw ? '<div class="header-title">' + hwLink(i - 1, CHEVRON_LEFT, 'Previous') +
      '<span>' + pageName(cur) + '</span>' + hwLink(i < 0 ? -1 : i + 1, CHEVRON_RIGHT, 'Next') + '</div>' : '';
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

  define('site-header', function (el) { return header(el.getAttribute('homework'), el.getAttribute('part')); });
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
