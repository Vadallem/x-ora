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

// Encuadra el mapa para mostrar exactamente el conjunto de coordenadas dado: se acerca si
// están agrupadas (con un tope de zoom para que un solo punto no se acerque de más) y se
// aleja/expande solo si el conjunto lo requiere (p. ej. al agregar un punto lejano como Rusia).
// jsVectorMap no ofrece un "fit bounds" público para marcadores (solo para regiones vía
// setFocus), así que lo replicamos apoyándonos en su método público coordsToPoint(): a partir
// de la escala/traslación actuales (también públicas) invertimos esa proyección para obtener
// las coordenadas en el espacio base del mapa, y con eso pedimos a _setScale —su primitiva de
// zoom interna, la misma que usan setFocus y los botones de zoom— que centre y escale la vista.
function fitMapToPins(map, stage, coordsList, { padding = 60, maxZoomFactor = 6, animate = true } = {}) {
    if (!coordsList.length) return;

    const scale = map.scale;
    const transX = map.transX;
    const transY = map.transY;

    const basePoints = coordsList.map(([lat, lng]) => {
        const p = map.coordsToPoint(lat, lng);
        return { x: p.x / scale - transX, y: p.y / scale - transY };
    });

    const xs = basePoints.map(p => p.x);
    const ys = basePoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Margen convertido a espacio base según la escala actual (así un solo punto o dos
    // puntos idénticos no producen una caja de ancho/alto cero al dividir).
    const paddingBase = padding / scale;
    const bboxWidth = Math.max(maxX - minX + paddingBase * 2, 1);
    const bboxHeight = Math.max(maxY - minY + paddingBase * 2, 1);

    const fitScale = Math.min(stage.clientWidth / bboxWidth, stage.clientHeight / bboxHeight);
    const targetScale = Math.min(fitScale, scale * maxZoomFactor);

    map._setScale(targetScale, -(minX + maxX) / 2, -(minY + maxY) / 2, true, animate);
}

// MAPA DE COBERTURA (jsVectorMap): mapa vectorial minimalista con pines seleccionables
// (México / Estados Unidos, extensible). Los nombres de país solo se muestran al pasar
// el cursor sobre un pin — el hover de los países del mapa nunca revela su tooltip.
function initCoverageMap() {
    const stage = document.getElementById('mapStage');
    const nameEl = document.getElementById('mapCountryName');
    if (!stage || !nameEl || typeof jsVectorMap === 'undefined') return;

    const dashboard = stage.closest('.mapa-dashboard') || stage;
    const CYCLE_INTERVAL_MS = 6000;

    // Coordenadas reales (lat, lng). Agregar más bases a futuro = agregar una entrada aquí;
    // el encuadre del mapa y la alternancia automática se ajustan solos al nuevo conjunto.
    const COVERAGE_PINS = [
        { id: 'mx', country: 'México', coords: [19.4326, -99.1332] },
        { id: 'us', country: 'Estados Unidos', coords: [39.8283, -98.5795] }
    ];

    const map = new jsVectorMap({
        selector: `#${stage.id}`,
        map: 'world',
        backgroundColor: '#082a4a', // azul-medianoche
        draggable: false,
        zoomButtons: false,
        zoomOnScroll: false,
        regionsSelectable: false,
        markersSelectable: false,
        regionStyle: {
            initial: { fill: '#082a4a', stroke: '#0b6ab8', strokeWidth: 0.6 }, // azul-profundo
            hover: { fill: '#0b6ab8' } // gris-acero (sin tooltip: ver onRegionTooltipShow)
        },
        markerStyle: {
            initial: { fill: '#f7f5f0', fillOpacity: 1, stroke: '#082a4a', strokeWidth: 1.5, strokeOpacity: 1, r: 9 }, // gris-platino, +50% de tamaño
            hover: { fill: '#e35c13', stroke: '#e35c13' } // naranja-aurora
        },
        markers: COVERAGE_PINS.map(pin => ({ name: pin.country, coords: pin.coords })),
        onRegionTooltipShow(event) {
            event.preventDefault(); // Los países nunca muestran su nombre al pasar el cursor
        },
        onMarkerClick(event, index) {
            selectManually(Number(index));
        }
    });

    // Círculos SVG reales que la librería renderiza para cada pin, en el mismo orden que COVERAGE_PINS
    const markerEls = Array.from(stage.querySelectorAll('.jvm-marker'));
    const elements = new Map();

    COVERAGE_PINS.forEach((pin, index) => {
        const el = markerEls[index];
        if (!el) return;

        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-pressed', 'false');
        el.setAttribute('aria-label', `Ver cobertura en ${pin.country}`);
        el.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectManually(index);
            }
        });

        elements.set(pin.id, el);
    });

    let cycleIndex = 0;
    let cycleTimer = null;

    function selectPin(id, animate) {
        const pin = COVERAGE_PINS.find(p => p.id === id);
        if (!pin) return;

        elements.forEach((el, elId) => {
            const isSelected = elId === id;
            el.classList.toggle('is-selected', isSelected);
            el.setAttribute('aria-pressed', String(isSelected));
        });

        // El decrypt se anima solo en selecciones reales del usuario: en la selección
        // inicial (mount) el panel puede seguir fuera del viewport y DecryptText pausa
        // su animación al no estar visible, dejando el texto a medio resolver.
        if (animate && !prefersReducedMotion.matches) {
            new DecryptText(nameEl, {
                text: pin.country,
                trigger: 'mount',
                stagger: 30,
                jitter: 70
            });
        } else {
            nameEl.textContent = pin.country;
        }
    }

    // Selección disparada por el usuario (clic o teclado): además de aplicar la selección,
    // sincroniza el índice del ciclo automático y le da un respiro completo antes de retomarlo.
    function selectManually(index) {
        cycleIndex = index;
        selectPin(COVERAGE_PINS[index].id, true);
        startCycle();
    }

    function stopCycle() {
        if (cycleTimer) {
            window.clearInterval(cycleTimer);
            cycleTimer = null;
        }
    }

    function startCycle() {
        stopCycle();
        if (COVERAGE_PINS.length < 2 || prefersReducedMotion.matches) return;

        cycleTimer = window.setInterval(() => {
            cycleIndex = (cycleIndex + 1) % COVERAGE_PINS.length;
            selectPin(COVERAGE_PINS[cycleIndex].id, true);
        }, CYCLE_INTERVAL_MS);
    }

    fitMapToPins(map, stage, COVERAGE_PINS.map(p => p.coords), { animate: false });
    selectPin(COVERAGE_PINS[0].id, false);
    startCycle();

    // Pausa la alternancia automática mientras el usuario interactúa con el mapa o el panel
    // (mouse o teclado) y la retoma al salir — el ciclo no debe competir con la lectura.
    dashboard.addEventListener('mouseenter', stopCycle);
    dashboard.addEventListener('mouseleave', startCycle);
    dashboard.addEventListener('focusin', stopCycle);
    dashboard.addEventListener('focusout', startCycle);

    // jsVectorMap no re-escucha el resize por su cuenta: hay que pedirle que
    // recalcule el tamaño cuando el contenedor cambia (aspect-ratio responsivo).
    // updateSize() reescala scale/transX/transY de forma proporcional, así que conserva
    // el encuadre ya calculado por fitMapToPins en vez de volver a la vista mundial completa.
    window.addEventListener('resize', () => map.updateSize());
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
    initCoverageMap();
});
