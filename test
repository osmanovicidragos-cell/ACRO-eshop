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
