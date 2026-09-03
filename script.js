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

// MENÚ HAMBURGUESA (colapso de .top-nav-links en móvil, breakpoint 768px)
function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('navLinks');
    if (!toggle || !nav) return;

    function closeMenu() {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú de navegación');
    }

    function openMenu() {
        nav.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Cerrar menú de navegación');
    }

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.contains('is-open');
        isOpen ? closeMenu() : openMenu();
    });

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeMenu();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });
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
    }, { threshold: 0.2, rootMargin: '0px 0px -15% 0px' });

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
// En home.html (.hero-home) se repite sola cada 2-3s; en el "Coming Soon" de index.html
// se mantiene como estaba (solo al montar / al pasar el cursor).
function initHeroDecrypt() {
    const lines = document.querySelectorAll('.hero-title .line-inner');
    if (!lines.length) return;
    const isHome = Boolean(document.querySelector('.hero-home'));

    lines.forEach((line, index) => {
        new DecryptText(line, {
            trigger: 'mount',
            stagger: 34,
            jitter: 90,
            startDelay: 150 + index * 260,
            retriggerOnHover: true,
            loop: isHome ? (() => 2000 + Math.random() * 1000) : false
        });
    });
}

// QUÉ SIGNIFICA X-ORA (about.html): cada símbolo oversized (X, guion, ORA) se decodifica
// al entrar en el viewport — mismo componente que el titular del hero, pero disparado por
// scroll ('inview') en vez de al montar, para explicarlos uno a uno según se avanza.
function initXoraMeaningDecrypt() {
    const symbols = document.querySelectorAll('.xora-def-symbol');
    if (!symbols.length) return;

    symbols.forEach(symbol => {
        new DecryptText(symbol, {
            trigger: 'inview',
            speed: 40,
            stagger: 55,
            jitter: 140
        });
    });
}

// KICKER DEL HERO DE ABOUT ("¿Quiénes somos?"): mismo componente decrypt que los
// titulares, pero disparado al montar (está en el primer viewport) en vez de por scroll.
function initAboutHeroDecrypt() {
    const kicker = document.querySelector('.hero-about .descriptor');
    if (!kicker) return;

    new DecryptText(kicker, {
        trigger: 'mount',
        speed: 40,
        stagger: 40,
        jitter: 100,
        startDelay: 80
    });
}

// INTRO DE MARCA (home.html): recreación en código de X-ORA.mp4 — letras → wipe → blanco → fade out,
// y solo entonces revela el Hero (para que el decrypt del título se vea, no corra oculto detrás de la intro).
function initIntro() {
    const overlay = document.getElementById('introOverlay');
    const html = document.documentElement;
    // Solo home.html activa este flujo (vía el script inline en su <head>); index.html usa
    // "no-scroll" de forma permanente para su propio diseño de una sola pantalla y no debe tocarse.
    const introWasPending = html.classList.contains('intro-pending');

    function revealHero() {
        const content = document.querySelector('.hero-content');
        if (content) content.classList.add('is-visible');
        const logo = document.querySelector('.hero-logo-mark');
        if (logo) logo.classList.add('is-visible');
        initHeroDecrypt();
    }

    function unlockScroll() {
        if (introWasPending) html.classList.remove('no-scroll', 'intro-pending');
    }

    function finishIntro() {
        try { sessionStorage.setItem('xoraIntroSeen', '1'); } catch (e) {}
        unlockScroll();
        if (overlay) overlay.remove();
        revealHero();
    }

    const skip = !overlay || html.classList.contains('intro-skip') || prefersReducedMotion.matches;

    if (skip) {
        unlockScroll();
        revealHero();
        return;
    }

    let done = false;
    const finishNow = () => {
        if (done) return;
        done = true;
        finishIntro();
    };

    overlay.addEventListener('click', finishNow);

    // Deja "X-ORA" completo y legible en pantalla un instante antes de barrer
    // (la última letra termina de entrar a los 580ms; 900ms le da ~320ms de lectura).
    window.setTimeout(() => overlay.classList.add('is-wiping'), 900);
    window.setTimeout(() => overlay.classList.add('is-done'), 1300);
    window.setTimeout(finishNow, 1650);
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
        services: 'X-ORA Services — infraestructura crítica',
        studio: 'X-ORA Studio — aprendizaje STEAM de alto nivel'
    };

    let current = wrapper.dataset.territory || 'services';
    let isAnimating = false;

    // Mide la altura natural de un panel aunque esté oculto (hidden), sin que se note el
    // parpadeo: lo saca del flujo e invisible mientras se mide, luego lo vuelve a ocultar.
    // Usa el tamaño de la propia caja (no scrollHeight): el muro de fotos de Studio es
    // "position: absolute" y se sale a propósito por arriba/abajo, y scrollHeight cuenta
    // ese desborde como si fuera contenido normal, inflando la medición.
    function measureNaturalHeight(panel) {
        const wasHidden = panel.hidden;
        if (wasHidden) {
            panel.hidden = false;
            panel.style.visibility = 'hidden';
        }
        // Neutraliza en línea el position:absolute + inset:0 + height:100% fijos por CSS
        // (que estiran el panel visible al alto del wrapper): sin esto, mediríamos el alto
        // ya estirado en vez del alto natural del contenido, y el más alto de los dos
        // paneles nunca podría medirse correctamente (siempre daría el alto del wrapper).
        panel.style.position = 'absolute';
        panel.style.top = 'auto';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = '0';
        panel.style.width = '100%';
        panel.style.height = 'auto';
        const height = panel.getBoundingClientRect().height;
        panel.style.position = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.style.left = '';
        panel.style.width = '';
        panel.style.height = '';
        if (wasHidden) {
            panel.style.visibility = '';
            panel.hidden = true;
        }
        return height;
    }

    // Ambos paneles comparten una sola altura fija (la del más alto) para que el contenedor
    // no se agrande ni encoja al cambiar de territorio — solo cambia el contenido. Se fija
    // "height" (no "min-height"): el panel visible se estira al 100% de este alto (ver CSS
    // ".territory-panel"), y una altura de contenedor solo "mínima" no es un valor definido
    // sobre el que un hijo pueda resolver un "height: 100%".
    function syncWrapperHeight() {
        const tallest = Math.max(
            measureNaturalHeight(panels.services),
            measureNaturalHeight(panels.studio)
        );
        wrapper.style.height = `${tallest}px`;
    }

    syncWrapperHeight();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(syncWrapperHeight, 150);
    });

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
        wrapper.classList.add('is-transitioning');

        xoraDiagonal.dataset.territory = territory;
        wrapper.dataset.territory = territory;
        reflectSegments(territory);

        outgoing.classList.add('panel-exit');

        incoming.hidden = false;
        incoming.classList.add('panel-enter');

        window.setTimeout(() => {
            outgoing.hidden = true;
            outgoing.classList.remove('panel-exit');
            incoming.classList.remove('panel-enter');
            wrapper.classList.remove('is-transitioning');
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

// CARRUSEL DE TEXTO GENÉRICO (una palabra a la vez, con fundido): usado tanto por
// "Aprendizajes y Clases" en studio.html como por "Alcance" en services.html. Corre sin
// pausa al pasar el cursor —se mantiene girando siempre, en ambos usos— y respeta
// prefers-reduced-motion mostrando la lista completa en vez de animarla.
function initWordCarousel(elementId, words, intervalMs = 1700) {
    const word = document.getElementById(elementId);
    if (!word || !words.length) return;

    let index = 0;

    if (prefersReducedMotion.matches) {
        word.textContent = words.join(' · ');
        return;
    }

    function rotate() {
        word.classList.add('is-swapping');
        setTimeout(() => {
            index = (index + 1) % words.length;
            word.textContent = words[index];
            word.classList.remove('is-swapping');
        }, 300);
    }

    setInterval(rotate, intervalMs);
}

// STUDIO: CARRUSEL DE TEXTO "APRENDIZAJES Y CLASES" (robótica / ciencia / programación)
function initStudioCarousel() {
    initWordCarousel('studioCarouselWord', ['Robótica', 'Ciencia', 'Programación', 'Electrónica', 'Diseño', 'Automatización', 'Prototipado', 'Innovación', 'Aprendizaje']);
}

// SERVICES: CARRUSEL DE TEXTO "ALCANCE" (los países donde x-ora tiene presencia)
function initAlcanceCarousel() {
    initWordCarousel('alcanceCarouselWord', ['México', 'Estados Unidos', 'Panamá', 'Liberia', 'Jordania', 'Turquía', 'Chad', 'Nigeria', 'Perú', 'Guatemala', 'Gabón', 'Kosovo', 'Kirguistán', 'Esuatini', 'India', 'Guam', 'Nicaragua']);
}

// STUDIO: CARRUSEL DE UNA SOLA IMAGEN (INSTALACIONES)
function initStudioFacilities() {
    const carousel = document.getElementById('facilitiesCarousel');
    const layers = [
        document.getElementById('facilitiesCarouselImgA'),
        document.getElementById('facilitiesCarouselImgB')
    ];
    const dotsWrap = document.getElementById('facilitiesDots');
    const prevBtn = document.getElementById('facilitiesPrev');
    const nextBtn = document.getElementById('facilitiesNext');
    if (!carousel || !layers[0] || !layers[1] || !dotsWrap || !prevBtn || !nextBtn) return;

    const items = [
        { src: 'assets/Studio/classroom/1.jpg', alt: 'Estación de trabajo en el taller de X-ORA Studio' },
        { src: 'assets/Studio/classroom/2.jpg', alt: 'Zona de prototipado de X-ORA Studio' },
        { src: 'assets/Studio/classroom/3.jpg', alt: 'Área de ensamblaje y trabajo manipulativo' },
        { src: 'assets/Studio/classroom/4.jpg', alt: 'Espacio de cómputo y programación' },
        { src: 'assets/Studio/classroom/5.jpg', alt: 'Vista general del salón de X-ORA Studio' }
    ];

    // Precarga todas las fotos para que la capa "buffer" nunca tenga que
    // esperar una descarga cuando el usuario navegue el carrusel.
    items.forEach(item => { new Image().src = item.src; });

    let current = 0;
    let activeIndex = 0;

    const dots = items.map((item, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Ir a la imagen ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
        return dot;
    });

    function renderDots() {
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
    }

    // Crossfade con dos <img> apiladas (ver .facilities-carousel-img en el CSS):
    // la entrante se precarga oculta y solo se cruza con la saliente cuando ya
    // terminó de decodificar. Así nunca hay un instante con el <img> vacío ni
    // un cambio de src a medio fundido — lo que se veía como "el fade no hace
    // nada y luego cambia de golpe" cuando una sola imagen cargaba su nuevo
    // src mientras estaba en opacity:0.
    function goTo(index) {
        current = (index + items.length) % items.length;
        renderDots();
        const target = items[current];

        const activeLayer = layers[activeIndex];
        const bufferIndex = 1 - activeIndex;
        const bufferLayer = layers[bufferIndex];

        if (prefersReducedMotion.matches) {
            activeLayer.src = target.src;
            activeLayer.alt = target.alt;
            return;
        }

        function crossfade() {
            bufferLayer.classList.add('is-active');
            bufferLayer.removeAttribute('aria-hidden');
            activeLayer.classList.remove('is-active');
            activeLayer.setAttribute('aria-hidden', 'true');
            activeIndex = bufferIndex;
        }

        bufferLayer.alt = target.alt;

        // Si la capa "buffer" ya tenía cargada justo esta imagen (p. ej. al
        // volver con "anterior" a la foto que quedó en el buffer), cambiar el
        // src al mismo valor no vuelve a disparar "load" en la mayoría de los
        // navegadores — se cruza de inmediato en vez de quedarse esperando un
        // evento que nunca llega.
        const targetUrl = new URL(target.src, document.baseURI).href;
        if (bufferLayer.src === targetUrl && bufferLayer.complete) {
            crossfade();
        } else {
            bufferLayer.onload = crossfade;
            bufferLayer.src = target.src;
        }
    }

    renderDots();

    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));

    carousel.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight') goTo(current + 1);
        if (event.key === 'ArrowLeft') goTo(current - 1);
    });

    if (prefersReducedMotion.matches) return;

    // Un solo temporizador controlado por dos banderas (hover/foco): evita que
    // mouseleave y focusout, si se disparan por separado, terminen creando dos
    // intervalos simultáneos (eso causaba el salto/parpadeo visto solo en el
    // avance automático, nunca al hacer clic manualmente).
    let timer = null;
    let isHovering = false;
    let isFocused = false;

    function stopAutoplay() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function startAutoplay() {
        if (timer || isHovering || isFocused) return;
        timer = setInterval(() => goTo(current + 1), 4500);
    }

    carousel.addEventListener('mouseenter', () => { isHovering = true; stopAutoplay(); });
    carousel.addEventListener('mouseleave', () => { isHovering = false; startAutoplay(); });
    carousel.addEventListener('focusin', () => { isFocused = true; stopAutoplay(); });
    carousel.addEventListener('focusout', () => { isFocused = false; startAutoplay(); });

    startAutoplay();
}

// MAPA DE COBERTURA (jsVectorMap): mapa mundial completo y estático para la sección
// "Alcance" de services.html — sin clic, sin teclado, sin pines, sin paneo. Los países sin
// presencia quedan en azul claro (relleno y contorno); los países con base propia quedan en
// azul profundo con contorno blanco, para que resalten sobre el resto (choropleth vía
// "series.regions"). jsVectorMap centra y ajusta el mapa completo al contenedor por su cuenta.
function initCoverageMap() {
    const stage = document.getElementById('mapStage');
    if (!stage || typeof jsVectorMap === 'undefined') return;

    // Países ISO2 con base propia (alimentan el relleno/contorno destacado más abajo).
    const PRESENT_ISO = ['MX', 'US', 'PA', 'LR', 'JO', 'TR', 'TD', 'NG', 'PE', 'GT', 'GA', 'XK', 'KG', 'SZ', 'IN', 'GU', 'NI'];
    const presentIsoValues = Object.fromEntries(PRESENT_ISO.map(iso => [iso, 1]));

    const map = new jsVectorMap({
        selector: `#${stage.id}`,
        map: 'world',
        backgroundColor: '#f7f5f0', // blanco hueso
        draggable: false,
        zoomButtons: false,
        zoomOnScroll: false,
        regionsSelectable: false,
        markersSelectable: false,
        regionStyle: {
            // Países sin presencia: azul claro, relleno y contorno iguales. El contorno un
            // poco más grueso que el relleno tapa la línea blanca de fondo que se asoma por
            // el hairline entre países vecinos (artefacto de antialiasing del SVG del mapa).
            initial: { fill: '#0b6ab8', stroke: '#0b6ab8', strokeWidth: 1.2 }
            // Sin "hover": el mapa es puramente ilustrativo (ver pointer-events:none en
            // .jvm-region, styles.css) — los países ya no se iluminan al pasar el cursor.
        },
        // Países con base propia: relleno azul profundo y contorno blanco hueso, para que
        // resalten sobre el resto (dos series de choropleth de valor uniforme —mismo color en
        // ambos extremos de la escala—, una por atributo).
        series: {
            regions: [
                {
                    attribute: 'fill',
                    values: presentIsoValues,
                    scale: ['#082a4a', '#082a4a'],
                    normalizeFunction: 'polynomial'
                },
                {
                    attribute: 'stroke',
                    values: presentIsoValues,
                    scale: ['#f7f5f0', '#f7f5f0'],
                    normalizeFunction: 'polynomial'
                }
            ]
        }
    });

    // jsVectorMap no re-escucha el resize por su cuenta: hay que pedirle que recalcule el
    // tamaño cuando el contenedor cambia (aspect-ratio responsivo), para que el mapa completo
    // se mantenga centrado y ajustado al escenario.
    window.addEventListener('resize', () => map.updateSize());
}

// SERVICES: CARRUSEL DE TARJETAS "SISTEMAS Y ALCANCE" (dos a la vez, con flechas).
// Avanza por "páginas" moviendo el track en píxeles (el ancho del viewport por página):
// el track es un flex row cuyo ancho de caja queda limitado al del viewport (overflow:hidden
// en el padre), así que un translateX en % —relativo al ancho de la propia caja del track,
// no al de su contenido desbordado— no alcanza a desplazar una página completa.
function initServicesSystemsCarousel() {
    const viewport = document.getElementById('servicesSystemsViewport');
    const track = document.getElementById('servicesSystemsTrack');
    const prevBtn = document.getElementById('servicesSystemsPrev');
    const nextBtn = document.getElementById('servicesSystemsNext');
    if (!viewport || !track || !prevBtn || !nextBtn) return;

    const cards = Array.from(track.children);
    // Debe coincidir con el breakpoint de .services-systems-track .service-card en styles.css
    const perPageQuery = window.matchMedia('(min-width: 480px)');
    let page = 0;

    function perPage() {
        return perPageQuery.matches ? 2 : 1;
    }

    function pageCount() {
        return Math.max(1, Math.ceil(cards.length / perPage()));
    }

    function render() {
        const count = pageCount();
        page = Math.min(page, count - 1);
        // El ancho de una "página" ya incluye el gap ENTRE sus propias tarjetas (ver
        // .services-systems-track .service-card en styles.css: flex-basis descuenta ese gap
        // para que N tarjetas + sus gaps internos sumen exactamente el ancho del viewport).
        // Pero entre el último elemento de una página y el primero de la siguiente hay OTRO
        // gap del track que no pertenece a ninguna página — hay que sumarlo por cada página
        // avanzada o el desplazamiento se queda corto y arrastra un poco de la tarjeta vecina.
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        track.style.transform = `translateX(-${page * (viewport.clientWidth + gap)}px)`;
    }

    function goTo(index) {
        const count = pageCount();
        page = (index + count) % count;
        render();
    }

    prevBtn.addEventListener('click', () => goTo(page - 1));
    nextBtn.addEventListener('click', () => goTo(page + 1));

    // Al cruzar el breakpoint (1 <-> 2 tarjetas por página) el número de páginas cambia:
    // se reinicia a la primera para no dejar el track en una posición inválida.
    perPageQuery.addEventListener('change', () => {
        page = 0;
        render();
    });
    window.addEventListener('resize', render);

    render();

    // Modo automático: avanza sola cada 4.5s y hace loop; se pausa mientras el cursor o el
    // foco estén sobre el carrusel (mismo criterio que .facilities-carousel en studio.html)
    // y se retoma al salir.
    if (prefersReducedMotion.matches) return;

    let timer = null;
    let isHovering = false;
    let isFocused = false;

    function stopAutoplay() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function startAutoplay() {
        if (timer || isHovering || isFocused) return;
        timer = setInterval(() => goTo(page + 1), 4500);
    }

    const carouselEl = viewport.closest('.services-systems-carousel') || viewport;
    carouselEl.addEventListener('mouseenter', () => { isHovering = true; stopAutoplay(); });
    carouselEl.addEventListener('mouseleave', () => { isHovering = false; startAutoplay(); });
    carouselEl.addEventListener('focusin', () => { isFocused = true; stopAutoplay(); });
    carouselEl.addEventListener('focusout', () => { isFocused = false; startAutoplay(); });

    startAutoplay();
}

document.addEventListener('DOMContentLoaded', () => {
    initNavIndicator();
    initNavToggle();
    initScrollReveal();
    initHeroVideo();
    initIntro();
    initComingSoonDecrypt();
    initAboutHeroDecrypt();
    initXoraMeaningDecrypt();
    initTerritorySwitch();
    initStudioCarousel();
    initStudioFacilities();
    initServicesSystemsCarousel();
    initAlcanceCarousel();
    initCoverageMap();
});
