export interface UrlItem {
    href: string;
    status: 'ok' | 'bad' | 'redirect' | 'blocked' | 'checking';
    originalHref?: string;
}

export interface UrlPair {
    production: UrlItem;
    prototype?: UrlItem;
}

export interface PageData {
    href: string;                 // the page URL
    h1: string;                   // the page H1
    breadcrumb: BreadcrumbNode[]; // array of breadcrumbs
    descendants: string[];        // flat list of child pages urls
    minDepth: number;             // how deep we need to crawl to reach furthest child page
    prototype?: string;           // carry forward the prototype link
}

export interface BreadcrumbNode {
    label: string;            // link text
    url: string;              // link
    isRoot?: boolean;         // marks if it's one of the detected root pages (from user input)
    isBeforeRoot?: boolean;   // marks if it's before the first root page (from user input)
    isDescendant?: boolean;   // mark if it's a child page (from user input)
    valid?: boolean;          // true = link found on parent, false = IA orphan
    styleClass?: string;      // for the label (used to set color and/or bold)
    icon?: string;            // represents status of link from parent to child
    iconTooltip?: string;     // explanation for icon
    linkTooltip?: string;     // explanation for color/boldness of label
    prototype?: string;       // carry forward the prototype link
    minDepth?: number;         // carry forward how far to crawl from root to deepest user added child
}

export interface FullscreenHTMLElement extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

export interface PageMeta {
    h1?: string;
    breadcrumb?: string[];
    links?: string[];
    status: number;
};

export interface BrokenLinks {
    parentUrl?: string,
    url: string,
    status: number
}

export interface SearchMatches {
    url: string;
    h1: string;
}