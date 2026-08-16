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

// SOMBRA DE CABECERA AL HACER SCROLL
function initHeaderScrollState() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    let ticking = false;
    const update = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 40);
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

// SWITCH X — ORA: TRANSICIÓN ENTRE TERRITORIOS
function initTerritorySwitch() {
    const xoraSwitch = document.getElementById('xoraSwitch');
    const range = document.getElementById('territoryRange');
    const wrapper = document.getElementById('territoryWrapper');
    const labelServices = document.getElementById('labelServices');
    const labelStudio = document.getElementById('labelStudio');
    const caption = document.getElementById('switchCaption');
    const announce = document.getElementById('switchAnnounce');

    if (!xoraSwitch || !range || !wrapper) return;

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

    function setStaticState(territory) {
        xoraSwitch.dataset.territory = territory;
        wrapper.dataset.territory = territory;
        labelServices.classList.toggle('is-active', territory === 'services');
        labelStudio.classList.toggle('is-active', territory === 'studio');
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
        labelServices.classList.toggle('is-active', territory === 'services');
        labelStudio.classList.toggle('is-active', territory === 'studio');
        caption.textContent = copy[territory];

        xoraSwitch.classList.add('is-pulsing');
        xoraSwitch.addEventListener('animationend', () => {
            xoraSwitch.classList.remove('is-pulsing');
        }, { once: true });

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

    range.addEventListener('input', () => {
        switchTo(range.value === '1' ? 'studio' : 'services');
    });

    [labelServices, labelStudio].forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.target;
            range.value = target === 'studio' ? '1' : '0';
            switchTo(target);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initNavToggle();
    initHeaderScrollState();
    initScrollReveal();
    initTerritorySwitch();
});
