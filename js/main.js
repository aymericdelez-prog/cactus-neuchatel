/* ==========================================================================
   CACTUS — animations & interactions
   GSAP + ScrollTrigger pour les animations au scroll, Lenis pour le défilement fluide.
   Le site reste lisible et utilisable sans JavaScript ou avec « mouvement réduit ».
   ========================================================================== */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = Boolean(window.gsap && window.ScrollTrigger);
  const animate = hasGSAP && motionOK;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const PHONE_LINK = '<a href="tel:+41327100868">032 710 08 68</a>';

  /* ------------------------------------------------------------------
     Horaires d'ouverture (0 = dimanche … 6 = samedi), heure de Neuchâtel.
     Ils alimentent l'indicateur « Ouvert / Fermé » : à garder en phase
     avec les horaires affichés dans index.html.
  ------------------------------------------------------------------ */
  const HOURS = {
    0: [],
    1: [],
    2: [['18:30', '22:00']],
    3: [['11:30', '14:00'], ['18:30', '22:00']],
    4: [['11:30', '14:00'], ['18:30', '22:00']],
    5: [['11:30', '14:00'], ['18:30', '23:00']],
    6: [['11:30', '14:00'], ['18:30', '23:00']],
  };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const toMinutes = (t) => {
    const [h, m] = t.split(/[:h]/).map(Number);
    return h * 60 + m;
  };
  const formatHour = (t) => t.replace(':', 'h');

  // Jour et heure à Neuchâtel, quel que soit le fuseau du visiteur.
  function zurichNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type).value;
      const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) };
    } catch {
      const now = new Date();
      return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
    }
  }

  // Date du jour à Neuchâtel au format AAAA-MM-JJ.
  function zurichDate() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      const t = new Date();
      t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
      return t.toISOString().slice(0, 10);
    }
  }

  function openStatus() {
    const { day, minutes } = zurichNow();
    for (const [start, end] of HOURS[day]) {
      if (minutes >= toMinutes(start) && minutes < toMinutes(end)) {
        return { open: true, label: `Ouvert · jusqu’à ${formatHour(end)}` };
      }
    }
    for (let offset = 0; offset < 7; offset++) {
      const d = (day + offset) % 7;
      for (const [start] of HOURS[d]) {
        if (offset === 0 && toMinutes(start) <= minutes) continue;
        const when = offset === 0 ? '' : offset === 1 ? ' demain' : ` ${DAYS[d]}`;
        return { open: false, label: `Fermé · ouvre${when} à ${formatHour(start)}` };
      }
    }
    return { open: false, label: 'Fermé' };
  }

  function initOpenStatus() {
    const nodes = $$('[data-open-status]');
    if (!nodes.length) return;
    const update = () => {
      const { open, label } = openStatus();
      nodes.forEach((node) => {
        node.classList.toggle('is-open', open);
        $('.status__label', node).textContent = label;
      });
    };
    update();
    setInterval(update, 60 * 1000);
  }

  /* ------------------------------------------------------------------
     Lettres qui « roulent » au survol
  ------------------------------------------------------------------ */
  function initRoll() {
    $$('[data-roll]').forEach((el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      const label = document.createElement('span');
      label.className = 'sr-only';
      label.textContent = text;
      const roll = document.createElement('span');
      roll.className = 'roll';
      roll.setAttribute('aria-hidden', 'true');
      Array.from(text).forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'roll__ch';
        span.style.setProperty('--i', i);
        span.textContent = span.dataset.ch = ch === ' ' ? ' ' : ch;
        roll.appendChild(span);
      });
      el.replaceChildren(label, roll);
    });
  }

  /* ------------------------------------------------------------------
     Défilement fluide
  ------------------------------------------------------------------ */
  let lenis = null;
  if (animate && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      return;
    }
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: motionOK ? 'smooth' : 'auto' });
  }

  const refreshScroll = () => {
    if (hasGSAP) ScrollTrigger.refresh();
  };

  // Lignes animées d'un panneau de carte (plats ou boissons).
  const panelRows = (panel) =>
    $('.drinks', panel)
      ? $$('.drinks__group', panel)
      : $$('.menu-sub, .menu-intro, .menu-item, .menu-compact li, .menu-note', panel);

  /* ------------------------------------------------------------------
     Onglets (carte des plats et carte des boissons)
  ------------------------------------------------------------------ */
  let selectTab = () => {};

  function initTabs() {
    $$('[role="tablist"]').forEach((list) => {
      const tabs = $$('[role="tab"]', list);
      const indicator = $('.tabs__indicator', list);
      const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
      const current = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      let swapId = 0;

      const moveIndicator = (tab, instant = false) => {
        if (!indicator || !tab) return;
        indicator.style.transition = instant ? 'none' : '';
        indicator.style.width = `${tab.offsetWidth}px`;
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
      };

      const reveal = (panel) => {
        tabs.forEach((t) => {
          const p = panelOf(t);
          if (p === panel) return;
          p.hidden = true;
          p.classList.remove('is-active');
          if (animate) gsap.set(panelRows(p), { clearProps: 'opacity,visibility,transform' });
        });
        panel.hidden = false;
        panel.classList.add('is-active');
        if (animate) {
          gsap.fromTo(panelRows(panel), { autoAlpha: 0, y: 32 }, {
            autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: { amount: 0.35 }, clearProps: 'opacity,visibility,transform',
          });
        }
        refreshScroll();
      };

      const swap = (prev, next) => {
        const id = ++swapId;
        if (!animate || !prev) {
          reveal(next);
          return;
        }
        const rows = panelRows(prev);
        gsap.killTweensOf(rows);
        gsap.to(rows, {
          autoAlpha: 0, y: -16, duration: 0.28, ease: 'power2.in', stagger: { amount: 0.1 },
          onComplete: () => { if (id === swapId) reveal(next); },
        });
      };

      const select = (tab, focus = false) => {
        const prevTab = current();
        if (tab === prevTab) return;
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
        });
        swap(prevTab && panelOf(prevTab), panelOf(tab));
        moveIndicator(tab);
        // Sur mobile, la barre d'onglets défile : on recentre l'onglet actif sans bouger la page.
        list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
        if (focus) tab.focus({ preventScroll: true });
      };

      tabs.forEach((tab, i) => {
        tab._select = () => select(tab);
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (e) => {
          const keys = {
            ArrowRight: tabs[(i + 1) % tabs.length],
            ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
            Home: tabs[0],
            End: tabs[tabs.length - 1],
          };
          if (keys[e.key]) {
            e.preventDefault();
            select(keys[e.key], true);
          }
        });
      });

      moveIndicator(current(), true);
      window.addEventListener('resize', () => moveIndicator(current(), true));
      if (document.fonts) document.fonts.ready.then(() => moveIndicator(current(), true));
    });

    selectTab = (name) => {
      const tab = document.getElementById(`tab-${name}`);
      if (tab && tab._select) tab._select();
    };
  }

  /* ------------------------------------------------------------------
     Menu plein écran
  ------------------------------------------------------------------ */
  function initOverlay() {
    const overlay = $('[data-overlay]');
    const burger = $('[data-burger]');
    if (!overlay || !burger) return () => {};
    const images = $$('[data-overlay-img]', overlay);
    let open = false;
    let loaded = false;
    let tl = null;

    // Les images du menu ne sont chargées qu'au premier besoin.
    const loadImages = () => {
      if (loaded) return;
      loaded = true;
      images.forEach((img) => {
        if (img.dataset.src) img.src = img.dataset.src;
      });
    };
    burger.addEventListener('pointerenter', loadImages, { once: true });

    $$('[data-overlay-link]', overlay).forEach((link) => {
      const show = () => images.forEach((img) => img.classList.toggle('is-active', img.dataset.overlayImg === link.dataset.overlayLink));
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
    });

    if (animate) {
      tl = gsap
        .timeline({ paused: true, defaults: { ease: 'expo.out' } })
        .set(overlay, { visibility: 'visible' })
        .fromTo('.overlay__panel', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.inOut' })
        .fromTo('.overlay__label', { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.045 }, '-=0.45')
        .fromTo('.overlay__nav .caption, .overlay__media, .overlay__info > div', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.04 }, '<0.1');
    }

    const toggle = (state = !open) => {
      if (state === open) return;
      open = state;
      html.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      overlay.setAttribute('aria-hidden', String(!open));
      overlay.inert = !open;
      if (open) {
        loadImages();
        lenis?.stop();
        if (tl) tl.timeScale(1).play();
        else overlay.style.visibility = 'visible';
        setTimeout(() => $('a', overlay)?.focus({ preventScroll: true }), 350);
      } else {
        lenis?.start();
        if (tl) tl.timeScale(1.7).reverse();
        else overlay.style.visibility = '';
      }
    };

    burger.addEventListener('click', () => toggle());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) {
        toggle(false);
        burger.focus();
      }
    });
    return toggle;
  }

  /* ------------------------------------------------------------------
     Liens d'ancre (défilement fluide, onglet de carte, menu)
  ------------------------------------------------------------------ */
  function initAnchors(toggleMenu) {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const hash = link.getAttribute('href');
        if (hash === '#') {
          e.preventDefault();
          return;
        }
        const target = document.querySelector(hash);
        if (!target) return;
        e.preventDefault();
        if (link.dataset.openTab) selectTab(link.dataset.openTab);
        const menuWasOpen = html.classList.contains('menu-open');
        if (menuWasOpen) toggleMenu(false);
        const go = () => {
          // Pour une section épinglée, on vise la fin de son animation.
          const pinned = hasGSAP && target.id ? ScrollTrigger.getById(target.id) : null;
          scrollToTarget(hash === '#top' ? 0 : pinned ? pinned.end : target);
          if (hash !== '#top') {
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
          }
        };
        if (menuWasOpen) setTimeout(go, 450);
        else go();
      });
    });
  }

  /* ------------------------------------------------------------------
     Formulaire de réservation
     Mêmes règles que la page de réservation actuelle : services midi/soir,
     fermetures, samedi soir par téléphone, plus de 10 personnes par téléphone.
     ⚠ La demande n'est envoyée nulle part pour l'instant : à brancher sur
     votre système de réservation (reservation.php) avant la mise en ligne.
  ------------------------------------------------------------------ */
  const SLOTS = {
    midi: ['11h30', '12h00', '12h30', '13h00', '13h30'],
    soir: ['18h30', '19h00', '19h30', '20h00', '20h30', '21h00', '21h30'],
  };

  function initForm() {
    const form = $('[data-reserve-form]');
    const success = $('[data-form-success]');
    if (!form || !success) return;
    const service = form.elements.temp;
    const date = form.elements.date;
    const time = form.elements.heure;
    const notice = $('[data-form-notice]', form);
    const submit = $('button[type="submit"]', form);
    date.min = zurichDate();

    const update = () => {
      const s = service.value;
      const d = date.value;
      const persons = form.querySelector('[name="personnes"]:checked')?.value;
      const today = zurichDate();
      let slots = s ? SLOTS[s] : [];
      let message = '';

      if (d) {
        const day = new Date(`${d}T12:00:00`).getDay();
        if (day === 0 || day === 1) {
          message = `Le Cactus est fermé le dimanche et le lundi. Choisissez une autre date ou appelez-nous au ${PHONE_LINK}.`;
          slots = [];
        } else if (day === 2 && s === 'midi') {
          message = 'Le mardi, le Cactus est ouvert uniquement le soir.';
          slots = [];
        } else if (day === 6 && s === 'soir' && d === today) {
          message = `Les réservations en ligne pour le samedi soir sont fermées le jour même. Pour connaître les disponibilités, appelez-nous au ${PHONE_LINK}.`;
          slots = [];
        } else if (d === today && s) {
          const now = zurichNow().minutes;
          slots = slots.filter((slot) => toMinutes(slot) > now);
          if (!slots.length) message = `Plus de créneau en ligne aujourd’hui pour ce service. Appelez-nous au ${PHONE_LINK}.`;
        }
      }
      if (persons === 'plus') {
        message = `Pour plus de 10 personnes, merci de nous appeler au ${PHONE_LINK} pour organiser votre venue et choisir la formule qui vous convient.`;
      }

      const previous = time.value;
      time.replaceChildren();
      const ready = Boolean(s && d);
      const placeholder = new Option(ready ? (slots.length ? 'Choisir' : 'Aucun créneau') : 'Choisissez le service et la date', '', true, true);
      placeholder.disabled = true;
      time.add(placeholder);
      slots.forEach((slot) => time.add(new Option(slot, slot)));
      time.disabled = !(ready && slots.length);
      if (slots.includes(previous)) time.value = previous;

      notice.innerHTML = message;
      notice.hidden = !message;
      submit.disabled = Boolean(message);
    };
    form.addEventListener('change', update);
    update();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // À remplacer par l'envoi réel vers votre système de réservation.
      const firstName = String(new FormData(form).get('nom') || '').trim().split(/\s+/)[0];
      $('[data-success-name]', success).textContent = firstName ? `, ${firstName}` : '';
      const show = () => {
        form.hidden = true;
        success.hidden = false;
        if (animate) gsap.from(success.children, { autoAlpha: 0, y: 40, duration: 1.2, stagger: 0.1, ease: 'expo.out' });
        refreshScroll();
      };
      if (animate) {
        gsap.to(form.children, { autoAlpha: 0, y: -24, duration: 0.45, stagger: 0.03, ease: 'power2.in', onComplete: show });
      } else {
        show();
      }
    });
  }

  /* ------------------------------------------------------------------
     Rangées de cartes : glisser pour faire défiler + boutons
  ------------------------------------------------------------------ */
  function initCarousels() {
    $$('[data-carousel]').forEach((track) => {
      const nav = track.nextElementSibling && track.nextElementSibling.classList.contains('carousel-nav') ? track.nextElementSibling : null;
      const bar = nav && $('.carousel-nav__bar i', nav);
      const step = () => ($('.card', track)?.offsetWidth || 320);
      nav && $('[data-carousel-prev]', nav)?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
      nav && $('[data-carousel-next]', nav)?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

      const update = () => {
        if (!bar) return;
        const max = track.scrollWidth - track.clientWidth;
        const visible = track.clientWidth / track.scrollWidth;
        const progress = max > 0 ? track.scrollLeft / max : 1;
        bar.style.transform = `scaleX(${visible + (1 - visible) * progress})`;
      };
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();

      let down = false;
      let moved = false;
      let startX = 0;
      let startLeft = 0;
      track.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true;
        moved = false;
        startX = e.clientX;
        startLeft = track.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4 && !moved) {
          moved = true;
          track.classList.add('is-dragging');
        }
        if (moved) track.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        track.classList.remove('is-dragging');
      });
      track.addEventListener('click', (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    });
  }

  /* ------------------------------------------------------------------
     Le bar : survol des boissons (fond qui change)
  ------------------------------------------------------------------ */
  function initBar() {
    const items = $$('[data-bar]');
    const backgrounds = $$('[data-bar-bg]');
    if (!items.length) return;
    const activate = (key) => backgrounds.forEach((bg) => bg.classList.toggle('is-active', bg.dataset.barBg === key));
    items.forEach((item) => {
      item.addEventListener('mouseenter', () => activate(item.dataset.bar));
      item.addEventListener('focus', () => activate(item.dataset.bar));
      item.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((other) => other.classList.remove('is-open'));
        item.classList.toggle('is-open', open);
        activate(open ? item.dataset.bar : 'default');
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
    $('.bar-list')?.addEventListener('mouseleave', () => {
      if (!items.some((item) => item.classList.contains('is-open'))) activate('default');
    });
  }

  /* ------------------------------------------------------------------
     Formules : l'image collante change avec le texte
  ------------------------------------------------------------------ */
  function initPillars() {
    const section = $('.pillars');
    if (!section) return;
    const images = $$('.pillars__img', section);
    const steps = $$('.pillar', section);
    const num = $('[data-pillar-num]', section);
    let current = 0;
    section.classList.add('is-enhanced');
    if (animate) {
      images.forEach((img, i) => {
        img.classList.remove('is-current');
        gsap.set(img, { clipPath: i === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)', zIndex: i === 0 ? 3 : 1 });
      });
    }

    const show = (index) => {
      if (index === current || index < 0) return;
      const dir = index > current ? 1 : -1;
      const previous = current;
      current = index;
      steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
      const next = images[index];
      if (!animate) {
        images.forEach((img, i) => img.classList.toggle('is-current', i === index));
        if (num) num.textContent = String(index + 1).padStart(2, '0');
        return;
      }
      // La nouvelle image passe au-dessus, la précédente reste visible juste en dessous.
      images.forEach((img, i) => gsap.set(img, { zIndex: i === index ? 3 : i === previous ? 2 : 1 }));
      gsap.fromTo(next, { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut', overwrite: true });
      gsap.fromTo($('img', next), { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'expo.out', overwrite: true });
      if (num) {
        gsap.timeline()
          .to(num, { yPercent: -100 * dir, duration: 0.35, ease: 'power2.in' })
          .add(() => (num.textContent = String(index + 1).padStart(2, '0')))
          .fromTo(num, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.6, ease: 'expo.out' });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && show(steps.indexOf(entry.target))),
      { rootMargin: '-50% 0px -50% 0px' }
    );
    steps.forEach((step) => observer.observe(step));
  }

  /* ------------------------------------------------------------------
     Initialisations communes (avec ou sans animation)
  ------------------------------------------------------------------ */
  initRoll();
  initOpenStatus();
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  initTabs();
  const toggleMenu = initOverlay();
  initAnchors(toggleMenu);
  initForm();
  initCarousels();
  initBar();
  initPillars();

  if (!animate) {
    $('.loader')?.remove();
    html.classList.remove('is-loading');
    return;
  }

  /* ==================================================================
     À partir d'ici : animations GSAP
     ================================================================== */
  gsap.registerPlugin(ScrollTrigger);

  const nav = $('[data-nav]');
  const setNavTheme = (theme) => {
    if (nav && nav.dataset.theme !== theme) nav.dataset.theme = theme;
  };

  /* ---------- Mots géants ajustés à la largeur ---------- */
  function fitWordmarks() {
    $$('[data-fit]').forEach((el) => {
      el.style.fontSize = '100px';
      const natural = el.scrollWidth;
      if (natural) el.style.fontSize = `${(100 * el.parentElement.clientWidth) / natural}px`;
    });
  }
  fitWordmarks();
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    fitWordmarks();
  });

  /* ---------- Sections épinglées (créées en premier pour des calculs justes) ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    // Spécialités : défilement horizontal
    const sig = $('.sig');
    const row = $('.sig__row');
    if (sig && row) {
      const bar = $('.sig__bar i');
      const counter = $('[data-sig-current]');
      const dishes = $$('.dish', sig);
      const distance = () => Math.max(0, row.scrollWidth - window.innerWidth);
      const skewSetter = gsap.quickSetter($$('.dish__media', sig), 'skewX', 'deg');
      const clampSkew = gsap.utils.clamp(-7, 7);
      const proxy = { skew: 0 };

      const horizontal = gsap.to(row, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          id: 'specialites',
          trigger: sig,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          refreshPriority: 1,
          onUpdate: (self) => {
            if (bar) gsap.set(bar, { scaleX: self.progress });
            if (counter) counter.textContent = String(Math.min(dishes.length, Math.floor(self.progress * dishes.length) + 1)).padStart(2, '0');
            const skew = clampSkew(self.getVelocity() / -350);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
              proxy.skew = skew;
              gsap.to(proxy, { skew: 0, duration: 0.8, ease: 'power3', overwrite: true, onUpdate: () => skewSetter(proxy.skew) });
            }
          },
        },
      });

      dishes.forEach((dish) => {
        gsap.fromTo($('img', dish), { xPercent: -7 }, {
          xPercent: 7,
          ease: 'none',
          scrollTrigger: { trigger: dish, containerAnimation: horizontal, start: 'left right', end: 'right left', scrub: true },
        });
      });
    }

    // Le bar : l'image s'ouvre en plein écran
    const barSection = $('.bar');
    if (barSection) {
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            id: 'bar',
            trigger: barSection,
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            refreshPriority: 1,
            onUpdate: (self) => setNavTheme(self.progress > 0.3 ? 'dark' : 'light'),
          },
        })
        .fromTo('.bar__frame', { clipPath: 'inset(24% 34% 24% 34%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, 0)
        .fromTo('.bar__bgs', { scale: 1.4 }, { scale: 1, duration: 1, ease: 'power2.inOut' }, 0)
        .fromTo('.bar__split-l', { xPercent: 0, autoAlpha: 1 }, { xPercent: -70, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0)
        .fromTo('.bar__split-r', { xPercent: 0, autoAlpha: 1 }, { xPercent: 70, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0)
        .fromTo('.bar__veil', { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.55)
        .fromTo('[data-mz]', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' }, 0.8)
        .to({}, { duration: 0.35 });
    }
  });

  /* ---------- Hero ---------- */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return;
    const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 30, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__shade', { opacity: 0.65, ease: 'none', scrollTrigger: st });
    const factors = [0.38, 0.62, 0.28, 0.72, 0.46, 0.56];
    $$('.hero__title .char').forEach((char, i) => {
      gsap.to(char, { yPercent: -factors[i % factors.length] * 100, ease: 'none', scrollTrigger: st });
    });
    gsap.to('.hero__body', { y: -100, autoAlpha: 0, ease: 'none', scrollTrigger: { ...st, end: '55% top' } });

    // Léger mouvement de l'image qui suit la souris
    if (finePointer) {
      const inner = $('.hero__media-inner');
      const xTo = gsap.quickTo(inner, 'x', { duration: 1.4, ease: 'power3' });
      const yTo = gsap.quickTo(inner, 'y', { duration: 1.4, ease: 'power3' });
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        xTo((e.clientX / r.width - 0.5) * -32);
        yTo(((e.clientY - r.top) / r.height - 0.5) * -22);
      });
      hero.addEventListener('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    }

    // Badge rotatif : accélère au survol
    const badge = $('.badge');
    const ring = $('.badge__ring');
    if (badge && ring) {
      const spin = gsap.to(ring, { rotation: 360, duration: 18, ease: 'none', repeat: -1 });
      badge.addEventListener('mouseenter', () => gsap.to(spin, { timeScale: 5, duration: 0.6 }));
      badge.addEventListener('mouseleave', () => gsap.to(spin, { timeScale: 1, duration: 1 }));
    }
  }

  /* ---------- Bandeau défilant qui réagit à la vitesse du scroll ---------- */
  function initMarquee() {
    $$('[data-marquee]').forEach((track) => {
      const group = $('.marquee__group', track);
      if (!group) return;
      const clones = [];
      const fill = () => {
        clones.forEach((c) => c.remove());
        clones.length = 0;
        const needed = Math.ceil((window.innerWidth * 2) / Math.max(group.offsetWidth, 1));
        for (let i = 0; i < Math.max(1, needed); i++) {
          const clone = group.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
          clones.push(clone);
        }
      };
      fill();

      let width = group.offsetWidth;
      let x = 0;
      let direction = -1;
      let velocity = 0;
      const state = { hover: 1 };
      const setX = gsap.quickSetter(track, 'x', 'px');
      const wrap = (v) => gsap.utils.wrap(-width, 0, v);
      const st = ScrollTrigger.create({
        trigger: track,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          velocity = self.getVelocity();
          direction = self.direction === 1 ? -1 : 1;
        },
      });
      gsap.ticker.add((time, delta) => {
        if (!st.isActive) return;
        const boost = Math.min(Math.abs(velocity) / 140, 10);
        velocity *= 0.92;
        x = wrap(x + direction * 70 * (1 + boost) * state.hover * (delta / 1000));
        setX(x);
      });
      track.addEventListener('mouseenter', () => gsap.to(state, { hover: 0.25, duration: 0.6 }));
      track.addEventListener('mouseleave', () => gsap.to(state, { hover: 1, duration: 0.6 }));
      const remeasure = () => {
        fill();
        width = group.offsetWidth;
        x = wrap(x);
      };
      window.addEventListener('resize', remeasure);
      if (document.fonts) document.fonts.ready.then(remeasure);
    });
  }

  /* ---------- Découpe d'un paragraphe en mots ---------- */
  function splitWords(root) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              const word = document.createElement('span');
              word.className = 'w';
              word.textContent = part;
              frag.appendChild(word);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(root);
    return $$('.w', root);
  }

  /* ---------- Révélations au scroll ---------- */
  function initReveals() {
    // Titres ligne par ligne
    $$('[data-lines]').forEach((el) => {
      gsap.fromTo($$('.line > span', el), { yPercent: 115, rotate: 2.5 }, {
        yPercent: 0,
        rotate: 0,
        duration: 1.4,
        ease: 'expo.out',
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

    // Apparitions en fondu, par groupes
    gsap.set('[data-fade]', { autoAlpha: 0, y: 40 });
    ScrollTrigger.batch('[data-fade]', {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });

    // Filets qui se dessinent
    $$('[data-rule]').forEach((el) => {
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });

    // Images dévoilées par un rideau
    $$('[data-reveal], .gallery__item').forEach((fig) => {
      const img = $('img', fig);
      // Les images sans parallaxe rendent la main au CSS (zoom au survol) une fois révélées.
      const handOff = img.hasAttribute('data-parallax') ? {} : { clearProps: 'transform' };
      gsap
        .timeline({ scrollTrigger: { trigger: fig, start: 'top 88%' } })
        .fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' })
        .fromTo(img, { scale: 1.35 }, { scale: 1, duration: 2, ease: 'expo.out', ...handOff }, 0.1);
    });

    // Contenu de l'onglet visible (carte des plats et des boissons)
    $$('.carte__panels').forEach((panels) => {
      const active = $('.carte__panel.is-active', panels);
      if (!active) return;
      gsap.fromTo(panelRows(active), { autoAlpha: 0, y: 40 }, {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.06,
        clearProps: 'opacity,visibility,transform',
        scrollTrigger: { trigger: panels, start: 'top 88%' },
      });
    });

    // Cartes à glisser
    $$('[data-carousel]').forEach((track) => {
      gsap.fromTo($$('.card', track), { x: 140, autoAlpha: 0 }, {
        x: 0,
        autoAlpha: 1,
        duration: 1.4,
        ease: 'expo.out',
        stagger: 0.08,
        clearProps: 'transform',
        scrollTrigger: { trigger: track, start: 'top 88%' },
      });
    });

    // Parallaxe dans les cadres
    $$('img[data-parallax]').forEach((img) => {
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Parallaxe d'éléments entiers (colonnes de la galerie)
    $$('[data-speed]').forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { yPercent: speed * 50 }, {
        yPercent: -speed * 50,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Texte qui s'allume mot à mot
    $$('[data-words]').forEach((el) => {
      const words = splitWords(el);
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true },
      });
    });

    // Compteurs
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const obj = { value: 0 };
      el.textContent = '0';
      gsap.to(obj, {
        value: end,
        duration: 2.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%' },
        onUpdate: () => (el.textContent = Math.round(obj.value)),
      });
    });

    // Fond de la réservation en parallaxe
    gsap.fromTo('.reserve__bg', { yPercent: -8 }, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: '.reserve', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Mot géant du pied de page
    gsap.fromTo('.footer__word .char > span', { yPercent: 102 }, {
      yPercent: 0,
      ease: 'none',
      stagger: 0.07,
      scrollTrigger: { trigger: '.footer__word-wrap', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
    });

    // Barre de progression
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }

  /* ---------- Navigation : thème selon la section, masquage au scroll ---------- */
  function initNav() {
    if (!nav) return;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 40);
        if (html.classList.contains('menu-open')) return;
        if (self.direction === 1 && y > window.innerHeight * 0.6) nav.classList.add('is-hidden');
        else if (self.direction === -1) nav.classList.remove('is-hidden');
      },
    });

    $$('[data-nav-theme]').forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 32px',
        end: 'bottom 32px',
        onToggle: (self) => {
          if (!self.isActive) return;
          // Le bar gère lui-même le thème pendant son animation épinglée.
          if (section.id === 'bar' && ScrollTrigger.getById('bar')) return;
          setNavTheme(section.dataset.navTheme);
        },
      });
    });

    $$('.nav__links a').forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  /* ---------- Curseur personnalisé ---------- */
  function initCursor() {
    if (!finePointer) return;
    const cursor = $('.cursor');
    if (!cursor) return;
    html.classList.add('has-cursor');
    const dot = $('.cursor__dot-wrap', cursor);
    const ring = $('.cursor__ring-wrap', cursor);
    const label = $('.cursor__label', cursor);
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
    let started = false;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!started) {
        started = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) cursor.classList.add('is-hidden');
    });
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));

    const interactive = 'a, button, [role="tab"], label, select, .bar-item, .menu-item, .drink';
    document.addEventListener('pointerover', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const onText = Boolean(target.closest('input:not([type="radio"]), textarea'));
      cursor.classList.toggle('is-hidden', onText);
      const text = target.closest('[data-cursor]')?.dataset.cursor;
      cursor.classList.toggle('is-label', Boolean(text));
      cursor.classList.toggle('is-hover', !text && Boolean(target.closest(interactive)));
      if (text) label.textContent = text;
    });
  }

  /* ---------- Boutons magnétiques ---------- */
  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left - gsap.getProperty(el, 'x') + r.width / 2;
        const cy = r.top - gsap.getProperty(el, 'y') + r.height / 2;
        gsap.to(el, { x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
      });
    });
  }

  /* ---------- Préchargement puis entrée du hero ---------- */
  function intro() {
    const loader = $('.loader');
    const heroImg = $('.hero__media img');
    const countEl = $('[data-loader-count]');
    lenis?.stop();
    window.scrollTo(0, 0);

    const finish = () => {
      loader?.remove();
      html.classList.remove('is-loading');
      lenis?.start();
      // La barre de défilement réapparaît : on remesure tout.
      fitWordmarks();
      ScrollTrigger.refresh();
      if (location.hash.length > 1) {
        const target = document.querySelector(location.hash);
        if (target) scrollToTarget(target);
      }
    };

    if (!loader) {
      finish();
      return;
    }

    const decode = (img) => (img && img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    const ready = Promise.race([
      Promise.all([document.fonts ? document.fonts.ready : null, decode(heroImg)]),
      new Promise((resolve) => setTimeout(resolve, 2800)),
    ]);

    const counter = { value: 0 };
    const renderCount = () => (countEl.textContent = Math.round(counter.value));
    const loaderIn = gsap
      .timeline()
      .to('.loader__cactus path', { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.25 }, 0)
      .from('.loader__word span', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.05 }, 0.25)
      .to(counter, { value: 82, duration: 1.4, ease: 'power2.out', onUpdate: renderCount }, 0);

    Promise.all([ready, loaderIn.then()]).then(() => {
      fitWordmarks();
      ScrollTrigger.refresh();
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .to(counter, { value: 100, duration: 0.45, ease: 'power1.inOut', onUpdate: renderCount })
        .to('.loader__word span', { yPercent: -110, duration: 0.7, ease: 'expo.in', stagger: 0.03 }, '+=0.05')
        .to('.loader__cactus, .loader__foot', { autoAlpha: 0, y: -16, duration: 0.5, ease: 'power2.in' }, '<')
        .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
        .addLabel('hero', '-=0.65')
        .fromTo(heroImg, { scale: 1.35 }, { scale: 1, duration: 2.4 }, 'hero')
        .fromTo('.hero__title .char > span', { yPercent: 105 }, { yPercent: 0, duration: 1.5, stagger: 0.06 }, 'hero+=0.1')
        .from('.hero__rule', { scaleX: 0, duration: 1.6, ease: 'expo.inOut', stagger: 0.1 }, 'hero+=0.2')
        .from('[data-hero-fade]', { autoAlpha: 0, y: 30, duration: 1.3, stagger: 0.08 }, 'hero+=0.5')
        .from('.nav > *', { autoAlpha: 0, y: -24, duration: 1.2, stagger: 0.06, clearProps: 'all' }, 'hero+=0.4')
        .add(finish, 'hero+=0.3');
    });
  }

  /* ---------- Lancement ---------- */
  initHero();
  initMarquee();
  initReveals();
  initNav();
  initCursor();
  initMagnetic();
  intro();

  if (document.fonts) {
    document.fonts.ready.then(() => {
      fitWordmarks();
      ScrollTrigger.refresh();
    });
  }
})();
