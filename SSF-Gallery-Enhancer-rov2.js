/* =============================================================================
 * SSF-Gallery-Enhancer.js (Versiune RO)
 * -----------------------------------------------------------------------------
 * "Enhancer" extern pentru pagina ASUS Sales Festival (Magento CMS).
 *
 * SCOP:
 *   - Construiește un grid modern și interactiv de produse bazat pe datele din DOM.
 *   - Afișează toate specificațiile tehnice, prețurile reduse și badge-urile.
 *   - Adaugă filtre interactive (procesor, memorie RAM, interval de preț).
 *   - Nu afectează codul HTML sursă al Magento.
 * ========================================================================== */

(function () {
    'use strict';

    /* ---------------------------------------------------------------------- */
    /*  1. CSP NONCE DETECTOR                                                 */
    /*  Extrage nonce-ul de securitate Magento pentru a permite injectarea CSS   */
    /*  fără a fi blocat de politica strictă Content-Security-Policy.         */
    /* ---------------------------------------------------------------------- */
    var PAGE_NONCE = (function () {
        try { if (document.currentScript && document.currentScript.nonce) return document.currentScript.nonce; } catch (e) {}
        try { if (window.dataNonce) return window.dataNonce; } catch (e) {}
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) { 
            if (scripts[i].nonce) return scripts[i].nonce; 
        }
        return '';
    })();

    /* ---------------------------------------------------------------------- */
    /*  2. CONFIGURARE GLOBALĂ                                                */
    /* ---------------------------------------------------------------------- */
    var CFG = {
        currency: 'Lei',             // Moneda de afișare
        hideOriginal: true,          // Ascunde doar rândurile vechi de produse
        buyText: 'Cumpără',          // Textul butonului de acțiune
        outOfStockText: 'Stoc epuizat',
        priceRanges: [               // Intervalele pentru filtrul de preț
            { key: '0-4000',        label: 'până la 4.000' },
            { key: '4000-7000',     label: '4.000–7.000' },
            { key: '7000-12000',    label: '7.000–12.000' },
            { key: '12000-99999999', label: '12.000+' }
        ],
        heroMarksTopDiscount: true   // Pune badge "Hero" pe produsul cu cea mai mare reducere
    };

    /* ---------------------------------------------------------------------- */
    /*  3. FUNCȚII UTILITARE                                                  */
    /* ---------------------------------------------------------------------- */

    // Creează rapid un element HTML cu clasă și conținut innerHTML
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    // Formatează un număr în format monetar românesc (ex: 5849.00 -> 5.849,00 Lei)
    function fmtMoney(n) {
        var s = Number(n).toFixed(2);
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts[0] + ',' + parts[1] + '\u00A0' + CFG.currency;
    }

    // Detectează brandul procesorului din denumire sau specificații
    function detectBrand(str) {
        if (!str) return null;
        if (/snapdragon|qualcomm/i.test(str)) return 'snapdragon';
        if (/intel|core\u2122|\bcore\b|ultra|celeron|pentium/i.test(str)) return 'intel';
        if (/ryzen|\bamd\b|radeon/i.test(str)) return 'amd';
        return null;
    }

    // Etichetă lizibilă pentru brandul de procesor
    function brandLabel(b) {
        return b === 'intel' ? 'Intel' : b === 'amd' ? 'AMD' : b === 'snapdragon' ? 'Snapdragon' : '';
    }

    // Curăță textul procesorului de caractere și spații inutile
    function cleanCpu(str) {
        if (!str) return '';
        return str
            .replace(/\s*Processor\s*/i, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* ---------------------------------------------------------------------- */
    /*  4. EXTRAGERE DATE MAGENTO (jsonConfig & DOM)                         */
    /* ---------------------------------------------------------------------- */

    // Citește configurația JSON a opțiunilor de swatch Magento
    function readSwatchConfig(li) {
        var scripts = li.querySelectorAll('script[type="text/x-magento-init"]');
        for (var i = 0; i < scripts.length; i++) {
            var txt = scripts[i].textContent;
            if (!txt || txt.indexOf('swatch-renderer') === -1) continue;
            try {
                var obj = JSON.parse(txt);
                for (var key in obj) {
                    if (key.indexOf('swatch-option') !== -1 && obj[key]['Magento_Swatches/js/swatch-renderer']) {
                        return obj[key]['Magento_Swatches/js/swatch-renderer'].jsonConfig || null;
                    }
                }
            } catch (e) { continue; }
        }
        return null;
    }

    // Selectează varianta de produs preselectată/implicită din JSON
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
        for (var k in cfg.index) return k; // Fallback pe prima variantă
        return null;
    }

    // Extrage o valoare dinamică din jsonConfig (ex: CPU, RAM, cod model)
    function dynVal(cfg, field, vid) {
        try {
            if (cfg && cfg.dynamic && cfg.dynamic[field] && cfg.dynamic[field][vid]) {
                return cfg.dynamic[field][vid].value || '';
            }
        } catch (e) {}
        return '';
    }

    // Extrage TOATE specificațiile din descrierea scurtă sub formă de listă Array
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

    /* ---------------------------------------------------------------------- */
    /*  5. PARSARE PRODUS INDIVIDUAL                                         */
    /* ---------------------------------------------------------------------- */
    function parseProduct(li, family) {
        var link = li.querySelector('a.product-item-link') || li.querySelector('a.product-item-photo');
        if (!link) return null;

        var img = li.querySelector('img.product-image-photo');
        var name = (li.querySelector('a.product-item-link') && li.querySelector('a.product-item-link').textContent.trim()) || '';
        var titleAttr = (link.getAttribute('title') || '').trim();
        var url = link.getAttribute('href') || '#';

        // --- Extragere și calcul Prețuri ---
        var box = li.querySelector('.price-box');
        var finalEl = box && box.querySelector('[data-price-type="finalPrice"]');
        var oldEl = box && box.querySelector('[data-price-type="new-oldPrice"]');

        var finalAmt = finalEl ? parseFloat(finalEl.getAttribute('data-price-amount')) : null;
        var oldAmt = oldEl ? parseFloat(oldEl.getAttribute('data-price-amount')) : null;

        var finalText = finalEl && finalEl.querySelector('.price') ? finalEl.querySelector('.price').textContent.trim() : (box && box.querySelector('.price') ? box.querySelector('.price').textContent.trim() : '');
        var oldText = oldEl && oldEl.querySelector('.price') ? oldEl.querySelector('.price').textContent.trim() : '';

        // Calcul automat al reducerii
        var hasDiscount = false, pct = 0, saveAmt = 0;
        if (finalAmt != null && oldAmt != null && oldAmt > finalAmt) {
            hasDiscount = true;
            saveAmt = oldAmt - finalAmt;
            pct = Math.round((saveAmt / oldAmt) * 100);
        }

        // --- Configurație Magento JSON ---
        var cfg = readSwatchConfig(li);
        var vid = pickVariant(cfg);
        var procVal = cfg ? cleanCpu(dynVal(cfg, 'processor', vid)) : '';
        var modelVal = cfg ? dynVal(cfg, 'sales_model_name', vid) : '';
        var memVal = cfg ? dynVal(cfg, 'memory', vid) : '';
        var shortDesc = cfg ? dynVal(cfg, 'short_description', vid) : '';

        // Identificare Cod Model
        var model = '';
        if (modelVal) {
            var m = modelVal.split(' - ');
            model = (m.length > 1 ? m[m.length - 1] : modelVal).trim();
        }
        if (!model) {
            var rx = (name + ' ' + titleAttr).match(/\b\d{2}[A-Z]{2}[A-Z0-9]*-[A-Z0-9]+\b/);
            if (rx) model = rx[0];
        }

        // Identificare Procesor
        var cpuSource = procVal || name || titleAttr;
        var brand = detectBrand(cpuSource);
        var cpuLabel = procVal || '';
        if (!cpuLabel) {
            var cm = (name + ' ' + titleAttr).match(/(Intel[^,\-–|]*|AMD Ryzen[^,\-–|]*|Ryzen[^,\-–|]*|Snapdragon[^,\-–|]*)/i);
            if (cm) cpuLabel = cleanCpu(cm[0]);
        }

        // Detecție Copilot+ PC
        var copilot = /copilot\s*\+?/i.test(name + ' ' + titleAttr + ' ' + shortDesc);

        // Detecție Memorie RAM
        var ram = 0;
        var rm = (memVal || shortDesc || name).match(/(\d+)\s*GB/i);
        if (rm) ram = parseInt(rm[1], 10);

        // Verificare Stoc
        var outOfStock = !!li.querySelector('.stock.unavailable');

        // Preluare Specificații
        var specs = extractSpecs(shortDesc);

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
    /*  6. GRUPARE PRODUSE PE FAMILII / TAB-URI                              */
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

        // Fallback: dacă nu există tab-uri în pagină, pune toate produsele într-un singur grup
        if (!families.length) {
            var lis2 = root.querySelectorAll('li.product-item');
            var cards2 = [];
            lis2.forEach(function (li) {
                var p = parseProduct(li, 'Modele');
                if (p) cards2.push(p);
            });
            if (cards2.length) families.push({ name: 'Toate modelele', cards: cards2 });
        }

        return families;
    }

    /* ---------------------------------------------------------------------- */
    /*  7. GENERARE CARD DE PRODUS (UI Component)                             */
    /* ---------------------------------------------------------------------- */
    function buildCard(p, isHero) {
        var card = el('div', 'product-card' + (isHero ? ' is-hero' : ''));
        card.setAttribute('data-family', p.family);
        card.setAttribute('data-category', p.brand || '');
        card.setAttribute('data-price', p.finalAmt != null ? Math.round(p.finalAmt) : '');
        card.setAttribute('data-ram', p.ram || '');
        card.setAttribute('data-discount', p.pct || 0);

        // Badge Hero (Cea mai mare reducere din familie)
        if (isHero && p.hasDiscount) {
            card.appendChild(el('span', 'bestseller-ribbon', '\u2605 CEA MAI MARE REDUCERE'));
        }

        // Badge Procent Reducere (-XX%)
        if (p.hasDiscount) {
            card.appendChild(el('div', 'savings-badge', '\u2212' + p.pct + '%'));
        }

        // Badge Categorie / Copilot+
       //if (p.copilot) {
        //    card.appendChild(el('span', 'badge badge-copilot', 'Copilot+ PC'));
        //} else {
           // card.appendChild(el('span', 'badge badge-red', 'ASUS SALES FESTIVAL'));
        //}

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

        // Cod Model
        if (p.model || p.copilot) {
            var modelTxt = p.model || '';
            if (p.copilot) modelTxt += (modelTxt ? ' \u00B7 ' : '') + 'Copilot+ PC';
            card.appendChild(el('div', 'product-model', modelTxt));
        }

        // Cip Procesor
        if (p.cpuLabel && p.brand) {
            card.appendChild(el('span', 'cpu-chip cpu-' + p.brand, p.cpuLabel));
        }

        card.appendChild(el('hr', 'divider'));

        // Prețuri și Economii
        if (p.hasDiscount) {
            card.appendChild(el('div', 'price-label', 'Pre\u021B normal:'));
            card.appendChild(el('div', 'price-old', p.oldText));
            var mega = el('div', 'mega-price-box');
            mega.appendChild(el('span', 'mega-price-label', 'Pre\u021B promo\u021Bional'));
            mega.appendChild(el('span', 'mega-price-amount', p.finalText));
            card.appendChild(mega);
            card.appendChild(el('div', 'save-line', '\u2713 Economise\u0219ti ' + fmtMoney(p.saveAmt)));
        } else {
            var mega2 = el('div', 'mega-price-box');
            mega2.appendChild(el('span', 'mega-price-label', 'Pre\u021B'));
            mega2.appendChild(el('span', 'mega-price-amount', p.finalText));
            card.appendChild(mega2);
        }

        // Afișare Specificații Tehnice cu Toggle "Arată mai mult"
        if (p.specs && p.specs.length) {
            var wrap = el('div', 'product-specs');
            var ul = el('ul', 'specs-list');
            p.specs.forEach(function (s) {
                ul.appendChild(el('li', null, s));
            });
            wrap.appendChild(ul);

            // Adaugă buton doar dacă specificațiile depășesc înălțimea vizibilă inițială (4 elemente)
            if (p.specs.length > 4) {
                wrap.appendChild(el('div', 'show-more-btn', 'Arat\u0103 mai mult \u25BE'));
            }
            card.appendChild(wrap);
        }

        // Butoane Acțiune / Stoc
        var actions = el('div', 'actions-row');
        if (p.outOfStock) {
            actions.appendChild(el('div', 'stock-out', CFG.outOfStockText));
        } else {
            var btn = el('a', 'btn btn-primary', CFG.buyText);
            btn.href = p.url; btn.target = '_blank'; btn.rel = 'noopener';
            actions.appendChild(btn);
            if (p.hasDiscount) {
                actions.appendChild(el('div', 'urgency-text', 'Stoc promo\u021Bional limitat!'));
            }
        }
        card.appendChild(actions);

        return card;
    }

    /* ---------------------------------------------------------------------- */
    /*  8. CONSTRUIREA GALERIEI + SISTEMUL DE FILTRE                          */
    /* ---------------------------------------------------------------------- */
    function buildGallery(families) {
        var root = el('div', 'ssfx');

        // Tab-uri Familii Produse
        var famTabs = el('div', 'fam-tabs');
        families.forEach(function (fam, i) {
            var b = el('button', 'fam-btn' + (i === 0 ? ' active' : ''),
                fam.name + ' <span class="fam-count">' + fam.cards.length + '</span>');
            b.setAttribute('data-family', fam.name);
            famTabs.appendChild(b);
        });
        root.appendChild(famTabs);

        // Bara de Filtrare (CPU / RAM / Preț)
        var filt = el('div', 'filt');

        // Filtru CPU
        var gCpu = el('div', 'filt-group');
        gCpu.appendChild(el('span', 'filt-label', 'Procesor'));
        ['intel', 'amd', 'snapdragon'].forEach(function (c) {
            var chip = el('button', 'chip', brandLabel(c));
            chip.setAttribute('data-cpu', c);
            gCpu.appendChild(chip);
        });
        filt.appendChild(gCpu);

        // Filtru RAM
        var gRam = el('div', 'filt-group');
        gRam.appendChild(el('span', 'filt-label', 'RAM'));
        [['8', '8 GB'], ['16', '16 GB'], ['32', '32 GB+']].forEach(function (r) {
            var chip = el('button', 'chip', r[1]);
            chip.setAttribute('data-ram', r[0]);
            gRam.appendChild(chip);
        });
        filt.appendChild(gRam);

        // Filtru Preț
        var gPrice = el('div', 'filt-group');
        gPrice.appendChild(el('span', 'filt-label', 'Pre\u021B'));
        CFG.priceRanges.forEach(function (pr) {
            var chip = el('button', 'chip', pr.label);
            chip.setAttribute('data-price', pr.key);
            gPrice.appendChild(chip);
        });
        filt.appendChild(gPrice);

        // Buton Resetare
        var reset = el('button', 'filt-reset', 'Reseteaz\u0103 filtrele \u2715');
        filt.appendChild(reset);
        root.appendChild(filt);

        // Grid-ul de produse
        var grid = el('div', 'product-grid');
        families.forEach(function (fam) {
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

        // Mesaj când nu există rezultate
        var noRes = el('div', 'no-results', 'Nu exist\u0103 modele care s\u0103 corespund\u0103 filtrelor selectate.');
        noRes.style.display = 'none';
        grid.appendChild(noRes);
        root.appendChild(grid);

        // --- Logica de Filtrare Interactivă ---
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

        // Eveniment click pe tab-uri
        famTabs.querySelectorAll('.fam-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                famTabs.querySelectorAll('.fam-btn').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                state.family = b.getAttribute('data-family');
                apply();
                root.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        // Evenimente pentru cip-urile de filtrare
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

        // Event listener Reset
        reset.addEventListener('click', function () {
            state.cpu = state.ram = state.price = null;
            filt.querySelectorAll('.chip.active').forEach(function (c) { c.classList.remove('active'); });
            apply();
        });

        // Event listener Extindere/Restrângere Specificații
        grid.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.show-more-btn') : null;
            if (!btn) return;
            var list = btn.parentNode.querySelector('.specs-list');
            if (!list) return;
            var open = list.classList.toggle('expanded');
            btn.innerHTML = open ? 'Arat\u0103 mai pu\u021Bin \u25B4' : 'Arat\u0103 mai mult \u25BE';
        });

        apply();
        return root;
    }

    /* ---------------------------------------------------------------------- */
    /*  9. INJECTARE CSS                                                      */
    /* ---------------------------------------------------------------------- */
    function injectCSS() {
        if (document.getElementById('ssfx-css')) return;
        var css = ''
        + '.ssfx{font-family:"Roboto",Arial,sans-serif;background:#f5f5f5;padding:26px 16px 40px;max-width:100%;box-sizing:border-box}'
        + '.ssfx *,.ssfx *::before,.ssfx *::after{box-sizing:border-box}'

        /* Stiluri Tab-uri */
        + '.ssfx .fam-tabs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:1300px;margin:0 auto 20px}'
        + '.ssfx .fam-btn{background:#fff;border:1px solid #006CE1;color:#006CE1;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;text-transform:uppercase;transition:.25s;display:inline-flex;align-items:center;gap:8px}'
        + '.ssfx .fam-btn:hover{background:#f0f7ff}'
        + '.ssfx .fam-btn.active{background:#006CE1;color:#fff;box-shadow:0 4px 10px rgba(0,108,225,.2)}'
        + '.ssfx .fam-count{font-size:11px;background:rgba(0,0,0,.08);color:inherit;padding:1px 7px;border-radius:10px;font-weight:700}'
        + '.ssfx .fam-btn.active .fam-count{background:rgba(255,255,255,.25)}'

        /* Stiluri Filtre */
        + '.ssfx .filt{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center;justify-content:center;max-width:1300px;margin:0 auto 26px;padding:14px 16px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.05)}'
        + '.ssfx .filt-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
        + '.ssfx .filt-label{font-size:12px;font-weight:700;text-transform:uppercase;color:#757575;letter-spacing:.4px}'
        + '.ssfx .chip{background:#f4f5f7;border:1px solid #e7e9ee;color:#333;padding:7px 14px;border-radius:20px;cursor:pointer;font-size:13px;font-weight:600;transition:.2s}'
        + '.ssfx .chip:hover{border-color:#006CE1;color:#006CE1}'
        + '.ssfx .chip.active{background:#006CE1;border-color:#006CE1;color:#fff}'
        + '.ssfx .filt-reset{background:transparent;border:none;color:#D82C2C;font-size:13px;font-weight:700;cursor:pointer}'
        + '.ssfx .filt-reset:hover{text-decoration:underline}'

        /* Grid și Card Produs */
        + '.ssfx .product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;max-width:1300px;margin:0 auto}'
        + '.ssfx .product-card{background:#fff;border-radius:12px;padding:24px;display:flex;flex-direction:column;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:transform .2s,box-shadow .2s;min-width:0;max-width:100%}'
        + '.ssfx .product-card:hover{transform:translateY(-5px);box-shadow:0 10px 25px rgba(0,0,0,.08)}'

        /* Badge-uri */
        + '.ssfx .badge{color:#fff;border:none;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;align-self:flex-start;margin-bottom:12px;letter-spacing:.02em}'
        + '.ssfx .badge.badge-red{background:#f4f5f7;color:#6b7280;border:1px solid #e7e9ee}'
        + '.ssfx .product-card.is-hero .badge.badge-red{background:#f47d20;color:#fff;border:none}'
        + '.ssfx .badge.badge-copilot{background:linear-gradient(90deg,#006CE1,#8A2BE2);color:#fff}'
        + '.ssfx .savings-badge{position:absolute;top:14px;right:14px;background:#fff;color:#c2410c;font-weight:800;font-size:12.5px;padding:5px 9px;border-radius:8px;border:1px solid #ffd6ad;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.06);z-index:2;line-height:1;letter-spacing:-.3px}'
        + '.ssfx .product-card.is-hero .savings-badge{background:linear-gradient(135deg,#ff9d2f,#f5610a);color:#fff;width:54px;height:54px;padding:0;border:none;border-radius:50%;font-size:15px;box-shadow:0 4px 12px rgba(245,97,10,.38)}'
        + '.ssfx .bestseller-ribbon{font-size:12px;color:#856404;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:3px 8px;align-self:flex-start;margin-bottom:10px;font-weight:700}'

        /* Detalii Dispozitiv */
        + '.ssfx .product-image{text-align:center;margin-bottom:20px;height:200px;display:flex;align-items:center;justify-content:center}'
        + '.ssfx .product-image img{max-width:100%;max-height:100%;object-fit:contain}'
        + '.ssfx .product-title{font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 6px;text-decoration:none;line-height:1.4;display:block}'
        + '.ssfx .product-title:hover{color:#006CE1}'
        + '.ssfx .product-model{font-size:13px;color:#757575;margin-bottom:4px}'
        + '.ssfx .cpu-chip{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin:4px 0}'
        + '.ssfx .cpu-chip.cpu-intel{background:#cce3ff;color:#003d99}'
        + '.ssfx .cpu-chip.cpu-amd{background:#ffddd4;color:#c0392b}'
        + '.ssfx .cpu-chip.cpu-snapdragon{background:#e8d4ff;color:#5a0080}'
        + '.ssfx .divider{height:1px;background:#eee;margin:15px 0;border:none;width:100%}'

        /* Prețuri */
        + '.ssfx .price-label{font-size:13px;color:#757575}'
        + '.ssfx .price-old{display:inline-block;text-decoration:line-through;color:#757575;font-size:14px;margin-top:2px}'
        + '.ssfx .mega-price-box{background:#f0fdf4;border-radius:8px;padding:12px;margin:10px 0 12px;text-align:left;border-left:4px solid #27AE60}'
        + '.ssfx .mega-price-label{font-size:12px;color:#757575;display:block;margin-bottom:4px}'
        + '.ssfx .mega-price-amount{font-size:24px;font-weight:700;color:#D82C2C;display:block}'
        + '.ssfx .save-line{font-size:12px;color:#27AE60;font-weight:700;margin-top:4px}'

        /* Stiluri Specificații */
        + '.ssfx .product-specs{flex-grow:1;margin:10px 0}'
        + '.ssfx .specs-list{font-size:13px;color:#4a4a4a;padding-left:20px;margin:0;max-height:78px;overflow:hidden;transition:max-height .4s ease-out}'
        + '.ssfx .specs-list.expanded{max-height:600px}'
        + '.ssfx .specs-list li{margin-bottom:6px}'
        + '.ssfx .show-more-btn{color:#006CE1;font-size:13px;font-weight:600;cursor:pointer;margin-top:6px;display:inline-block;user-select:none}'
        + '.ssfx .show-more-btn:hover{text-decoration:underline}'

        /* Butoane Acțiune */
        + '.ssfx .actions-row{display:flex;flex-direction:column;gap:8px;margin-top:12px}'
        + '.ssfx .btn{width:100%;text-align:center;padding:12px;border-radius:8px;font-weight:600;font-size:16px;cursor:pointer;text-decoration:none;transition:.3s;display:inline-block;text-transform:uppercase}'
        + '.ssfx .btn-primary{background:#006CE1;color:#fff;border:1px solid #006CE1;box-shadow:0 4px 10px rgba(0,108,225,.2)}'
        + '.ssfx .btn-primary:hover{background:#005bb5;color:#fff;transform:translateY(-1px);box-shadow:0 6px 15px rgba(0,108,225,.3)}'
        + '.ssfx .stock-out{width:100%;text-align:center;padding:12px;border-radius:8px;font-weight:700;font-size:15px;background:#f4f5f7;color:#9aa0a6;text-transform:uppercase}'
        + '.ssfx .urgency-text{font-size:12px;color:#D82C2C;font-weight:600;text-align:center}'

        + '.ssfx .no-results{grid-column:1/-1;text-align:center;padding:40px;font-size:16px;color:#757575}'

        /* Media Queries (Mobile) */
        + '@media(max-width:767px){.ssfx .product-grid{grid-template-columns:1fr}.ssfx .fam-btn{padding:9px 14px;font-size:13px}}';

        var style = el('style');
        style.id = 'ssfx-css';
        if (PAGE_NONCE) { 
            try { style.nonce = PAGE_NONCE; } catch (e) {} 
            style.setAttribute('nonce', PAGE_NONCE); 
        }
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    /* ---------------------------------------------------------------------- */
    /*  10. ASCUNDEREA CONȚINUTULUI ORIGINAL                                  */
    /* ---------------------------------------------------------------------- */
    function hideOriginal(root) {
        if (!CFG.hideOriginal) return;
        // Ascunde doar rândurile DOM care conțin grila originală de produse (`li.product-item`)
        root.querySelectorAll('[data-content-type="row"]').forEach(function (r) {
            if (r.querySelector('li.product-item')) r.style.display = 'none';
        });
    }

    /* ---------------------------------------------------------------------- */
    /*  11. INIȚIALIZARE SCRIPT                                              */
    /* ---------------------------------------------------------------------- */
    function init() {
        var root = document.getElementById('maincontent') || document.querySelector('.column.main') || document.body;
        if (!root) return;

        // 1. Extrage produsele din DOM
        var families = collectFamilies(root);
        if (!families.length) return;

        // 2. Injectează CSS-ul dedicat
        injectCSS();

        // 3. Construiește elementul vizual al noii galerii
        var gallery = buildGallery(families);

        // 4. Inserează galeria în pagina exact deasupra vechilor produse
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

        // 5. Ascunde vechile produse
        hideOriginal(root);
    }

    // Executare la încărcarea DOM-ului
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
