import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';

export interface GitHubFileRequest {
  message: string;
  content: string; // base64
  branch?: string;
  sha?: string; // only when overwriting
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
      const { default: prettier } = await import('prettier/standalone');
      const parserHtml = await import('prettier/parser-html');

      console.log(prettier, parserHtml);
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

  public async formatDocumentAsJekyll(doc: Document, url: string): Promise<string> {

    let layout = "default";

    // Extract metadata
    const title = (doc.querySelector('meta[name="dcterms.title"]') as HTMLMetaElement)?.content || doc.title || "";
    const description = (doc.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || "";
    const subject = (doc.querySelector('meta[name="dcterms.subject"]') as HTMLMetaElement)?.content || "";
    const keywords = (doc.querySelector('meta[name="keywords"]') as HTMLMetaElement)?.content || "";
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

      // Flatten AEM mws wrappers
      mainEl.querySelectorAll('div[class^="mws"]').forEach(div => {
        while (div.firstChild) {
          div.parentNode?.insertBefore(div.firstChild, div);
        }
        div.remove();
      });

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

      if (!mainEl.classList.contains("container")) layout = "no-container";
      if (doc.querySelector(".gc-subway")) layout = "without-h1";

      pageContent = mainEl.innerHTML
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{2,}/g, "\n")
        .split("\n")
        .map(line => line.replace(/(\S)( {2,})/g, (m, first) => first + " "))
        .join("\n");
    }

    pageContent = await this.formatHtmlWithPrettier(pageContent);

    // Content in jekyll format
    const frontMatter = `---\r\nlayout: ${layout}\r\ntitle: "${title}"\r\ndescription: "${description}"\r\nsubject: "${subject}"\r\nkeywords: "${keywords}"\r\n${auth}\r\naltLangPage: "${altLangPage}"\r\ndateModified: "${modified}"\r\ndateIssued: "${issued}"\r\nbreadcrumbs: # By default the Canada.ca crumbs is already set\r\n${crumbsYaml || "  []"}\r\nfeedbackData:\r\n  section: "${title}"\r\nsourceUrl:\r\n  - title: "${title}"\r\n    link: "${url}"\r\n---\r\n\r\n${pageContent}`;

    return frontMatter;
  }

  private createConfigYaml(owner: string, repo: string): string {
    return `---
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
exitByURL: false
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
        - /${repo}/source/css/testing-banner.css
      script:
        - https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/m%C3%A9li-m%C3%A9lo/2025-12-mille-iles.js
        - /${repo}/source/scripts/external-link-detour.js
        `
  }

  private filesToCopy = [
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/_includes/header/header.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/_includes/resources-inc/footer.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/includes/site-banner-e.inc",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/css/testing-banner.css",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/exit-intent-e.html",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/scripts/git-dev-options-e.js",
    "https://raw.githubusercontent.com/cra-design/core-prototype/main/source/scripts/external-link-detour.js",
  ];

  // Check with Andrew about these files - they may not all be needed and copying raw files is slightly simpler than using the API (API lets us grab folders though which is handy if filenames change)
  private filesToCopy2 = [
    "https://api.github.com/repos/cra-design/core-prototype/.github",
    "https://api.github.com/repos/cra-design/core-prototype/_includes",
    "https://api.github.com/repos/cra-design/core-prototype/resources",
    "https://api.github.com/repos/cra-design/core-prototype/source/css",
    "https://api.github.com/repos/cra-design/core-prototype/source/includes",
    "https://api.github.com/repos/cra-design/core-prototype/source/scripts",
    "https://api.github.com/repos/cra-design/core-prototype/source/exit-intent-e.html",
    "https://api.github.com/repos/cra-design/core-prototype/.editorconfig",
    "https://api.github.com/repos/cra-design/core-prototype/.gitignore",
    "https://api.github.com/repos/cra-design/core-prototype/404.html",
    "https://api.github.com/repos/cra-design/core-prototype/gemfile",
  ];


  private async copyCoreFiles(owner: string, repo: string, branch: string, token: string) {
    for (const file of this.filesToCopy) {
      try {
        const urlParts = new URL(file).pathname.split("/");
        const destPath = urlParts.slice(4).join("/"); // everything after /main/

        console.log(`Copying ${file} → ${destPath}`);

        // 1. Fetch file content from source repo   
        const response = await this.fetchService.fetchWithRetry(file, "GET");
        if (!response.ok) throw new Error(`Failed to fetch: ${file}`);
        const content = await response.text();

        // 2. Upload to destination repo
        await this.exportToGitHub(owner, repo, branch, destPath, destPath.split("/").pop() || destPath, content, token, true, true);

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

    return response.json();
  }

  //Set up README.md
  async createInitialReadme(owner: string, repo: string, branch: string, token: string) {
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
      await this.exportToGitHub(owner, repo, branch, filename, filename, content, token, true);
      console.log(`Initial README.md created for ${repo}`);
    } catch (error) {
      console.error(`Failed to create README.md for ${repo}:`, error);
    }
  }

  public async setupRepo(owner: string, repo: string, branch: string, token: string) {
    const exists = await this.repoExists(owner, repo);

    if (!exists) {
      console.log(`Repo ${owner}/${repo} not found. Creating...`);
      await this.createRepo(owner, repo, branch, token);
      console.log("Repo created.");
      await this.enablePages(owner, repo, branch, token);
      console.log("GitHub Pages enabled on main branch.");
      await this.createInitialReadme(owner, repo, branch, token);
      console.log("Initial README.md created.");
    } else {
      console.log(`Repo ${owner}/${repo} already exists. Skipping creation.`);
    }

    // Now push files
    await this.copyCoreFiles(owner, repo, branch, token);
    const config = this.createConfigYaml(owner, repo);
    await this.exportToGitHub(owner, repo, branch, "_config.yml", "_config.yml", config, token, true);

  }

  private b64EncodeUnicode(str: string): string {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = "";
    utf8Bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  async exportToGitHub(owner: string, repo: string, branch: string, path: string, filename: string, content: string, token: string, overwrite = false, copyFromCore = false) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Check if file exists to get the SHA for updating if overwrite is true (otherwise it will throw an error for existing files)
    let sha: string | undefined;
    if (overwrite) {
      const check = await fetch(url, {
        headers: { "Authorization": `token ${token}` }
      });

      if (check.ok) {
        const data = await check.json();
        sha = data.sha; // needed for overwrite
      }
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

