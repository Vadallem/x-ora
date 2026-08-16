const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// NAVEGACIÓN MÓVIL
function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('mainNav');
    if (!toggle || !nav) return;

    const closeNav = () => {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
    };

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeNav();
    });

    document.addEventListener('click', event => {
        if (nav.classList.contains('is-open') && !nav.contains(event.target) && event.target !== toggle) {
            closeNav();
        }
    });
}

// CHIP FLOTANTE QUE SIGUE AL ENLACE ACTIVO/HOVER EN LA NAV
function initNavIndicator() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('a'));
    if (!links.length) return;

    const glow = document.createElement('span');
    glow.className = 'nav-glow';
    nav.insertBefore(glow, nav.firstChild);

    function moveTo(el) {
        if (!el) {
            glow.style.opacity = '0';
            return;
        }
        const navRect = nav.getBoundingClientRect();
        const linkRect = el.getBoundingClientRect();
        glow.style.opacity = '1';
        glow.style.width = `${linkRect.width}px`;
        glow.style.height = `${linkRect.height}px`;
        glow.style.transform = `translate(${linkRect.left - navRect.left}px, ${linkRect.top - navRect.top}px)`;
    }

    function restToActive() {
        moveTo(nav.querySelector('a.active-nav'));
    }

    links.forEach(link => {
        link.addEventListener('mouseenter', () => moveTo(link));
        link.addEventListener('focus', () => moveTo(link));
    });

    nav.addEventListener('mouseleave', restToActive);
    nav.addEventListener('focusout', event => {
        if (!nav.contains(event.relatedTarget)) restToActive();
    });

    window.addEventListener('resize', restToActive);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(restToActive);
    }

    restToActive();
}

// CABECERA: SE RETIRA AL BAJAR, REAPARECE AL SUBIR (nav transparente, sin bloque de fondo)
function initHeaderScrollState() {
    const header = document.getElementById('siteHeader');
    const nav = document.getElementById('mainNav');
    if (!header) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const update = () => {
        const scrollY = window.scrollY;
        const scrollingDown = scrollY > lastScrollY;
        const navOpen = nav && nav.classList.contains('is-open');

        header.classList.toggle('is-scrolled', scrollY > 40);

        if (!navOpen) {
            header.classList.toggle('is-hidden', scrollingDown && scrollY > 160);
        }

        lastScrollY = scrollY;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });

    update();
}

// REVELACIÓN DE SECCIONES AL ENTRAR EN VIEWPORT
function initScrollReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    targets.forEach(el => observer.observe(el));
}

// VIDEO DE FONDO DEL HERO
function initHeroVideo() {
    const video = document.getElementById('heroVideo');
    if (!video) return;

    if (prefersReducedMotion.matches) {
        video.pause();
        return;
    }

    video.play().catch(() => {});
}

// SWITCH X — ORA: CONTROL SEGMENTADO (TRANSICIÓN ENTRE TERRITORIOS)
function initTerritorySwitch() {
    const xoraSwitch = document.getElementById('xoraSwitch');
    const wrapper = document.getElementById('territoryWrapper');
    const caption = document.getElementById('switchCaption');
    const announce = document.getElementById('switchAnnounce');

    if (!xoraSwitch || !wrapper) return;

    const segments = {
        services: document.getElementById('segServices'),
        studio: document.getElementById('segStudio')
    };

    const panels = {
        services: document.getElementById('panel-services'),
        studio: document.getElementById('panel-studio')
    };

    const copy = {
        services: 'x-ora Services — infraestructura crítica',
        studio: 'x-ora Studio — aprendizaje STEAM de alto nivel'
    };

    let current = wrapper.dataset.territory || 'services';
    let isAnimating = false;

    function reflectSegments(territory) {
        Object.entries(segments).forEach(([name, btn]) => {
            const isActive = name === territory;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', String(isActive));
            btn.tabIndex = isActive ? 0 : -1;
        });
    }

    function setStaticState(territory) {
        xoraSwitch.dataset.territory = territory;
        wrapper.dataset.territory = territory;
        reflectSegments(territory);
        caption.textContent = copy[territory];
        Object.entries(panels).forEach(([name, panel]) => {
            panel.hidden = name !== territory;
        });
    }

    function switchTo(territory) {
        if (territory === current || isAnimating) return;

        const outgoing = panels[current];
        const incoming = panels[territory];

        if (prefersReducedMotion.matches) {
            outgoing.hidden = true;
            incoming.hidden = false;
            current = territory;
            setStaticState(territory);
            announce.textContent = copy[territory];
            return;
        }

        isAnimating = true;

        // Bloquea la altura actual del contenedor para animar hacia la nueva.
        const startHeight = wrapper.getBoundingClientRect().height;
        wrapper.style.height = `${startHeight}px`;
        wrapper.classList.add('is-transitioning');

        xoraSwitch.dataset.territory = territory;
        reflectSegments(territory);
        caption.textContent = copy[territory];

        outgoing.classList.add('panel-exit');

        incoming.hidden = false;
        incoming.classList.add('panel-enter');

        // Mide la altura natural del panel entrante ya visible (posición absoluta) y anima hacia ella.
        requestAnimationFrame(() => {
            const endHeight = incoming.scrollHeight;
            wrapper.dataset.territory = territory;
            requestAnimationFrame(() => {
                wrapper.style.height = `${endHeight}px`;
            });
        });

        window.setTimeout(() => {
            outgoing.hidden = true;
            outgoing.classList.remove('panel-exit');
            incoming.classList.remove('panel-enter');
            wrapper.classList.remove('is-transitioning');
            wrapper.style.height = '';
            current = territory;
            isAnimating = false;
            announce.textContent = copy[territory];
        }, 640);
    }

    Object.entries(segments).forEach(([name, btn]) => {
        btn.addEventListener('click', event => {
            if (justDragged) {
                event.preventDefault();
                return;
            }
            switchTo(name);
        });
    });

    xoraSwitch.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const target = current === 'services' ? 'studio' : 'services';
        switchTo(target);
        segments[target].focus();
    });

    // ARRASTRE / SLIDE CON EL DEDO (touch, pen y mouse vía Pointer Events)
    const glide = xoraSwitch.querySelector('.switch-glide');
    let dragging = false;
    let justDragged = false;
    let startX = 0;
    let baseOffset = 0;
    let trackWidth = 0;

    function segmentWidth() {
        return xoraSwitch.getBoundingClientRect().width / 2;
    }

    xoraSwitch.addEventListener('pointerdown', event => {
        if (isAnimating) return;
        dragging = true;
        startX = event.clientX;
        trackWidth = segmentWidth();
        baseOffset = current === 'studio' ? trackWidth : 0;
        glide.classList.add('is-dragging');
        xoraSwitch.setPointerCapture(event.pointerId);
    });

    xoraSwitch.addEventListener('pointermove', event => {
        if (!dragging) return;
        const deltaX = event.clientX - startX;
        if (Math.abs(deltaX) > 10) justDragged = true;
        const offset = Math.min(Math.max(baseOffset + deltaX, 0), trackWidth);
        glide.style.transform = `translateX(${offset}px)`;
    });

    function endDrag(event) {
        if (!dragging) return;
        dragging = false;

        if (!justDragged) {
            glide.classList.remove('is-dragging');
            glide.style.transform = '';
            return;
        }

        const deltaX = event.clientX - startX;
        const offset = Math.min(Math.max(baseOffset + deltaX, 0), trackWidth);
        const territory = offset > trackWidth / 2 ? 'studio' : 'services';

        switchTo(territory);

        requestAnimationFrame(() => {
            glide.classList.remove('is-dragging');
            glide.style.transform = '';
        });

        window.setTimeout(() => { justDragged = false; }, 80);
    }

    xoraSwitch.addEventListener('pointerup', endDrag);
    xoraSwitch.addEventListener('pointercancel', endDrag);
}

document.addEventListener('DOMContentLoaded', () => {
    initNavToggle();
    initNavIndicator();
    initHeaderScrollState();
    initScrollReveal();
    initHeroVideo();
    initTerritorySwitch();
});
