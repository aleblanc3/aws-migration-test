export const allowedElements: string[] = [
    'header', 'footer', 'main', 'body',
    'div', 'span', 'section', 'nav', 'time', 'abbr',
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'form', 'input', 'label', 'fieldset', 'legend', 'button',
    'strong', 'aside', 'summary', 'details',
    'a', 'img', 'figure', 'figcaption'
];

export const allowedClasses: (string | RegExp)[] = [
    //AEM
    /^(mwsgeneric-base-html|mwstitle|mwsbodytext|parbase)$/,

    // Alerts / Status
    /^alert(-(danger|dismissable|dismissible|info|link|success|warning))?$/,
    /^(danger|success|warning|info|secondary|error|errmsg|has-(error|feedback|success|warning))$/,

    // Alignment / Layout / Display
    /^align-(bottom|middle|top|items-(center|sm-center)|self-(center|end))$/,
    /\b(center|full-width|flex(-column|-sm-wrap)?|hide|invisible|left|pre-scrollable|right|row-no-gutters|show|stretched-link|text-hide|small|sm|xxsmallview|xlargeview)\b/,
    /^d(-(sm-)?flex)?$/,
    /^pull-(left|right)$/,
    /^(top(-(left|right))?|bottom(-(left|right))?)$/,
    /^mrgn-(tp|bttm|lft|rght)-(0|xs|sm|md|lg|xl)$/,
    /^(m|p)([trblxy]?)-(auto|[0-5])$/,
    /^(m|p)([trblxy]?)-(lg|md|sm)-?(auto|[0-5])$/,
    /^pstn-(bttm|lft|rght|tp)-(lg|md|sm|xs)$/,
    /^margin-(top|bottom)-(none|large|medium)$/,
    /^(cnt-wdth-lmtd|container(-fluid)?|max-content|allow-wrap|nowrap|position-relative|grow|)$/,
    /^(hght-inhrt|eqht-trgt)$/,

    // Backgrounds
    /^bg-(center|cover|danger|dark(er)?|gctheme|img-hdng|info|light|norepeat|pnkDy|primary|success|warning)$/,
    /(no-)?backgroundsize/,

    // Borders
    /^brdr-(0|bttm|lft|rght|tp|rds-0)$/,

    // Calendar
    /^cal-(cnt-fluid|curr-day|days|evt|evt-lnk|nav)$/,

    // Carousel / Slideshows
    /^carousel(-(caption|control|indicators|inner|s[12]))?$/,
    /\b(fd-(slider|wdgt)(-(bar|handle|range))?|slide|slidefade|slidevert)\b/,

    // Clearfix
    /^clr-(lft|rght)-(lg|md|sm)$/,

    // Columns / Grid system
    /^col-?(xs|sm|md|lg)?-?([0-9]{1,2}|auto)?$/,
    /^col-(xs|sm|md|lg)-(offset|push|pull)-[0-9]{1,2}$/,
    /^colcount-(xxs|xs|sm|md|lg|xl)-[2-4]$/,
    'colcount-no-break',
    /^row(border)?$/,

    // Embeds
    /^embed-responsive(-(16by9|4by3|item))?$/,

    // Headings
    /^h(1|2|3|4|5|6)$/,

    // File extensions
    /\b(jpg|png|woff2?|ttf|eot|svg)\b/,

    // Forms / Inputs / UI controls
    /^btn(-(block|call-to-action|cnt|danger|default|group(-(justified|lg|sm|vertical|xs))?|info|lg|link|primary|sm|success|toolbar|warning|xs|all-services))?$/,
    /^form-(control(-(feedback|static))?|group(-(lg|sm))?|horizontal|inline)$/,
    /\b(checkbox(-inline|-standalone)?|radio(-inline)?|control(-label)?|controls|inputs-zone|submit|reset|picker-overlay|datepicker-format)\b/,
    /^(input-(group(-(addon|btn|lg|sm))?|lg|sm)|form-(control(-(feedback|static))?|group(-(lg|sm))?|horizontal|inline))$/,
    /\b(active|disabled|selected|hover|required(-no-asterisk)?)\b/,
    /\b(buttons|basic-link|legend-brdr-bttm|legend-label-only)\b/,
    /^dropdown-?(backdrop|header|menu-?(left|right)?|toggle)?$|^dropup$/,

    // Geomap
    /^geomap-(aoi|clear-format|geoloc(-aoi-btn)?|help-(btn|dialog)|legend-(detail|element|label|symbol(-text)?)|lgnd(-layer)?|progress)$/,
    'geoloc-progress',

    // Labels
    /^label(-(danger|default|info|inline|primary|success|warning))?$/,

    // Lists
    /^list-col-(xs|sm|md|lg)-[1-4]$/,
    /^list-group(?:-item(?:-(?:danger|heading|info|success|text|warning))?)?$/,
    /^list-(advanced|inline|responsive|unstyled)$/,
    /^lst-(?:spcd(?:-2)?|lwr-(?:alph|rmn)|upr-(?:alph|rmn)|none|num)$/,
    /^dl-(horizontal|inline)$/,
    'disc',

    // Media & Images
    /\b(media(-(body|bottom|heading|left|middle|object|right))?|audio|video|feed|feeds-(cont|date)|figcaption|pln|highlighted|fun|quiz|question|mark)\b/,
    /^(thumbnail|badge(-dept)?|avatar|cmpgn-(img|sctns)|cndwrdmrk)$/,
    /^img-(circle|responsive|rounded|thumbnail)$/,

    // Modals
    /^modal-?(backdrop|body|content|dialog|footer|header|lg|open|scrollbar-measure|sm|title)?$/,
    /^mfp-[a-z0-9-]+$/,
    /^overlay(-bg|-close|-def)?$/,

    // Navbar
    /^navbar-?(brand|btn|collapse|default|fixed-(bottom|top)|form|header|inverse|left|link|nav|right|static-top|text|toggle)?$/,
    /^nav-?(tabs|justified|pills|stacked|divider)?$/,
    /^(nvbar|current)$/,

    // Opacity
    /^opct-(10|20|30|40|50|60|70|80|90|100)$/,

    // Pagination / Sorting
    /^(paginate-?(next|prev)|pagntn-prv-nxt|pgntn-lbl|pager|page-(header|type-(ilp|nav|search|theme))|_button)$/,
    /^pagination(-lg)?$/,
    /^sorting(_(1|2|3|asc(_disabled)?|desc(_disabled)?)|(-cnt|-icons))?$/,
    /^(next|nxt|previous|prev)$/,

    // Panels
    /^panel-?(body|collapse|danger|default|footer|group|heading|info|primary|success|title|warning)?$/,
    /^well(-(bold|lg|sm))?$/,
    /\b(sm-pnl|lastpnl|tgl-panel|frstpnl|sec-pnl|info-pnl)\b/,
    /^tab-?(content|count|pane|panels|acc)$/,
    'expanded',

    // Progress bar
    /^progress(-bar(-(danger|info|striped|success|warning))?|Striped|Bar|Text)?$/,

    // Tables
    /^table-?(bordered|columnfloat|condensed|hover|responsive|striped)?$/,
    /^(data(T|t)ables?_?(empty|filter|info|length|paginate|processing|scroll(Body|Head)?|sizing|wrapper)?)$/,
    /^nws-tbl-?(date|dept|desc|ttl|type)?$/,

    // Tooltips / Popovers
    /^(tooltip-?(arrow|inner|txt)|popover-?(content|title)?)?$/,

    // Text
    /^text-(center|left|right|sm-left|sm-right|danger|info|justify|lowercase|muted|nowrap|primary|success|uppercase|warning|white|capitalize)$/,
    'lead',

    // Visibility
    /^visible-(xs|sm|md|lg|print)(-(block|inline|inline-block))?$/,
    /^hidden(-(xs|sm|md|lg|print|hd))?$/,
    /^sr-only(-focusable)?$/,

    // Skeleton
    /^skeleton-lgnd-(1|2|3)$/,

    // Multi-step UI
    /\b(steps-wrapper|stepsquiz|expand-collapse-buttons)\b/,

    // Social media
    /\b(facebook|twitter(-timeline(-loading|-rendered)?)?|instagram|linkedin|tumblr|reddit|pinterest|youtube|gmail|yahoomail|googleplus|diigo|foursquare|myspace|periscope|x(-social)?|whatsapp|github|social-lnk)\b/,

    // Framework / WET / GC
    /^wb-[a-z0-9-]+$/,
    /^gc-[a-z0-9-]+$/,
    /^gcds[a-z0-9-]*$/,
    /^ol(-[a-z0-9-]+)?$/,

    // Page elements
    /\b(pagebrand|pagedetails|section|sect-lnks|sctn-desc|breadcrumb|caption|title|subtitle|datemod|departments|features|followus|gcweb-menu|menu|profile|intro|most-requested-bullets)\b/,

    // Product elements
    /\bproduct(-data-(compressed|expanded|hidden)|-department|-icon|-language|-link(-container|-list)?|-listing|-name|-platforms|-record|-shortdescription|-longdescription)?\b/,

    // Icons
    /^glyphicon(-[a-z0-9-]+)?$/,
    /^icon-?(bar|next|prev|warning-light)$/,
];

export const disallowedAttributes: (string | RegExp)[] = [
    /^on.*/,       // any inline JS handler like onclick, onmouseover
    //'style'        // inline styles, these are added by page assistant so needs extra check to
];

export const depracatedClasses: (string | RegExp)[] = [
    'gc-byline'
];

export const specialGuidance: (string | RegExp)[] = [
    'gc-chckbxrdio',       // any inline JS handler like onclick, onmouseover
    'style'        // inline styles, unless you want to allow them
];

/*
'active',
    'affix',
    'avatar',
    'blockquote-reverse',
    'clearfix',
    'collapse',
    'collapsing',
    'container',
    'container-fluid',
    'cnt-wdth-lmtd',
    'disabled',
    'dropdown',
    'dropdown-menu',
    'dropdown-toggle',
    'embed-responsive',
    'jumbotron',
    'lead',
    'media',
    'modal',
    'mwsgeneric-base-html',
    'nav',
    'navbar',
    'nowrap',
    'open',
    'pagination',
    'panel',
    'parbase',
    'popover',
    'progress',
    'row',
    'sr-only',
    'tab-content',
    'tab-pane',
    'table',
    'tooltip',
'list-unstyled',
    'lst-spcd-2',
    'checkbox',
    'gc-chckbxrdio',
    /^btn-?(default)?$/,
    /^form-(inline|group|control)$/,
    'field-name',
    'legend-brdr-bttm',
    /^wb-.+$/,         // any WET core component
    /^gcwu-.+$/,       // Government of Canada theme classes
    /^visible-(xs|sm|md|lg)$/,         // responsive visibility
    /^hidden-(xs|sm|md|lg)$/,
    'wb-inv',
    'show',
    'hidden',
    'invisible',
    'visible-print',
    'hidden-print',
    /^modal$/,         // generic UI components
    /^tabs?$/,         // tab or tabs
    /^carousel$/,
    /^alert(-\w+)?$/,  // e.g. alert-warning
    /^badge$/,
    /^well$/,
    /^grid(-\w+)?$/,   // grid or grid-fluid, etc.*/