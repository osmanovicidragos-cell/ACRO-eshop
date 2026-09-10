/* =============================================================================
 * SSF-Gallery-Enhancer.js  (versiune RO)
 * -----------------------------------------------------------------------------
 * "Enhancer" extern pentru pagina ASUS Sales Festival (Magento CMS).
 *
 * SCOP:
 *   Galeria de modele de pe pagina românească (ro.store.asus.com/asus-sales-festival)
 *   trebuie să arate ca AKCIJA-LANDING-SUMMERSALE-2026-JULSKA.html — cu badge-uri,
 *   cip-uri CPU, marcaj de reducere "-XX%", marcaj Copilot+ și filtre după procesor.
 *
 * REGULĂ CHEIE:
 *   NU SE MODIFICĂ NIMIC în codul HTML original. Totul se face din exterior:
 *   - CSS-ul este injectat din JS (injectCSS)
 *   - Noua galerie este CONSTRUITĂ din datele care există deja în DOM (prețuri, modele,
 *     jsonConfig cu procesor/memorie/specificații)
 *   - Procentul de reducere se calculează AUTOMAT (finalPrice vs new-oldPrice)
 *   - Badge-urile (Copilot+, brand CPU, reducere) se adaugă AUTOMAT
 *   - Conținutul original (text banner, link-uri footer, legal) doar se ASCUNDE
 *     prin display:none (nu se șterge, doar nu se afișează)
 *
 * CUM SE ATAȘEAZĂ (fără modificarea codului paginii):
 *   Include acest fișier ca <script> suplimentar prin blocul CMS "Miscellaneous HTML",
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
    'use strict';

    /* ---------------------------------------------------------------------- */
    /*  CSP NONCE                                                              */
    /*  Pagina RO are un Content-Security-Policy strict cu nonce pe toate      */
    /*  tag-urile <script>/<style> (Magento nonceInjector). Pentru ca pe       */
    /*  serverul 'live' <style>-ul nostru injectat să treacă de CSP, trebuie   */
    /*  să îi adăugăm același nonce. Magento expune nonce-ul curent prin       */
    /*  variabila globală dataNonce.                                           */
    /* ---------------------------------------------------------------------- */
    var PAGE_NONCE = (function () {
        try { if (document.currentScript && document.currentScript.nonce) return document.currentScript.nonce; } catch (e) {}
        try { if (window.dataNonce) return window.dataNonce; } catch (e) {}
        var s = document.getElementsByTagName('script');
        for (var i = 0; i < s.length; i++) { if (s[i].nonce) return s[i].nonce; }
        return '';
    })();

    /* ---------------------------------------------------------------------- */
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
        heroMarksTopDiscount: true,

        // Meniul de familii rămâne lipit sub marginea de sus a ferestrei la
        // scroll, ca meniul de pe apple.com. Pune pe false dacă se suprapune
        // cu header-ul propriu al paginii.
        stickyFamNav: true,

        // Iconiță opțională lângă numele fiecărei familii, în meniul de sus.
        // Cheia trebuie să fie EXACT numele familiei/tab-ului (cum apare pe
        // pagină, ex. "Vivobook", "ROG"), iar valoarea, URL-ul unei imagini
        // mici (pătrată, ideal 40x40px+). Familiile care nu au o intrare aici
        // rămân fără iconiță — nimic nu se strică dacă lista e goală. Exemplu:
        // familyIcons: {
        //     'Vivobook': 'https://ro.store.asus.com/media/.../vivobook-icon.png',
        //     'ROG':      'https://ro.store.asus.com/media/.../rog-icon.png'
        // }
        familyIcons: {},

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

        // IMPORTANT: nu toate produsele au jsonConfig pe pagina de listare —
        // doar produsele CONFIGURABILE (cu variante de culoare/memorie/etc.)
        // au blocul swatch-renderer cu toate datele de mai sus. Produsele
        // SIMPLE (fără variante) nu au NICIUN fel de date tehnice pe pagina
        // de listare — nici procesor, nici model, nici specificații. Pentru
        // acelea, singura sursă posibilă e chiar pagina produsului (SKU),
        // printr-un fetch în fundal. De-aia acest flag e activat implicit.
        // Selectoarele folosite sunt în parseSpecsFromDoc() mai jos; dacă nu
        // prind nimic pe pagina reală de produs, ajustează-le acolo după ce
        // inspectezi codul HTML al unei pagini SKU (vezi comentariul de la
        // parseSpecsFromDoc).
        specsFromPdp: true,
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

        /* Meniul de sus (stil Apple, dar cu fundal alb și text negru) */
        '--ssfx-nav-bg':          'rgba(255,255,255,.92)', // fundal bară meniu
        '--ssfx-nav-text':        'rgba(29,29,31,.64)', // text meniu, stare normală
        '--ssfx-nav-text-active': '#1d1d1f', // text meniu, activ / hover

        /* Colțuri rotunjite */
        '--ssfx-radius-card':   '22px',
        '--ssfx-radius-button': '980px', // pill perfect, ca butoanele Apple
        '--ssfx-radius-chip':   '980px',
        '--ssfx-radius-image':  '14px',
        '--ssfx-radius-nav':    '14px',

        /* Spațiere */
        '--ssfx-pad-card': '32px',
        '--ssfx-gap-grid': '28px',

        /* Tranziții folosite la hover / animații */
        '--ssfx-transition':       'all .3s cubic-bezier(.28,.11,.32,1)',
        '--ssfx-transition-slow':  'all .6s cubic-bezier(.28,.11,.32,1)'
    };

    /* ---------------------------------------------------------------------- */
    /*  FUNCȚII AJUTĂTOARE                                                     */
    /* ---------------------------------------------------------------------- */

    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    // "5.849,00 Lei" rămâne așa cum este; aici formatăm numărul -> "1.200,00 Lei"
    function fmtMoney(n) {
        var s = Number(n).toFixed(2);          // "1200.00"
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts[0] + ',' + parts[1] + ' ' + CFG.currency;
    }

    function detectBrand(str) {
        if (!str) return null;
        if (/snapdragon|qualcomm/i.test(str)) return 'snapdragon';
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
            .replace(/ /g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* ---------------------------------------------------------------------- */
    /*  PARSARE jsonConfig Magento (procesor, memorie, model, specificații...) */
    /* ---------------------------------------------------------------------- */
    function readSwatchConfig(li) {
        var scripts = li.querySelectorAll('script[type="text/x-magento-init"]');
        for (var i = 0; i < scripts.length; i++) {
            var txt = scripts[i].textContent;
            if (!txt || txt.indexOf('swatch-renderer') === -1) continue;
            var obj;
            try { obj = JSON.parse(txt); } catch (e) { continue; }
            for (var key in obj) {
                if (key.indexOf('swatch-option') !== -1 &&
                    obj[key] && obj[key]['Magento_Swatches/js/swatch-renderer']) {
                    return obj[key]['Magento_Swatches/js/swatch-renderer'].jsonConfig || null;
                }
            }
        }
        return null;
    }

    // Găsește varianta preselectată (implicită) din jsonConfig
    function pickVariant(cfg) {
        if (!cfg || !cfg.index) return null;
        var attrs = cfg.attributes || {};
        var codeToId = {};
        for (var id in attrs) { codeToId[attrs[id].code] = id; }
        var pre = cfg.preselect || {};
        for (var vid in cfg.index) {
            var sel = cfg.index[vid], match = true;
            for (var code in pre) {
                var aid = codeToId[code];
                if (aid && sel[aid] !== pre[code]) { match = false; break; }
            }
            if (match) return vid;
        }
        // fallback: prima variantă
        for (var k in cfg.index) return k;
        return null;
    }

    function dynVal(cfg, field, vid) {
        try {
            if (cfg && cfg.dynamic && cfg.dynamic[field] && cfg.dynamic[field][vid]) {
                return cfg.dynamic[field][vid].value || '';
            }
        } catch (e) {}
        return '';
    }

    // Extrage lista de specificații din HTML-ul short_description
    // (rezervă, folosită doar dacă buildStructuredSpecs() nu găsește nimic)
    function extractSpecs(html) {
        if (!html) return [];
        var tmp = el('div', null, html);
        var lis = tmp.querySelectorAll('li');
        var out = [];
        for (var i = 0; i < lis.length; i++) {
            var t = lis[i].textContent.replace(/\s+/g, ' ').trim();
            if (t) out.push(t);
        }
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
    function parseProduct(li, family) {
        var link = li.querySelector('a.product-item-link') ||
                   li.querySelector('a.product-item-photo');
        if (!link) return null;

        var img = li.querySelector('img.product-image-photo');
        var name = (li.querySelector('a.product-item-link') &&
                    li.querySelector('a.product-item-link').textContent.trim()) || '';
        var titleAttr = (link.getAttribute('title') || '').trim();
        var url = link.getAttribute('href') || '#';

        // --- Prețuri ---
        var box = li.querySelector('.price-box');
        var finalEl = box && box.querySelector('[data-price-type="finalPrice"]');
        var oldEl = box && box.querySelector('[data-price-type="new-oldPrice"]');

        var finalAmt = finalEl ? parseFloat(finalEl.getAttribute('data-price-amount')) : null;
        var oldAmt = oldEl ? parseFloat(oldEl.getAttribute('data-price-amount')) : null;

        var finalText = finalEl && finalEl.querySelector('.price')
            ? finalEl.querySelector('.price').textContent.trim()
            : (box && box.querySelector('.price') ? box.querySelector('.price').textContent.trim() : '');
        var oldText = oldEl && oldEl.querySelector('.price')
            ? oldEl.querySelector('.price').textContent.trim() : '';

        // Calcul AUTOMAT al reducerii
        var hasDiscount = false, pct = 0, saveAmt = 0;
        if (finalAmt != null && oldAmt != null && oldAmt > finalAmt) {
            hasDiscount = true;
            saveAmt = oldAmt - finalAmt;
            pct = Math.round((saveAmt / oldAmt) * 100);
        }

        // --- jsonConfig (procesor, memorie, model, specificații) ---
        var cfg = readSwatchConfig(li);
        var vid = pickVariant(cfg);
        var procVal = cfg ? cleanCpu(dynVal(cfg, 'processor', vid)) : '';
        var modelVal = cfg ? dynVal(cfg, 'sales_model_name', vid) : '';
        var memVal = cfg ? dynVal(cfg, 'memory', vid) : '';
        var shortDesc = cfg ? dynVal(cfg, 'short_description', vid) : '';

        // Cod model: "Nume complet model - S5606CA-RI146X" -> "S5606CA-RI146X"
        var model = '';
        if (modelVal) {
            var m = modelVal.split(' - ');
            model = (m.length > 1 ? m[m.length - 1] : modelVal).trim();
        }
        if (!model) {
            var rx = (name + ' ' + titleAttr).match(/\b\d{2}[A-Z]{2}[A-Z0-9]*-[A-Z0-9]+\b/);
            if (rx) model = rx[0];
        }

        // Brand CPU + etichetă
        var cpuSource = procVal || name || titleAttr;
        var brand = detectBrand(cpuSource);
        var cpuLabel = procVal || '';
        if (!cpuLabel) {
            var cm = (name + ' ' + titleAttr).match(/(Intel[^,\-–|]*|AMD Ryzen[^,\-–|]*|Ryzen[^,\-–|]*|Snapdragon[^,\-–|]*)/i);
            if (cm) cpuLabel = cleanCpu(cm[0]);
        }

        // Copilot+
        var copilot = /copilot\s*\+?/i.test(name + ' ' + titleAttr + ' ' + shortDesc);

        // RAM
        var ram = 0;
        var rm = (memVal || shortDesc || name).match(/(\d+)\s*GB/i);
        if (rm) ram = parseInt(rm[1], 10);

        // Stock
        var outOfStock = !!li.querySelector('.stock.unavailable');

        // Specificații — întâi câmpurile structurate (cfg.dynamic), apoi
        // fallback pe lista scurtă din short_description dacă nu găsim nimic
        var specs = buildStructuredSpecs(cfg, vid);
        if (!specs.length) specs = extractSpecs(shortDesc);

        return {
            name: name || titleAttr,
            url: url,
            imgSrc: img ? img.getAttribute('src') : '',
            imgAlt: img ? (img.getAttribute('alt') || name) : name,
            family: family,
            finalText: finalText,
            oldText: oldText,
            finalAmt: finalAmt,
            hasDiscount: hasDiscount,
            pct: pct,
            saveAmt: saveAmt,
            model: model,
            brand: brand,
            cpuLabel: cpuLabel,
            copilot: copilot,
            ram: ram,
            outOfStock: outOfStock,
            specs: specs
        };
    }

    /* ---------------------------------------------------------------------- */
    /*  COLECTAREA TUTUROR PRODUSELOR PE TAB-URI (familii)                     */
    /* ---------------------------------------------------------------------- */
    function collectFamilies(root) {
        var families = [];

        var tabItems = root.querySelectorAll('[data-content-type="tab-item"]');
        if (tabItems.length) {
            tabItems.forEach(function (tab) {
                var id = tab.getAttribute('id');
                var name = '';
                if (id) {
                    var header = root.querySelector('a[href="#' + id + '"] .tab-title, a[href="#' + id + '"]');
                    if (header) name = header.textContent.replace(/\s+/g, ' ').trim();
                }
                if (!name) name = 'Modele';
                var lis = tab.querySelectorAll('li.product-item');
                var cards = [];
                lis.forEach(function (li) {
                    var p = parseProduct(li, name);
                    if (p) cards.push(p);
                });
                if (cards.length) families.push({ name: name, cards: cards });
            });
        }

        // Fallback: nu există tab-uri -> o singură familie cu toate produsele
        if (!families.length) {
            var lis2 = root.querySelectorAll('li.product-item');
            var cards2 = [];
            lis2.forEach(function (li) {
                var p = parseProduct(li, 'Toate modelele');
                if (p) cards2.push(p);
            });
            if (cards2.length) families.push({ name: 'Toate modelele', cards: cards2 });
        }

        return families;
    }

    /* ---------------------------------------------------------------------- */
    /*  CONSTRUIREA UNUI CARD                                                  */
    /* ---------------------------------------------------------------------- */
    function buildCard(p, isHero) {
        var card = el('div', 'product-card' + (isHero ? ' is-hero' : ''));
        card.setAttribute('data-family', p.family);
        card.setAttribute('data-category', p.brand || '');
        card.setAttribute('data-price', p.finalAmt != null ? Math.round(p.finalAmt) : '');
        card.setAttribute('data-ram', p.ram || '');
        card.setAttribute('data-discount', p.pct || 0);

        // Model (etichetă sus de tot pe card, deasupra badge-ului)
        if (p.model) {
            card.appendChild(el('div', 'model-tag', p.model));
        }

        // Ribbon (doar hero)
        if (isHero && p.hasDiscount) {
            card.appendChild(el('span', 'bestseller-ribbon', 'Cea mai mare reducere'));
        }

        // Savings badge (procent automat)
        if (p.hasDiscount) {
            card.appendChild(el('div', 'savings-badge', '−' + p.pct + '%'));
        }

        // Badge Copilot / familie
        if (p.copilot) {
            card.appendChild(el('span', 'badge badge-copilot', 'Copilot+ PC'));
        } else {
            card.appendChild(el('span', 'badge badge-red', 'ASUS Sales Festival'));
        }

        // Imagine
        var aImg = el('a', 'product-image');
        aImg.href = p.url; aImg.target = '_blank'; aImg.rel = 'noopener';
        var img = el('img');
        img.src = p.imgSrc; img.alt = p.imgAlt; img.loading = 'lazy';
        aImg.appendChild(img);
        card.appendChild(aImg);

        // Titlu
        var aTitle = el('a', 'product-title', p.name);
        aTitle.href = p.url; aTitle.target = '_blank'; aTitle.rel = 'noopener';
        card.appendChild(aTitle);

        // Copilot+ (modelul e deja afișat sus de tot pe card, ca model-tag)
        if (p.copilot) {
            card.appendChild(el('div', 'product-model', 'Copilot+ PC'));
        }

        // Cip CPU
        if (p.cpuLabel && p.brand) {
            card.appendChild(el('span', 'cpu-chip cpu-' + p.brand, p.cpuLabel));
        }

        card.appendChild(el('hr', 'divider'));

        // Prețuri
        if (p.hasDiscount) {
            card.appendChild(el('div', 'price-label', 'Preț normal:'));
            card.appendChild(el('div', 'price-old', p.oldText));
            var mega = el('div', 'mega-price-box');
            mega.appendChild(el('span', 'mega-price-label', 'Preț promoțional'));
            mega.appendChild(el('span', 'mega-price-amount', p.finalText));
            card.appendChild(mega);
            card.appendChild(el('div', 'save-line', '✓ Economisești ' + fmtMoney(p.saveAmt)));
        } else {
            var mega2 = el('div', 'mega-price-box');
            mega2.appendChild(el('span', 'mega-price-label', 'Preț'));
            mega2.appendChild(el('span', 'mega-price-amount', p.finalText));
            card.appendChild(mega2);
        }

        // Specificații
        if (p.specs && p.specs.length) {
            var wrap = el('div', 'product-specs');
            var ul = el('ul', 'specs-list');
            p.specs.slice(0, 8).forEach(function (s) {
                ul.appendChild(el('li', null, s));
            });
            wrap.appendChild(ul);
            if (p.specs.length > 4) {
                wrap.appendChild(el('div', 'show-more-btn', 'Arată mai mult ▾'));
            }
            card.appendChild(wrap);
        }

        // Acțiune
        var actions = el('div', 'actions-row');
        if (p.outOfStock) {
            actions.appendChild(el('div', 'stock-out', CFG.outOfStockText));
        } else {
            var btn = el('a', 'btn btn-primary', CFG.buyText);
            btn.href = p.url; btn.target = '_blank'; btn.rel = 'noopener';
            actions.appendChild(btn);
            if (p.hasDiscount) {
                actions.appendChild(el('div', 'urgency-text', 'Stoc promoțional limitat!'));
            }
        }
        card.appendChild(actions);

        // Completează specificațiile scurte cu fișa tehnică de pe pagina produsului
        if (CFG.specsFromPdp) {
            upgradeCardSpecs(card, p.url);
        }

        return card;
    }

    /* ---------------------------------------------------------------------- */
    /*  CONSTRUIREA ÎNTREGII GALERII (tab-uri + filtre + grid)                 */
    /* ---------------------------------------------------------------------- */
    function buildGallery(families) {
        var root = el('div', 'ssfx');

        // --- Tab-uri familii ---
        var famTabs = el('div', 'fam-tabs');
        families.forEach(function (fam, i) {
            // Iconiță opțională lângă numele familiei — vezi CFG.familyIcons
            var iconUrl = CFG.familyIcons[fam.name];
            var iconHtml = iconUrl ? '<img class="fam-icon" src="' + iconUrl + '" alt="">' : '';
            var b = el('button', 'fam-btn' + (i === 0 ? ' active' : ''),
                iconHtml + fam.name + ' <span class="fam-count">' + fam.cards.length + '</span>');
            b.setAttribute('data-family', fam.name);
            famTabs.appendChild(b);
        });
        root.appendChild(famTabs);

        // --- Bara de filtre (procesor / RAM / preț) ---
        var filt = el('div', 'filt');

        var gCpu = el('div', 'filt-group');
        gCpu.appendChild(el('span', 'filt-label', 'Procesor'));
        ['intel', 'amd', 'snapdragon'].forEach(function (c) {
            var chip = el('button', 'chip', brandLabel(c));
            chip.setAttribute('data-cpu', c);
            gCpu.appendChild(chip);
        });
        filt.appendChild(gCpu);

        var gRam = el('div', 'filt-group');
        gRam.appendChild(el('span', 'filt-label', 'RAM'));
        [['8', '8 GB'], ['16', '16 GB'], ['32', '32 GB+']].forEach(function (r) {
            var chip = el('button', 'chip', r[1]);
            chip.setAttribute('data-ram', r[0]);
            gRam.appendChild(chip);
        });
        filt.appendChild(gRam);

        var gPrice = el('div', 'filt-group');
        gPrice.appendChild(el('span', 'filt-label', 'Preț'));
        CFG.priceRanges.forEach(function (pr) {
            var chip = el('button', 'chip', pr.label);
            chip.setAttribute('data-price', pr.key);
            gPrice.appendChild(chip);
        });
        filt.appendChild(gPrice);

        var reset = el('button', 'filt-reset', 'Resetează filtrele ✕');
        filt.appendChild(reset);
        root.appendChild(filt);

        // --- Grid ---
        var grid = el('div', 'product-grid');
        families.forEach(function (fam) {
            // hero = cardul cu cea mai mare reducere din familie
            var heroIdx = -1, heroPct = 0;
            if (CFG.heroMarksTopDiscount) {
                fam.cards.forEach(function (c, idx) {
                    if (c.hasDiscount && c.pct > heroPct) { heroPct = c.pct; heroIdx = idx; }
                });
            }
            fam.cards.forEach(function (c, idx) {
                grid.appendChild(buildCard(c, idx === heroIdx));
            });
        });
        var noRes = el('div', 'no-results', 'Nu există modele care să corespundă filtrelor selectate.');
        noRes.style.display = 'none';
        grid.appendChild(noRes);
        root.appendChild(grid);

        // --- Logica filtre/tab-uri ---
        var state = { family: families[0] ? families[0].name : null, cpu: null, ram: null, price: null };

        function apply() {
            var cards = grid.querySelectorAll('.product-card');
            var visible = 0;
            cards.forEach(function (card) {
                var ok = true;
                if (state.family && card.getAttribute('data-family') !== state.family) ok = false;
                if (ok && state.cpu && card.getAttribute('data-category') !== state.cpu) ok = false;
                if (ok && state.ram) {
                    var r = parseInt(card.getAttribute('data-ram'), 10) || 0;
                    if (state.ram === '32') { if (r < 32) ok = false; }
                    else if (r !== parseInt(state.ram, 10)) ok = false;
                }
                if (ok && state.price) {
                    var pp = parseInt(card.getAttribute('data-price'), 10) || 0;
                    var parts = state.price.split('-');
                    if (pp < parseInt(parts[0], 10) || pp > parseInt(parts[1], 10)) ok = false;
                }
                card.style.display = ok ? 'flex' : 'none';
                if (ok) visible++;
            });
            noRes.style.display = visible === 0 ? 'block' : 'none';
        }

        famTabs.querySelectorAll('.fam-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                famTabs.querySelectorAll('.fam-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                state.family = b.getAttribute('data-family');
                apply();
                root.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        function setupChips(attr, key) {
            filt.querySelectorAll('.chip[data-' + attr + ']').forEach(function (chip) {
                chip.addEventListener('click', function () {
                    var was = chip.classList.contains('active');
                    filt.querySelectorAll('.chip[data-' + attr + ']').forEach(function (c) { c.classList.remove('active'); });
                    if (was) { state[key] = null; }
                    else { chip.classList.add('active'); state[key] = chip.getAttribute('data-' + attr); }
                    apply();
                });
            });
        }
        setupChips('cpu', 'cpu');
        setupChips('ram', 'ram');
        setupChips('price', 'price');

        reset.addEventListener('click', function () {
            state.cpu = state.ram = state.price = null;
            filt.querySelectorAll('.chip.active').forEach(function (c) { c.classList.remove('active'); });
            apply();
        });

        // Show more (specificații)
        grid.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.show-more-btn') : null;
            if (!btn) return;
            var list = btn.parentNode.querySelector('.specs-list');
            if (!list) return;
            var open = list.classList.toggle('expanded');
            btn.innerHTML = open ? 'Arată mai puțin ▴' : 'Arată mai mult ▾';
        });

        apply();
        setupRevealAnimation(grid);
        return root;
    }

    // Animație discretă de apariție: fiecare card devine vizibil (fade +
    // translatare ușoară în sus) când intră în viewport, cu un mic decalaj
    // între carduri (stagger). Dacă browserul nu suportă IntersectionObserver,
    // cardurile apar direct, fără animație — nimic nu rămâne ascuns.
    function revealCard(card) {
        card.classList.add('in-view');
        // După ce animația de apariție se termină, o "eliberăm" complet
        // (altfel animation-fill-mode:both ar rămâne să controleze
        // permanent transform-ul cardului și ar bloca efectul de hover,
        // care schimbă tot transform-ul la :hover).
        card.addEventListener('animationend', function handler(e) {
            if (e.animationName !== 'ssfxReveal') return;
            card.style.animation = 'none';
            card.style.opacity = '1';
        }, { once: true });
    }

    function setupRevealAnimation(grid) {
        var cards = grid.querySelectorAll('.product-card');
        if (!('IntersectionObserver' in window)) {
            cards.forEach(revealCard);
            return;
        }
        cards.forEach(function (c, i) {
            c.style.setProperty('--ssfx-reveal-delay', (Math.min(i, 8) * 70) + 'ms');
        });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    revealCard(entry.target);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        cards.forEach(function (c) { io.observe(c); });
    }

    /* ---------------------------------------------------------------------- */
    /*  CSS — stil "Apple": mult alb/gri deschis, contururi subțiri (hairline), */
    /*  colțuri foarte rotunjite, butoane pill, prețuri mari & clare, fără     */
    /*  culori stridente. Toate valorile variabile vin din THEME (mai sus).   */
    /* ---------------------------------------------------------------------- */
    function buildRootVars(theme) {
        var out = '';
        for (var key in theme) {
            if (theme.hasOwnProperty(key)) out += key + ':' + theme[key] + ';';
        }
        return out;
    }

    function injectCSS() {
        if (document.getElementById('ssfx-css')) return;

        // Meniul de sus rămâne lipit sub marginea de sus la scroll (ca pe
        // apple.com), dacă CFG.stickyFamNav e true. Dezactivează-l din CFG
        // dacă intră în conflict cu header-ul propriu al paginii (z-index,
        // suprapunere) — restul design-ului nu depinde de asta.
        var navPositionCss = CFG.stickyFamNav
            ? 'position:sticky; top:0; z-index:30;'
            : 'position:relative;';

        var css = '.ssfx{' + buildRootVars(THEME) + '}\n' + '\n\
/* Bază */\n\
.ssfx{\n\
    font-family:var(--ssfx-font);\n\
    -webkit-font-smoothing:antialiased;\n\
    background:var(--ssfx-page-bg);\n\
    color:var(--ssfx-text);\n\
    padding:22px 22px 64px;\n\
    max-width:100%;\n\
    box-sizing:border-box;\n\
}\n\
.ssfx *,.ssfx *::before,.ssfx *::after{ box-sizing:border-box; }\n\
\n\
/* Meniul de sus — stil Apple: bară închisă la culoare, translucidă, cu blur */\n\
.ssfx .fam-tabs{\n\
    display:flex;\n\
    flex-wrap:wrap;\n\
    justify-content:center;\n\
    gap:30px;\n\
    max-width:1200px;\n\
    margin:0 auto 40px;\n\
    padding:0 28px;\n\
    background:var(--ssfx-nav-bg);\n\
    border:1px solid var(--ssfx-border);\n\
    -webkit-backdrop-filter:blur(20px) saturate(180%);\n\
    backdrop-filter:blur(20px) saturate(180%);\n\
    border-radius:var(--ssfx-radius-nav);\n\
    ' + navPositionCss + '\n\
}\n\
.ssfx .fam-btn{\n\
    background:transparent;\n\
    border:none;\n\
    border-bottom:2px solid transparent;\n\
    color:var(--ssfx-nav-text);\n\
    padding:16px 2px;\n\
    font-size:13.5px;\n\
    font-weight:500;\n\
    letter-spacing:.02em;\n\
    cursor:pointer;\n\
    transition:var(--ssfx-transition);\n\
    display:inline-flex;\n\
    align-items:center;\n\
    gap:7px;\n\
    white-space:nowrap;\n\
}\n\
.ssfx .fam-btn:hover{ color:var(--ssfx-nav-text-active); }\n\
.ssfx .fam-btn.active{ color:var(--ssfx-nav-text-active); border-bottom-color:var(--ssfx-nav-text-active); }\n\
.ssfx .fam-count{ font-size:11.5px; background:rgba(0,0,0,.06); color:inherit; padding:1px 7px; border-radius:var(--ssfx-radius-chip); font-weight:600; }\n\
.ssfx .fam-btn.active .fam-count{ background:rgba(0,0,0,.1); }\n\
.ssfx .fam-icon{ width:20px; height:20px; border-radius:6px; object-fit:cover; display:block; }\n\
\n\
/* Bara de filtre — grupuri separate prin linii subțiri, etichete discrete */\n\
.ssfx .filt{\n\
    display:flex;\n\
    flex-wrap:wrap;\n\
    row-gap:8px;\n\
    align-items:center;\n\
    justify-content:center;\n\
    max-width:1200px;\n\
    margin:0 auto 28px;\n\
    padding:2px 20px;\n\
    background:var(--ssfx-card-bg);\n\
    border:1px solid var(--ssfx-border);\n\
    border-radius:16px;\n\
}\n\
.ssfx .filt-group{\n\
    display:flex;\n\
    align-items:center;\n\
    gap:8px;\n\
    flex-wrap:wrap;\n\
    padding:8px 16px;\n\
    border-left:1px solid var(--ssfx-border);\n\
}\n\
.ssfx .filt-group:first-child{ border-left:none; padding-left:0; }\n\
.ssfx .filt-label{ font-size:12px; font-weight:600; color:var(--ssfx-text-muted); letter-spacing:.05em; text-transform:uppercase; }\n\
.ssfx .chip{\n\
    background:var(--ssfx-badge-bg);\n\
    border:1px solid transparent;\n\
    color:var(--ssfx-text);\n\
    padding:4px 12px;\n\
    border-radius:var(--ssfx-radius-chip);\n\
    cursor:pointer;\n\
    font-size:14px;\n\
    font-weight:500;\n\
    transition:var(--ssfx-transition);\n\
    white-space:nowrap;\n\
}\n\
.ssfx .chip:hover{ background:#ececf0; }\n\
.ssfx .chip.active{ background:var(--ssfx-accent); color:#fff; }\n\
.ssfx .filt-reset{\n\
    background:var(--ssfx-badge-bg);\n\
    border:none;\n\
    color:var(--ssfx-text-muted);\n\
    font-size:13.5px;\n\
    font-weight:500;\n\
    cursor:pointer;\n\
    padding:5px 14px;\n\
    border-radius:var(--ssfx-radius-chip);\n\
    margin-left:6px;\n\
    transition:var(--ssfx-transition);\n\
}\n\
.ssfx .filt-reset:hover{ background:#ececf0; color:var(--ssfx-text); }\n\
\n\
/* Grid + card — cu o mică animație de apariție la scroll (vezi setupRevealAnimation) */\n\
.ssfx .product-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:var(--ssfx-gap-grid); max-width:1200px; margin:0 auto; }\n\
@keyframes ssfxReveal{ from{ opacity:0; transform:translateY(24px); } to{ opacity:1; transform:translateY(0); } }\n\
.ssfx .product-card{\n\
    background:var(--ssfx-card-bg);\n\
    border:1px solid var(--ssfx-border);\n\
    border-radius:var(--ssfx-radius-card);\n\
    padding:var(--ssfx-pad-card);\n\
    display:flex;\n\
    flex-direction:column;\n\
    position:relative;\n\
    transition:var(--ssfx-transition);\n\
    min-width:0;\n\
    max-width:100%;\n\
    opacity:0;\n\
}\n\
.ssfx .product-card.in-view{\n\
    animation:ssfxReveal .7s cubic-bezier(.28,.11,.32,1) both;\n\
    animation-delay:var(--ssfx-reveal-delay,0ms);\n\
}\n\
.ssfx .product-card:hover{ border-color:transparent; box-shadow:0 20px 40px rgba(0,0,0,.08); transform:translateY(-6px); }\n\
@media (prefers-reduced-motion: reduce){\n\
    .ssfx .product-card{ opacity:1; }\n\
    .ssfx .product-card.in-view{ animation:none; }\n\
}\n\
\n\
/* Model — etichetă sus de tot pe card */\n\
.ssfx .model-tag{ font-size:12.5px; font-weight:600; color:var(--ssfx-text-muted); letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px; }\n\
\n\
/* Badge-uri */\n\
.ssfx .badge{ display:inline-block; font-size:13px; font-weight:600; padding:5px 12px; border-radius:var(--ssfx-radius-chip); align-self:flex-start; margin-bottom:16px; letter-spacing:.01em; }\n\
.ssfx .badge.badge-red{ background:var(--ssfx-badge-bg); color:var(--ssfx-text-muted); }\n\
.ssfx .product-card.is-hero .badge.badge-red{ background:var(--ssfx-text); color:#fff; }\n\
.ssfx .badge.badge-copilot{ background:var(--ssfx-badge-bg); color:var(--ssfx-accent); }\n\
.ssfx .savings-badge{\n\
    position:absolute;\n\
    top:20px;\n\
    right:20px;\n\
    background:var(--ssfx-text);\n\
    color:#fff;\n\
    font-weight:600;\n\
    font-size:14px;\n\
    padding:6px 12px;\n\
    border-radius:var(--ssfx-radius-chip);\n\
    z-index:2;\n\
    line-height:1;\n\
}\n\
.ssfx .product-card.is-hero .savings-badge{ background:var(--ssfx-accent); }\n\
.ssfx .bestseller-ribbon{\n\
    font-size:13px;\n\
    color:var(--ssfx-accent);\n\
    font-weight:600;\n\
    letter-spacing:.02em;\n\
    text-transform:uppercase;\n\
    align-self:flex-start;\n\
    margin-bottom:12px;\n\
}\n\
\n\
/* Imagine / titlu / model / cpu */\n\
.ssfx .product-image{ text-align:center; margin-bottom:24px; height:220px; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:var(--ssfx-radius-image); }\n\
.ssfx .product-image img{ max-width:100%; max-height:100%; object-fit:contain; transition:transform .5s cubic-bezier(.28,.11,.32,1); }\n\
.ssfx .product-card:hover .product-image img{ transform:scale(1.06); }\n\
.ssfx .product-title{ font-size:20.5px; font-weight:600; color:var(--ssfx-text); margin:0 0 4px; text-decoration:none; line-height:1.35; letter-spacing:-.01em; display:block; }\n\
.ssfx .product-title:hover{ color:var(--ssfx-accent); }\n\
.ssfx .product-model{ font-size:14px; color:var(--ssfx-text-muted); margin-bottom:2px; }\n\
.ssfx .cpu-chip{\n\
    --dot:#86868b;\n\
    display:inline-flex;\n\
    align-items:center;\n\
    gap:6px;\n\
    font-size:13.5px;\n\
    font-weight:500;\n\
    color:var(--ssfx-text-muted);\n\
    background:var(--ssfx-badge-bg);\n\
    padding:4px 10px 4px 8px;\n\
    border-radius:var(--ssfx-radius-chip);\n\
    margin:8px 0 0;\n\
}\n\
.ssfx .cpu-chip::before{ content:\'\'; width:6px; height:6px; border-radius:50%; background:var(--dot); flex:0 0 auto; }\n\
.ssfx .cpu-chip.cpu-intel{ --dot:var(--ssfx-cpu-intel); }\n\
.ssfx .cpu-chip.cpu-amd{ --dot:var(--ssfx-cpu-amd); }\n\
.ssfx .cpu-chip.cpu-snapdragon{ --dot:var(--ssfx-cpu-snapdragon); }\n\
.ssfx .divider{ height:1px; background:var(--ssfx-border); margin:20px 0; border:none; width:100%; }\n\
\n\
/* Prețuri */\n\
.ssfx .price-label{ font-size:14px; color:var(--ssfx-text-muted); }\n\
.ssfx .price-old{ display:block; text-decoration:line-through; color:var(--ssfx-text-muted); font-size:16px; margin-top:2px; }\n\
.ssfx .mega-price-box{ display:flex; flex-direction:column; gap:2px; margin:14px 0 16px; text-align:left; }\n\
.ssfx .mega-price-label{ font-size:14px; color:var(--ssfx-text-muted); }\n\
.ssfx .mega-price-amount{ font-size:30px; font-weight:600; color:var(--ssfx-text); letter-spacing:-.02em; }\n\
.ssfx .save-line{ font-size:14px; color:var(--ssfx-success); font-weight:500; margin-top:2px; }\n\
\n\
/* Specificații */\n\
.ssfx .product-specs{ flex-grow:1; margin:4px 0 12px; }\n\
.ssfx .specs-list{ font-size:14.5px; color:var(--ssfx-text-muted); padding-left:18px; margin:0; max-height:80px; overflow:hidden; transition:max-height .4s cubic-bezier(.28,.11,.32,1); }\n\
.ssfx .specs-list.expanded{ max-height:600px; }\n\
.ssfx .specs-list li{ margin-bottom:6px; }\n\
.ssfx .show-more-btn{ color:var(--ssfx-accent); font-size:14px; font-weight:500; cursor:pointer; margin-top:4px; display:inline-block; user-select:none; }\n\
.ssfx .show-more-btn:hover{ text-decoration:underline; }\n\
\n\
/* Acțiune */\n\
.ssfx .actions-row{ display:flex; flex-direction:column; gap:8px; margin-top:16px; }\n\
.ssfx .btn{ width:100%; text-align:center; padding:13px 20px; border-radius:var(--ssfx-radius-button); font-weight:500; font-size:17px; cursor:pointer; text-decoration:none; transition:var(--ssfx-transition); display:inline-block; }\n\
.ssfx .btn-primary{ background:var(--ssfx-accent); color:#fff; border:1px solid var(--ssfx-accent); }\n\
.ssfx .btn-primary:hover{ background:var(--ssfx-accent-hover); border-color:var(--ssfx-accent-hover); }\n\
.ssfx .btn-primary:active{ transform:scale(.97); }\n\
.ssfx .stock-out{ width:100%; text-align:center; padding:13px; border-radius:var(--ssfx-radius-button); font-weight:500; font-size:16px; background:var(--ssfx-badge-bg); color:var(--ssfx-text-muted); }\n\
.ssfx .urgency-text{ font-size:13.5px; color:var(--ssfx-text-muted); font-weight:500; text-align:center; }\n\
\n\
.ssfx .no-results{ grid-column:1/-1; text-align:center; padding:60px 20px; font-size:17px; color:var(--ssfx-text-muted); }\n\
\n\
/* Responsive */\n\
@media(max-width:767px){\n\
    .ssfx{ padding:18px 16px 48px; }\n\
    .ssfx .product-grid{ grid-template-columns:1fr; }\n\
    .ssfx .fam-tabs{ justify-content:flex-start; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; gap:22px; padding:0 18px; scrollbar-width:none; }\n\
    .ssfx .fam-tabs::-webkit-scrollbar{ display:none; }\n\
    .ssfx .fam-btn{ padding:14px 2px; font-size:13px; }\n\
    .ssfx .filt{ justify-content:flex-start; padding:6px 16px; }\n\
    .ssfx .filt-group{ width:100%; border-left:none; border-top:1px solid var(--ssfx-border); padding:8px 0; }\n\
    .ssfx .filt-group:first-child{ border-top:none; }\n\
    .ssfx .filt-reset{ margin:6px 0 4px; }\n\
}\n\
';

        var style = el('style');
        style.id = 'ssfx-css';
        // CSP: adaugă nonce pentru ca stilul injectat să treacă de style-src pe serverul 'live'
        if (PAGE_NONCE) { try { style.nonce = PAGE_NONCE; } catch (e) {} style.setAttribute('nonce', PAGE_NONCE); }
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    /* ---------------------------------------------------------------------- */
    /*  ASCUNDEREA CONȚINUTULUI ORIGINAL (fără modificarea codului)            */
    /* ---------------------------------------------------------------------- */
    function hideOriginal(root) {
        if (!CFG.hideOriginal) return;
        // Ascunde DOAR rândurile care conțin produsele originale (modele vechi / tab-urile vechi).
        // Banner-ul, divider-ul, link-urile din footer și legal rămân vizibile.
        root.querySelectorAll('[data-content-type="row"]').forEach(function (r) {
            if (r.querySelector('li.product-item')) r.style.display = 'none';
        });
    }

    /* ---------------------------------------------------------------------- */
    /*  INIT                                                                   */
    /* ---------------------------------------------------------------------- */
    function init() {
        var root = document.getElementById('maincontent') ||
                   document.querySelector('.column.main') ||
                   document.body;
        if (!root) return;

        // 1) Colectează datele ÎNAINTE de ascundere
        var families = collectFamilies(root);
        if (!families.length) {
            // Nu există produse (poate pagina greșită) -> nu atinge nimic
            return;
        }

        // 2) Injectează CSS
        injectCSS();

        // 3) Construiește galeria
        var gallery = buildGallery(families);

        // 4) Inserează galeria DEASUPRA grilei originale de produse.
        //    Banner-ul (deasupra), header-ul, footer-ul și tot conținutul existent rămân vizibile.
        var anchorRow = null;
        var rows = root.querySelectorAll('[data-content-type="row"]');
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].querySelector('li.product-item')) { anchorRow = rows[i]; break; }
        }
        if (anchorRow && anchorRow.parentNode) {
            anchorRow.parentNode.insertBefore(gallery, anchorRow);
        } else {
            var mount = document.querySelector('.column.main') || root;
            mount.insertBefore(gallery, mount.firstChild);
        }

        // 5) Ascunderea originalului (no-op cât timp CFG.hideOriginal=false)
        hideOriginal(root);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
