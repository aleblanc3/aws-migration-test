import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';

export interface GitHubFileRequest {
  message: string;
  content: string; // convert to base64
  branch?: string;
  sha?: string;    // needed when overwriting
}

@Injectable({
  providedIn: 'root'
})
export class ExportGitHubService {
  private fetchService = inject(FetchService);

  private async formatHtmlWithPrettier(html: string): Promise<string> {
    if (!(navigator as any).languages) {
      (navigator as any).languages = ['en']; // fallback locale
    }

    try {
      const [{ default: prettier }, parserHtml] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/html'),
      ]);

      return prettier.format(html, {
        parser: 'html',
        plugins: [parserHtml],
        printWidth: Infinity,
        tabWidth: 4,
        useTabs: false,
        htmlWhitespaceSensitivity: 'css',
        arrowParens: "always",
        bracketSameLine: false,
        bracketSpacing: false,
        embeddedLanguageFormatting: "auto",
        endOfLine: "crlf",
        jsxSingleQuote: false,
        objectWrap: "collapse",
        ProseWrap: "never",
        quoteProps: "consistent",
        singleAttributePerLine: false,
        singleQuote: false,
        trailingComma: "none",
        vueIndentScriptAndStyle: true
      });
    } catch (error) {
      console.error("Prettier formatting error:", error);
      return html; // fallback - return unformatted html
    }
  }

  public async formatDocumentAsJekyll(doc: Document, url: string, owner: string, repo: string): Promise<string> {

    let layout = "default";

    // Extract metadata
    const title = (doc.querySelector('meta[name="dcterms.title"]') as HTMLMetaElement)?.content.trim() || doc.title.trim() || "";
    const description = (doc.querySelector('meta[name="description"]') as HTMLMetaElement)?.content.trim() || "";
    const subject = (doc.querySelector('meta[name="dcterms.subject"]') as HTMLMetaElement)?.content.trim() || "";
    const keywords = (doc.querySelector('meta[name="keywords"]') as HTMLMetaElement)?.content.trim() || "";
    const lang = (doc.querySelector('meta[name="dcterms.language"]') as HTMLMetaElement)?.content?.slice(0, 2) || "en";
    const issued = (doc.querySelector('meta[name="dcterms.issued"]') as HTMLMetaElement)?.content || "";
    const modified = (doc.querySelector('meta[name="dcterms.modified"]') as HTMLMetaElement)?.content || "";

    // Set alternate language link
    const altLangPage =
      Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]'))
        .find(link => link.getAttribute("hreflang") !== lang)?.href || "";

    // Breadcrumbs
    const crumbs = Array.from(doc.querySelectorAll("ol.breadcrumb li"))
      .slice(1) // skip homepage
      .map(li => {
        const a = li.querySelector("a");
        if (!a) return null;
        const rawHref = a.getAttribute("href") || "";
        return {
          title: a.textContent?.trim() || "",
          link: rawHref.startsWith("http") ? a.href : `https://www.canada.ca${a.getAttribute("href")}`,
        };
      })
      .filter(Boolean) as { title: string; link: string }[];

    const crumbsYaml = crumbs.map(crumb => `  - title: "${crumb.title}"\r\n    link: "${crumb.link}"`).join("\r\n");

    // Sign in button
    const auth = lang === "en"
      ? `auth:\r\n  type: "contextual"\r\n  label: "Sign in"\r\n  labelExtended: "CRA sign in"\r\n  link: "https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html"`
      : `auth:\r\n  type: "contextual"\r\n  label: "Se connecter"\r\n  labelExtended: "Se connecter à l'ARC"\r\n  link: "https://www.canada.ca/fr/agence-revenu/services/services-electroniques/services-ouverture-session-arc.html"`;

    // Page content
    const mainEl = doc.querySelector("main");
    let pageContent = "";

    if (mainEl) {
      // Remove page details
      mainEl.querySelectorAll("section.pagedetails").forEach(s => s.remove());
      mainEl.querySelectorAll("div.pagedetails").forEach(d => d.remove());

      // Flatten AEM mws wrappers
      mainEl.querySelectorAll('div[class^="mws"]').forEach(div => {
        while (div.firstChild) {
          div.parentNode?.insertBefore(div.firstChild, div);
        }
        div.remove();
      });

      /*Remove empty elements (not recursive, consider doing multiple passes if needed) <-- This removes font awesome icons since they are in empty spans
      mainEl.querySelectorAll("div, section, p, span, li, strong").forEach(el => {
        if (el.childElementCount === 0 && !el.textContent?.trim()) {
          el.remove();
        }
      });*/

      /*Fix nested elements <-- need to find page to test this
      ["strong", "b", "em", "i", "u"].forEach(tag => {
        let nested = mainEl.querySelectorAll(`${tag} ${tag}`);
      
        while (nested.length > 0) {
          nested.forEach(inner => {
            const parent = inner.parentElement;
            if (parent && parent.tagName.toLowerCase() === tag) {
              // Move all child nodes of inner up to the parent
              while (inner.firstChild) {
                parent.insertBefore(inner.firstChild, inner);
              }
              inner.remove();
            }
          });
          // Update nested list in case there are multiple levels
          nested = mainEl.querySelectorAll(`${tag} ${tag}`);
        }
      });*/

      // Fix relative URLs
      mainEl.querySelectorAll<HTMLElement>("*").forEach(el => {
        for (let attr of Array.from(el.attributes)) {
          if (attr.value && attr.value.includes('"/')) {
            attr.value = attr.value.replace(/"\//g, '"https://www.canada.ca/');
          }
          if (attr.value && attr.value.startsWith("/")) {
            attr.value = `https://www.canada.ca${attr.value}`;
          }
        }
      });

      // Change layout for atypical H1's or full width banners (most requested etc.)
      const h1s = doc.querySelectorAll("h1");
      const hasSubway = doc.querySelector(".gc-subway");
      const hasLeadAboveH1 = h1s[0]?.previousElementSibling?.matches("p.lead") || !!h1s[0]?.previousElementSibling?.querySelector?.("p.lead");
      const hasHgroup = doc.querySelector("hgroup");
      if (
        hasSubway ||
        h1s.length > 1 ||
        (h1s[0] && h1s[0].textContent?.trim().replace("&nbsp;", " ") !== title) ||
        h1s[0]?.closest(".well") ||
        hasLeadAboveH1 ||
        hasHgroup
      ) {
        layout = "without-h1";
      }
      else if (!mainEl.classList.contains("container")) { layout = "no-container"; }
      else {
        // Remove the H1 since Jekyll will inject it
        h1s[0]?.remove();
      }

      pageContent = mainEl.innerHTML
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{2,}/g, "\n")
        .split("\n")
        .map(line => line.replace(/(\S)( {2,})/g, (m, first) => first + " "))
        .join("\n");
    }

    pageContent = await this.formatHtmlWithPrettier(pageContent);

    // Content in jekyll format
    const frontMatter = `---\r\nlayout: ${layout}\r\ntitle: "${title}"\r\ndescription: "${description}"\r\nsubject: "${subject}"\r\nkeywords: "${keywords}"\r\n${auth}\r\naltLangPage: "${altLangPage}"\r\ndateModified: ${modified}\r\ndateIssued: ${issued}\r\nbreadcrumbs: # By default the Canada.ca crumbs is already set\r\n${crumbsYaml || "  []"}\r\nfeedbackData:\r\n  section: "${title}"\r\nnotedlinks:\r\n  - title: "${title}"\r\n    link: "${url}"\r\n  - title: "Repository sitemap"\r\n    link: "https://${owner}.github.io/${repo}/index.html"\r\n---\r\n\r\n${pageContent}`;

    return frontMatter;
  }

  private async createConfigYaml(owner: string, repo: string, branch: string, token: string, existingFiles: Map<string, string>): Promise<void> {
    const content = `---
# standard jekyll configuration
content_editable: true
baseurl: /${repo}
url: https://${owner}.github.io
repository: ${owner}/${repo}
website: https://www.canada.ca/en.html

# Remote theme, use the latest version
remote_theme: wet-boew/gcweb-jekyll

# Files excluded from Jekyll builds
exclude:
 - README.md
 - Gemfile
 - Gemfile.lock
 - gcweb-jekyll.gemspec

# Site settings
assets: https://wet-boew.github.io/themes-dist
creator:
  en: "Canada Revenue Agency"
  fr: "Agence du revenu du Canada"

# Custom settings
developerOptions: false
devOptionsLocStore: "gitCRATemplateDevOptions"
exitByURL: true
exitPage:
  en: "/${repo}/source/exit-intent-e.html"
  fr: "/${repo}/source/exit-intent-f.html"
externalOrigin: "https://www.canada.ca"
modifiedLinkList: "/${repo}/source/data/exclude-redirect-links.json"
relativeExternalLinks: false
testBanner: true

# Page front matter defaults
defaults:
  - scope:
      path: "" # Ensure it's applied to all pages
      type: pages
    values:
      layout: default
      lang: en
      share: true
      sitemenu: true
      sitesearch: true
      feedback: true
      feedbackData:
        theme: "Taxes"
      feedbackPath: https://www.canada.ca/etc/designs/canada/wet-boew/assets/feedback/page-feedback-en.html
      privacyUrl: https://www.canada.ca/en/revenue-agency/corporate/privacy-notice.html
      termsURL: https://www.canada.ca/en/transparency/terms.html
      sitemenuPath: https://www.canada.ca/content/dam/canada/sitemenu/sitemenu-v2-en.html
      contextualFooter:
        title: "Canada Revenue Agency (CRA)"
        links:
          - text: "Contact the CRA"
            url: "https://www.canada.ca/en/revenue-agency/corporate/contact-information.html"
          - text: "Update your information"
            url: "https://www.canada.ca/en/revenue-agency/services/update-information-cra.html"
          - text: "About the CRA"
            url: "https://www.canada.ca/en/revenue-agency/corporate/about-canada-revenue-agency-cra.html"
      css:
        - https://use.fontawesome.com/releases/v5.15.4/css/all.css
        - https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/m%C3%A9li-m%C3%A9lo/2025-12-mille-iles.css
        - https://cra-design.github.io/core-prototype/source/css/testing-banner.css
      script:
        - https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/m%C3%A9li-m%C3%A9lo/2025-12-mille-iles.js
        - https://cra-design.github.io/core-prototype/source/scripts/external-link-detour.js
        `
    try {
      console.log(`Creating _config.yml for ${repo}`);
      await this.exportToGitHub(owner, repo, branch, "_config.yml", "_config.yml", content, token, existingFiles, false, false);
    } catch (error) {
      console.error(`Failed to create _config.yml for ${repo}:`, error);
    }
  }

  private async createSitemap(owner: string, repo: string, branch: string, token: string, existingFiles: Map<string, string>): Promise<void> {
    const date = new Date();
    const today = date.toISOString().split("T")[0];
    const content = `---
testBanner: false
title: "${repo} repository sitemap [GCWeb Jekyll pages]"
dateModified: ${today}
dateIssued: ${today}
nositesearch: true
nomenu: true
breadcrumbs: false
feedback: false
share: false
noFooterContextual: true
noFooterCorporate: true
noFooterMain: true
---

<div class="mrgn-tp-md brdr-bttm">
    <div class="row">
        <ul class="toc lst-spcd col-md-12">
            <li class="col-md-4 col-sm-6"><a class="list-group-item active" data-exit="false" href="https://github.com/${owner}/${repo}/tree/main">GitHub repository</a></li>
        </ul>
    </div>
</div>
<ul>
{% assign sitePages = site.pages | sort: "url" %}
{% for p in sitePages %}
    {% include sitemaplink.html url = p.url title = p.title %}
    {% assign page_url = p.url | slice: 1, p.url.size %}
    {% assign folder_path = page_url | split: "/" %}
{% endfor %}
</ul>`

    try {
      console.log(`Creating sitemap for ${repo}`);
      await this.exportToGitHub(owner, repo, branch, "index.html", "index.html", content, token, existingFiles, false, false);
    } catch (error) {
      console.error(`Failed to create sitemap for ${repo}:`, error);
    }
  }

  //Set up README.md <-- add mermaid chart to this
  async createInitialReadme(owner: string, repo: string, branch: string, token: string, existingFiles: Map<string, string>) {
    const filename = "README.md";
    const date = new Date();
    const today = date.toISOString().split("T")[0];
    date.setDate(date.getDate() - 14);
    const startDate = date.toISOString().split("T")[0]; // 2 weeks ago
    date.setDate(date.getDate() + 98);
    const endDate = date.toISOString().split("T")[0]; // 14 weeks from start

    const content = `# ${repo} COP

*description of the COP*

**COP timeframe** ${startDate} - ${endDate}

## Overview

This repository was created via the **Design Assistant**.  
It contains the template files and in-scope pages needed to get started.

GitHub Pages: [https://${owner}.github.io/${repo}](https://${owner}.github.io/${repo})

---
## Update procedures

Add information on how to manage the repo here.

---
## Design phase roadmap:

- [x] Initial content inventory and repo setup
- [ ] Prototype: co-design navigation and content
- [ ] SME review and accuracy check
- [ ] Validation usability testing (including accessibility review)
- [ ] Refine prototype (if required)
- [ ] Spot check usability (if required)

**Updated:**  ${today}
`;

    try {
      console.log(`Creating initial README.md for ${repo}`);
      await this.exportToGitHub(owner, repo, branch, filename, filename, content, token, existingFiles, true, false);
    } catch (error) {
      console.error(`Failed to create README.md for ${repo}:`, error);
    }
  }

  private filesToCopy = [
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/_includes/header/header.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/_includes/resources-inc/footer.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/exit-intent-e.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/404.html",
  ];

  private async copyCoreFiles(owner: string, repo: string, branch: string, token: string, existingFiles: Map<string, string>) {
    for (const file of this.filesToCopy) {
      try {
        const urlParts = new URL(file).pathname.split("/");
        const destPath = urlParts.slice(4).join("/"); // everything after /main/

        // Fetch file content from source repo   
        const response = await this.fetchService.fetchWithRetry(file, "GET");
        if (!response.ok) throw new Error(`Failed to fetch: ${file}`);
        const content = await response.text();

        // Upload to destination repo
        await this.exportToGitHub(owner, repo, branch, destPath, destPath.split("/").pop() || destPath, content, token, existingFiles, true, true);

      } catch (error) {
        console.error(`Error copying core file ${file}:`, error);
      }
    }
  }

  // Get list of public repos for an owner (user or org)
  public async getRepoList(owner: string): Promise<{ name: string }[]> {
    const type = await this.getOwnerType(owner);
    const url =
      type === 'Organization'
        ? `https://api.github.com/orgs/${owner}/repos?per_page=100&type=public`
        : `https://api.github.com/users/${owner}/repos?per_page=100&type=public`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to load repos: ${response.status}`);
    }
    return response.json(); // array of repos
  }

  // Determine if owner is a user or organization
  private async getOwnerType(owner: string): Promise<'User' | 'Organization'> {
    const response = await fetch(`https://api.github.com/users/${owner}`, {
      headers: { "Accept": "application/vnd.github+json" }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch owner type for ${owner}: ${response.status}`);
    }
    const data = await response.json();
    return data.type as 'User' | 'Organization';
  }

  //Check if repo exists
  private async repoExists(owner: string, repo: string): Promise<boolean> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "Accept": "application/vnd.github+json" }
    });
    return response.ok;
  }

  private async createRepo(owner: string, repo: string, branch: string, token: string) {
    console.log(`Repo ${owner}/${repo} not found. Creating...`);
    const type = await this.getOwnerType(owner);
    const url =
      type === 'Organization'
        ? `https://api.github.com/orgs/${owner}/repos`
        : `https://api.github.com/user/repos`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        name: repo,
        private: false,
        auto_init: true,
        default_branch: branch,
        description: "Repo created via design assistant",
        homepage: `https://${owner}.github.io/${repo}/`
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create repo: ${response.status}`);
    }
    console.log(`New repo "${repo}" created.`);
    return response.json();
  }

  private async enablePages(owner: string, repo: string, branch: string, token: string) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        source: {
          branch: branch,
          path: "/"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to enable Pages: ${response.status}`);
    }
    console.log(`GitHub Pages enabled on ${branch} branch.`);
    return response.json();
  }

  public async setupRepo(owner: string, repo: string, branch: string, token: string, existingFiles: Map<string, string>) {
    const exists = await this.repoExists(owner, repo);

    //Create repo
    if (!exists) {
      await this.createRepo(owner, repo, branch, token);
      await this.enablePages(owner, repo, branch, token);
      const existingFiles = await this.getRepoTree(owner, repo, branch, token);
      await this.createInitialReadme(owner, repo, branch, token, existingFiles);
    } else {
      console.log(`Repo ${owner}/${repo} already exists. Skipping creation.`);
    }

    // Now push files
    await this.copyCoreFiles(owner, repo, branch, token, existingFiles);
    await this.createConfigYaml(owner, repo, branch, token, existingFiles);
    //await this.createSitemap(owner, repo, branch, token, existingFiles);
  }

  //Check for existing files in a repo
  public async getRepoTree(
    owner: string,
    repo: string,
    branch: string,
    token: string
  ): Promise<Map<string, string>> {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

    const response = await fetch(treeUrl, {
      headers: { Authorization: `token ${token}` },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch repo tree: ${response.status}`);
      return new Map();
    }

    const data = await response.json();
    const fileMap = new Map<string, string>();

    if (Array.isArray(data.tree)) {
      for (const item of data.tree) {
        if (item.type === "blob") {
          fileMap.set(item.path, item.sha);
        }
      }
    }

    return fileMap;
  }

  private b64EncodeUnicode(str: string): string {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = "";
    utf8Bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  async exportToGitHub(owner: string, repo: string, branch: string, path: string, filename: string, content: string, token: string, existingFiles: Map<string, string>, overwrite = false, copyFromCore = false) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Skip exporting if file already exists and overwrite is false
    if (!overwrite && existingFiles?.has(path)) {
      console.log(`Skipping ${path} (already exists, overwrite=false)`);
      return { skipped: true, path, reason: "exists" };
    }

    // Check if file exists to get the SHA for updating if overwrite is true (otherwise it will throw an error for existing files)
    let sha: string | undefined;
    if (overwrite && existingFiles?.has(path)) {
      sha = existingFiles.get(path);
    }

    const body: GitHubFileRequest = {
      message: copyFromCore
        ? `Copy ${filename} from core-prototype (via Design Assistant)`
        : sha
          ? `Update ${filename} (via Design Assistant)`
          : `Add ${filename} (via Design Assistant)`,
      content: this.b64EncodeUnicode(content),
      branch: branch
    };

    if (sha) {
      body.sha = sha; // only required if updating
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`GitHub API error: ${response.status} ${error.message || ""}`)
    }

    return response.json();
  }
}

