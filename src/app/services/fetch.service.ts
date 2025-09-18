import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FetchService {

  //Block unknown hosts
  private prodHost = "www.canada.ca";
  private protoHosts = new Set([
    "cra-design.github.io",
    //"cra-proto.github.io", //Currently blocked by browser because it looks like a phishing site
    //"gc-proto.github.io", //CORS error but redirects to test.canada.ca which works
    "test.canada.ca",
  ]);
  private getAllowedHosts(mode: "prod" | "proto" | "both"): Set<string> {
    const allowed = new Set<string>();
    if (mode === "prod" || mode === "both") allowed.add(this.prodHost);
    if (mode === "proto" || mode === "both") this.protoHosts.forEach(host => allowed.add(host));
    return allowed;
  }

  private validateHost(
    url: string,
    hostMode: "prod" | "proto" | "both"
  ): string {
    url = url.trim().toLowerCase();

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    const allowedHosts = this.getAllowedHosts(hostMode);
    if (!allowedHosts.has(hostname)) {
      throw new Error(`Blocked host: ${hostname} blocked for url ${url}`);
    }

    return url;
  }

  //Preferably use fetchContent or fetchStatus since they enforce our allowed hosts. Use this as a standalone only if you need to check external content.
  public async fetchWithRetry(
    url: string,
    mode: "GET" | "HEAD" = "HEAD",
    retries = 3,
    delay: number | "random" | "none" = "none"
  ): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.simulateDelay(delay);
      try {
        const response =
          mode === "HEAD"
            ? await fetch(url, { method: "HEAD", cache: "no-store" })
            : await fetch(url); // plain GET to avoid CORS error
        if (response.ok) return response;
        else {
          console.warn(`Fetch attempt #${attempt}. Status: ${response.status}. Method: ${mode}`);
          if (attempt === retries) throw new Error(`Fetch failed ${attempt} times. Method: ${mode}. Status: ${response.status} for ${url}`);
          await this.delay(50); //50ms delay before retry
        }
      } catch (error) {
        if (attempt === retries) throw new Error((error as Error).message);
      }
    }
    throw new Error(`Unexpected error for ${url}`); //fallback, could be CORS or URLs blocked for safety reasons (suspected phishing etc.)
  }

  public async fetchContent(
    url: string,
    hostMode: "prod" | "proto" | "both" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none"
  ): Promise<Document> {
    url = this.validateHost(url, hostMode);
    const response = await this.fetchWithRetry(url, "GET", retries, delay);
    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  public async fetchStatus(
    url: string,
    hostMode: "prod" | "proto" | "both" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none"
  ): Promise<Response> {
    url = this.validateHost(url, hostMode);
    return this.fetchWithRetry(url, "HEAD", retries, delay);
  }

  //only delays on development build
  public async simulateDelay(delay: number | 'random' | 'none' = 'none'): Promise<void> {
    if (environment.production || delay === 'none') return;

    if (delay === "random") {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 1500)); //random 0.1 to 1.6 second delay
    }
    else if (typeof delay === "number" && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
    }
  }

  //adds delay on both dev and prod (useful for adding short delays before retrying a failed fetch, only use this if the delay is required on prod)
  public async delay(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
  }

}
