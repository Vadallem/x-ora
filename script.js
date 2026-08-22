const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// COMPONENTE DECRYPT TEXT: revela un texto carácter a carácter desde glifos aleatorios
const DECRYPT_GLYPHS = '#%&@$?!*+=/{}[]<>~^';

class DecryptText {
    constructor(el, options = {}) {
        this.el = el;
        this.text = options.text ?? el.textContent.trim();
        this.trigger = options.trigger || 'mount';
        this.speed = options.speed ?? 45;
        this.stagger = options.stagger ?? 38;
        this.startDelay = options.startDelay ?? 0;
        this.jitter = options.jitter ?? 120;
        this.loop = options.loop ?? false;
        this.retriggerOnHover = Boolean(options.retriggerOnHover);
        this.glyphs = options.glyphs || DECRYPT_GLYPHS;

        this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._rafId = null;
        this._loopTimer = null;
        this._loopPending = false;
        this._chars = [];
        this._active = false;
        this._startTime = 0;
        this._pausedAt = null;
        this._hasPlayed = false;
        this._lastHoverAt = 0;
        this._inViewport = true;
        this._observer = null;
        this._boundVisibilityChange = () => this._handleVisibilityChange();
        this._boundHover = () => this._handleHover();

        this._buildDOM();

        if (this._reducedMotion.matches) {
            this._resolveAllImmediately();
            return;
        }

        this._bindVisibility();
        this._bindTriggerListeners();

        if (this.trigger === 'mount') this.play();
    }

    _buildDOM() {
        this.el.classList.add('decrypt-host');
        this.el.setAttribute('aria-label', this.text);
        this.el.textContent = '';

        const wrap = document.createElement('span');
        wrap.className = 'decrypt-chars';
        wrap.setAttribute('aria-hidden', 'true');

        this._chars = Array.from(this.text).map((char, index) => {
            const span = document.createElement('span');
            span.className = 'decrypt-char';
            const isSpace = /\s/.test(char);
            span.textContent = isSpace ? char : this._randomGlyph();
            wrap.appendChild(span);
            return {
                span,
                target: char,
                isSpace,
                resolved: isSpace,
                resolveAt: this.startDelay + index * this.stagger + this._jitterOffset(),
                lastSwap: 0
            };
        });

        this.el.appendChild(wrap);
    }

    _jitterOffset() {
        if (!this.jitter) return 0;
        return Math.round((Math.random() - 0.5) * this.jitter);
    }

    _randomGlyph() {
        return this.glyphs[Math.floor(Math.random() * this.glyphs.length)];
    }

    _resolveAllImmediately() {
        this._chars.forEach(c => {
            c.span.textContent = c.target;
            c.resolved = true;
        });
    }

    _bindVisibility() {
        if (!('IntersectionObserver' in window)) {
            this._inViewport = true;
        } else {
            this._observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    this._inViewport = entry.isIntersecting;
                    if (entry.isIntersecting) {
                        if (this.trigger === 'inview' && !this._hasPlayed) {
                            this.play();
                        } else {
                            this._resume();
                        }
                    } else {
                        this._pause();
                    }
                });
            }, { threshold: 0.15 });
            this._observer.observe(this.el);
        }

        document.addEventListener('visibilitychange', this._boundVisibilityChange);
    }

    _handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this._pause();
        } else {
            this._resume();
        }
    }

    _bindTriggerListeners() {
        if (this.trigger === 'hover' || this.retriggerOnHover) {
            this.el.addEventListener('pointerenter', this._boundHover);
        }
    }

    _handleHover() {
        const now = performance.now();
        if (this.trigger === 'hover' && !this._hasPlayed) {
            this.play();
            return;
        }
        if (this.retriggerOnHover && this._hasPlayed) {
            if (now - this._lastHoverAt < 1500) return;
            this._lastHoverAt = now;
            this.play();
        }
    }

    play() {
        if (this._reducedMotion.matches) {
            this._resolveAllImmediately();
            return;
        }

        this._hasPlayed = true;
        clearTimeout(this._loopTimer);
        this._loopTimer = null;
        this._loopPending = false;

        this._chars.forEach((c, index) => {
            if (!c.isSpace) {
                c.resolved = false;
                c.span.textContent = this._randomGlyph();
                c.span.classList.remove('is-flash');
            }
            c.lastSwap = 0;
            c.resolveAt = this.startDelay + index * this.stagger + this._jitterOffset();
        });

        this._startTime = performance.now();
        this._pausedAt = null;
        this._active = true;
        this._rafId = requestAnimationFrame(() => this._tick());
    }

    _tick() {
        if (!this._active) return;

        if (document.visibilityState === 'hidden' || !this._inViewport) {
            this._pause();
            return;
        }

        const elapsed = performance.now() - this._startTime;
        let allResolved = true;

        for (const c of this._chars) {
            if (c.resolved) continue;

            if (elapsed >= c.resolveAt) {
                c.span.textContent = c.target;
                c.resolved = true;
                c.span.classList.add('is-flash');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => c.span.classList.remove('is-flash'));
                });
            } else {
                allResolved = false;
                if (elapsed - c.lastSwap >= this.speed) {
                    c.span.textContent = this._randomGlyph();
                    c.lastSwap = elapsed;
                }
            }
        }

        if (allResolved) {
            this._active = false;
            this._rafId = null;
            if (this.loop) {
                this._loopTimer = setTimeout(() => this.play(), this._loopDelay());
            }
            return;
        }

        this._rafId = requestAnimationFrame(() => this._tick());
    }

    _pause() {
        if (this._pausedAt !== null) return;
        this._pausedAt = performance.now();

        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._loopTimer) {
            clearTimeout(this._loopTimer);
            this._loopTimer = null;
            this._loopPending = true;
        }
    }

    _resume() {
        if (this._pausedAt === null) return;
        const pausedDuration = performance.now() - this._pausedAt;
        this._pausedAt = null;

        if (this._active) {
            this._startTime += pausedDuration;
            this._rafId = requestAnimationFrame(() => this._tick());
        } else if (this._loopPending) {
            this._loopPending = false;
            this._loopTimer = setTimeout(() => this.play(), this._loopDelay());
        }
    }

    _loopDelay() {
        return typeof this.loop === 'function' ? this.loop() : this.loop;
    }

    destroy() {
        this._active = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        clearTimeout(this._loopTimer);
        if (this._observer) this._observer.disconnect();
        document.removeEventListener('visibilitychange', this._boundVisibilityChange);
        this.el.removeEventListener('pointerenter', this._boundHover);
    }
}

// NAVEGACIÓN MÓVIL (MENÚ DESPLEGABLE DE LA NAV LATERAL)
function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('navLinks');
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
    const nav = document.getElementById('navLinks');
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

// TITULAR DEL HERO: EFECTO DECRYPT (de la incógnita a la primera luz)
function initHeroDecrypt() {
    const lines = document.querySelectorAll('.hero-title .line-inner');
    if (!lines.length) return;

    lines.forEach((line, index) => {
        new DecryptText(line, {
            trigger: 'mount',
            stagger: 34,
            jitter: 90,
            startDelay: 150 + index * 260,
            retriggerOnHover: true
        });
    });
}

// TITULAR "COMING SOON": MISMO EFECTO DECRYPT DEL HERO, RETRIGGERED CADA 3-5s
function initComingSoonDecrypt() {
    const lines = document.querySelectorAll('.hero-title-xl .line-inner');
    if (!lines.length) return;

    lines.forEach((line, index) => {
        new DecryptText(line, {
            trigger: 'mount',
            stagger: 34,
            jitter: 90,
            startDelay: 150 + index * 260,
            loop: () => 3000 + Math.random() * 2000
        });
    });
}

// TABS DE CONTACTO: ALTERNA ENTRE LAS DIVISIONES SERVICES Y STUDIO
function initContactTabs() {
    const buttons = document.querySelectorAll('.tab-btn[data-tab-target]');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tabTarget;
            const isStudio = targetId === 'contact-studio';

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.toggle('active', section.id === targetId);
            });

            buttons.forEach(b => b.classList.remove('active-services', 'active-studio'));
            btn.classList.add(isStudio ? 'active-studio' : 'active-services');
        });
    });
}

// BOTÓN DIAGONAL SERVICES / STUDIO: TRANSICIÓN ENTRE TERRITORIOS
function initTerritorySwitch() {
    const xoraDiagonal = document.getElementById('xoraDiagonal');
    const wrapper = document.getElementById('territoryWrapper');
    const announce = document.getElementById('switchAnnounce');

    if (!xoraDiagonal || !wrapper) return;

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
        xoraDiagonal.dataset.territory = territory;
        wrapper.dataset.territory = territory;
        reflectSegments(territory);
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

        xoraDiagonal.dataset.territory = territory;
        reflectSegments(territory);

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
        btn.addEventListener('click', () => switchTo(name));
    });

    xoraDiagonal.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const target = current === 'services' ? 'studio' : 'services';
        switchTo(target);
        segments[target].focus();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initNavToggle();
    initNavIndicator();
    initScrollReveal();
    initHeroVideo();
    initHeroDecrypt();
    initComingSoonDecrypt();
    initTerritorySwitch();
    initContactTabs();
});
