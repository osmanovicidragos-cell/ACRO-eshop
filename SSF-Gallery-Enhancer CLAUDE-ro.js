
 *   Google Tag Manager sau orice mecanism care adaugă JS extern, ex.:
 *     <script src="/CALE/SSF-Gallery-Enhancer.js" defer></script>
 *   Scriptul găsește singur galeria, injectează singur CSS-ul și construiește singur afișarea.
 *
 * CUM MODIFICI DESIGN-UL (fără să atingi restul fișierului):
 *   Tot ce ține de aspect (culori, colțuri rotunjite, fonturi, spațiere) este
 *   centralizat în obiectul THEME de mai jos. Schimbă doar valorile de acolo —
 *   restul CSS-ului (mai jos, în injectCSS) folosește automat aceste valori
 *   prin variabile CSS (var(--ssfx-...)), deci nu trebuie umblat prin CSS.
 *   Tot ce ține de TEXT/COMPORTAMENT (etichete, praguri, monedă) este în CFG.
 * ========================================================================== */

(function () {
    })();

    /* ---------------------------------------------------------------------- */
    /*  CONFIGURARE (ușor de ajustat)                                          */
    /*  CONFIGURARE COMPORTAMENT (ușor de ajustat)                             */
    /*  Texte, monedă, praguri de filtrare. Pentru CULORI / DESIGN vezi THEME. */
    /* ---------------------------------------------------------------------- */
    var CFG = {
        currency: 'Lei',
        // Ascunde DOAR grila originală de produse (modelele vechi / tab-urile vechi).
        // Banner-ul, header-ul, footer-ul și restul conținutului RĂMÂN vizibile.
        hideOriginal: true,
        // Textul pe butonul de cumpărare
        buyText: 'Cumpără',
        outOfStockText: 'Stoc epuizat',
        // Filtre după preț (în Lei)
        priceRanges: [
            { key: '0-4000',        label: 'până la 4.000' },
            { key: '4000-7000',     label: '4.000–7.000' },
            { key: '7000-12000',    label: '7.000–12.000' },
            { key: '12000-99999999', label: '12.000+' }
        ],
        // Prag: dacă reducerea >= această valoare, cardul primește "is-hero" (cea mai mare reducere din familie)
        heroMarksTopDiscount: true
        heroMarksTopDiscount: true,

        // Câte modele (produsul are, pe lângă procesor/memorie, mult mai multe
        // atribute deja disponibile pe pagina de listare — stocare, placă
        // video, afișaj, baterie, garanție etc. — în același jsonConfig al
        // swatch-renderer-ului). Lista de mai jos spune EXACT ce câmpuri să
        // afișăm ca specificații pe card, cu ce etichetă în română, și în ce
        // ordine. Fiecare intrare poate avea mai multe coduri de câmp
        // alternative (primul care are valoare completată câștigă) — util
        // pentru perechi ca "display" / "Display_filter", unde doar unul e
        // populat, în funcție de produs.
        // Ca să adaugi/elimini/reordonezi o specificație afișată, modifici
        // DOAR această listă — nu trebuie umblat prin parseProduct().
        specFields: [
            { label: 'Sistem de operare', fields: ['operating_system'] },
            { label: 'Culoare',           fields: ['color'] },
            { label: 'Procesor',          fields: ['processor', 'processor_filter'] },
            { label: 'Placă video',       fields: ['gpu'] },
            { label: 'Memorie video',     fields: ['vrAM'] },
            { label: 'Memorie',           fields: ['memory'] },
            { label: 'Stocare',           fields: ['storage', 'storage_filter'] },
            { label: 'Afișaj',            fields: ['display', 'Display_filter', 'panel_filter'] },
            { label: 'Rată de refresh',   fields: ['display_rate_filter_new'] },
            { label: 'Luminozitate',      fields: ['brightness'] },
            { label: 'Ecran tactil',      fields: ['touchscreen'] },
            { label: 'Baterie',           fields: ['battery'] },
            { label: 'Wi-Fi',             fields: ['wifi'] },
            { label: 'Bluetooth',         fields: ['bluetooth'] },
            { label: 'LAN',               fields: ['lan'] },
            { label: 'Porturi USB',       fields: ['usb_ports'] },
            { label: 'HDMI',              fields: ['hdmi'] },
            { label: 'Cameră web',        fields: ['web_camera'] },
            { label: 'Unitate optică',    fields: ['optical_drive'] },
            { label: 'Garanție',          fields: ['warranty'] }
        ],

        // Rezervă: dacă niciun câmp din specFields nu are valoare pentru un
        // produs (jsonConfig incomplet), cardul revine automat la lista din
        // short_description (fallback existent, extractSpecs()).

        // Completare opțională, în fundal: pe lângă specFields (deja suficient
        // de complet pentru majoritatea produselor), poți încerca și un fetch
        // direct al paginii de produs (SKU), pentru cazul rar în care fișa
        // tehnică de-acolo are date suplimentare care nu apar deloc în
        // jsonConfig-ul paginii de listare. Dezactivat implicit, ca să nu
        // facem cereri de rețea inutile — activează-l doar dacă chiar ai
        // nevoie de date suplimentare de pe pagina produsului.
        // Selectoarele folosite sunt în parseSpecsFromDoc() mai jos; dacă nu
        // prind nimic pe pagina reală de produs, ajustează-le acolo după ce
        // inspectezi codul HTML al unei pagini SKU.
        specsFromPdp: false,
        // Câte linii de specificații păstrăm după completare
        specsFromPdpLimit: 12
    };

    /* ---------------------------------------------------------------------- */
    /*  CONFIGURARE DESIGN — stil "Apple" (aici modifici aspectul galeriei)   */
    /* -----------------------------------------------------------------------
     *  Fiecare cheie devine o variabilă CSS (ex: '--ssfx-accent' -> folosită
     *  în CSS ca var(--ssfx-accent)). Ca să schimbi o culoare, un colț
     *  rotunjit sau un spațiu, modifici DOAR o valoare aici — nu trebuie
     *  să cauți prin tot CSS-ul din injectCSS().
     * ---------------------------------------------------------------------- */
    var THEME = {
        /* Tipografie — stivă de fonturi "system" folosită de Apple */
        '--ssfx-font': '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif',

        /* Culori de bază */
        '--ssfx-page-bg':    '#fbfbfd', // fundalul din spatele întregii galerii
        '--ssfx-card-bg':    '#ffffff', // fundalul cardurilor de produs
        '--ssfx-text':       '#1d1d1f', // text principal (titluri, prețuri)
        '--ssfx-text-muted': '#6e6e73', // text secundar (specificații, etichete)
        '--ssfx-border':     '#d2d2d7', // contur foarte subțire (hairline)

        /* Culoare accent — linkuri, buton principal, filtre/tab-uri active */
        '--ssfx-accent':       '#0071e3',
        '--ssfx-accent-hover': '#0077ed',

        /* Culoare pentru linia "Economisești ..." */
        '--ssfx-success': '#1d7a46',

        /* Fundal pentru badge-uri / chip-uri neutre (gri foarte deschis) */
        '--ssfx-badge-bg': '#f5f5f7',

        /* Culoare punct indicator pe cip-ul CPU (doar punctul, nu tot fundalul) */
        '--ssfx-cpu-intel':      '#0068b5',
        '--ssfx-cpu-amd':        '#ed1c24',
        '--ssfx-cpu-snapdragon': '#7c1dd8',

        /* Colțuri rotunjite */
        '--ssfx-radius-card':   '22px',
        '--ssfx-radius-button': '980px', // pill perfect, ca butoanele Apple
        '--ssfx-radius-chip':   '980px',

        /* Spațiere */
        '--ssfx-pad-card': '32px',
        '--ssfx-gap-grid': '28px',

        /* Tranziție folosită la hover / animații */
        '--ssfx-transition': 'all .3s cubic-bezier(.28,.11,.32,1)'
    };

    /* ---------------------------------------------------------------------- */
        var s = Number(n).toFixed(2);          // "1200.00"
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts[0] + ',' + parts[1] + '\u00A0' + CFG.currency;
        return parts[0] + ',' + parts[1] + ' ' + CFG.currency;
    }

    function detectBrand(str) {
        if (!str) return null;
        if (/snapdragon|qualcomm/i.test(str)) return 'snapdragon';
        if (/intel|core\u2122|\bcore\b|ultra|celeron|pentium/i.test(str)) return 'intel';
        if (/intel|core™|\bcore\b|ultra|celeron|pentium/i.test(str)) return 'intel';
        if (/ryzen|\bamd\b|radeon/i.test(str)) return 'amd';
        return null;
    }

    function brandLabel(b) {
        return b === 'intel' ? 'Intel' : b === 'amd' ? 'AMD' : b === 'snapdragon' ? 'Snapdragon' : '';
    }

    // Curăță numele procesorului pentru cip-ul CPU (scurtează redundanța)
    function cleanCpu(str) {
        if (!str) return '';
        return str
            .replace(/\s*Processor\s*/i, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/ /g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    }

    // Extrage lista de specificații din HTML-ul short_description
    // (rezervă, folosită doar dacă buildStructuredSpecs() nu găsește nimic)
    function extractSpecs(html) {
        if (!html) return [];
        var tmp = el('div', null, html);
        return out;
    }

    // Construiește lista de specificații din câmpurile individuale ale
    // variantei curente (cfg.dynamic), conform CFG.specFields — sursa
    // principală de specificații pentru card (vezi comentariul de la
    // CFG.specFields pentru cum se modifică ce se afișează).
    function buildStructuredSpecs(cfg, vid) {
        if (!cfg) return [];
        var out = [];
        CFG.specFields.forEach(function (entry) {
            for (var i = 0; i < entry.fields.length; i++) {
                var val = dynVal(cfg, entry.fields[i], vid);
                if (val) { out.push(entry.label + ': ' + val); return; }
            }
        });
        return out;
    }

    /* ---------------------------------------------------------------------- */
    /*  SPECIFICAȚII SUPLIMENTARE DE PE PAGINA PRODUSULUI (SKU) — opțional     */
    /*  buildStructuredSpecs() de mai sus e sursa principală și acoperă        */
    /*  majoritatea cazurilor din datele deja disponibile pe pagina de         */
    /*  listare. Blocul următor e o completare opțională (CFG.specsFromPdp),   */
    /*  dezactivată implicit: încearcă să citim fișa tehnică direct din HTML-ul */
    /*  paginii de produs, prin fetch în fundal. Magento generează de obicei   */
    /*  un tabel standard de "Specificații tehnice" / "Additional Information" */
    /*  — încercăm mai multe tipare cunoscute, în ordine, și renunțăm tăcut    */
    /*  dacă nu recunoaștem structura paginii (cardul rămâne cu ce avea).      */
    /* ---------------------------------------------------------------------- */
    function parseSpecsFromDoc(doc) {
        var out = [];

        // 1) Tabelul standard Magento de specificații ("Additional Information")
        var table = doc.querySelector(
            '#product-attribute-specs-table, ' +
            'table.additional-attributes, ' +
            'table.data.table.additional-attributes, ' +
            '.product.attribute.specs table'
        );
        if (table) {
            table.querySelectorAll('tr').forEach(function (tr) {
                var th = tr.querySelector('th, .col.label, .label');
                var td = tr.querySelector('td, .col.data, .data');
                var label = th ? th.textContent.replace(/\s+/g, ' ').trim() : '';
                var val = td ? td.textContent.replace(/\s+/g, ' ').trim() : '';
                if (label && val) out.push(label + ': ' + val);
            });
        }

        // 2) Listă de tip definiție (dt/dd), folosită uneori pentru fișa tehnică
        if (!out.length) {
            var dl = doc.querySelector('.product-specs dl, .specifications dl, .product-attributes dl, .tech-specs dl');
            if (dl) {
                dl.querySelectorAll('dt').forEach(function (dt) {
                    var dd = dt.nextElementSibling;
                    if (dd && /^dd$/i.test(dd.tagName)) {
                        var label = dt.textContent.replace(/\s+/g, ' ').trim();
                        var val = dd.textContent.replace(/\s+/g, ' ').trim();
                        if (label && val) out.push(label + ': ' + val);
                    }
                });
            }
        }

        // 3) Fallback: listă simplă <li> din descrierea / fișa produsului
        if (!out.length) {
            doc.querySelectorAll(
                '.product.attribute.description li, ' +
                '.product-info-main .description li, ' +
                '.pdp-description li, ' +
                '.product-specs li, ' +
                '.tech-specs li'
            ).forEach(function (li) {
                var t = li.textContent.replace(/\s+/g, ' ').trim();
                if (t) out.push(t);
            });
        }

        return out;
    }

    // Completează un card cu specificațiile de pe pagina produsului (SKU),
    // printr-un fetch asincron pe același domeniu. Rulează în fundal, după ce
    // cardul e deja afișat cu specificațiile scurte — dacă fetch-ul eșuează
    // sau nu găsește nimic recunoscut, nu schimbă nimic (fallback sigur).
    function upgradeCardSpecs(card, url) {
        if (!url || url === '#' || typeof fetch !== 'function' || typeof DOMParser === 'undefined') return;

        fetch(url, { credentials: 'same-origin' })
            .then(function (res) { return res && res.ok ? res.text() : null; })
            .then(function (html) {
                if (!html) return;
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var specs = parseSpecsFromDoc(doc);
                if (!specs.length) return;

                var wrap = card.querySelector('.product-specs');
                var list = card.querySelector('.specs-list');

                if (!wrap) {
                    wrap = el('div', 'product-specs');
                    list = el('ul', 'specs-list');
                    wrap.appendChild(list);
                    var actions = card.querySelector('.actions-row');
                    if (actions) card.insertBefore(wrap, actions); else card.appendChild(wrap);
                }

                list.innerHTML = '';
                specs.slice(0, CFG.specsFromPdpLimit).forEach(function (s) {
                    list.appendChild(el('li', null, s));
                });
                if (specs.length > 4 && !wrap.querySelector('.show-more-btn')) {
                    wrap.appendChild(el('div', 'show-more-btn', 'Arată mai mult ▾'));
                }
            })
            .catch(function () { /* păstrăm liniștit specificațiile deja afișate */ });
    }

    /* ---------------------------------------------------------------------- */
    /*  EXTRAGEREA DATELOR DINTR-UN SINGUR PRODUS (li.product-item)            */
    /* ---------------------------------------------------------------------- */
        // Stock
        var outOfStock = !!li.querySelector('.stock.unavailable');

        // Specificații
        var specs = extractSpecs(shortDesc);
        // Specificații — întâi câmpurile structurate (cfg.dynamic), apoi
        // fallback pe lista scurtă din short_description dacă nu găsim nimic
        var specs = buildStructuredSpecs(cfg, vid);
        if (!specs.length) specs = extractSpecs(shortDesc);

        return {
            name: name || titleAttr,
    /* ---------------------------------------------------------------------- */
    function collectFamilies(root) {
        var families = [];
        var seenTab = false;

        var tabItems = root.querySelectorAll('[data-content-type="tab-item"]');
        if (tabItems.length) {
            seenTab = true;
            tabItems.forEach(function (tab) {
                var id = tab.getAttribute('id');
                var name = '';
            var lis2 = root.querySelectorAll('li.product-item');
            var cards2 = [];
            lis2.forEach(function (li) {
                var p = parseProduct(li, 'Modele');
                var p = parseProduct(li, 'Toate modelele');
                if (p) cards2.push(p);
            });
            if (cards2.length) families.push({ name: 'Toate modelele', cards: cards2 });
        card.setAttribute('data-ram', p.ram || '');
        card.setAttribute('data-discount', p.pct || 0);

        // Model (etichetă sus de tot pe card, deasupra badge-ului)
        if (p.model) {
            card.appendChild(el('div', 'model-tag', p.model));
        }

        // Ribbon (doar hero)
        if (isHero && p.hasDiscount) {
            card.appendChild(el('span', 'bestseller-ribbon', '\u2605 CEA MAI MARE REDUCERE'));
            card.appendChild(el('span', 'bestseller-ribbon', 'Cea mai mare reducere'));
        }

        // Savings badge (procent automat)
        if (p.hasDiscount) {
            card.appendChild(el('div', 'savings-badge', '\u2212' + p.pct + '%'));
            card.appendChild(el('div', 'savings-badge', '−' + p.pct + '%'));
        }
