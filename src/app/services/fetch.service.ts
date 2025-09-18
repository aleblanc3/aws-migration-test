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

  public async fetchContent(
    url: string,
    hostMode: "prod" | "proto" | "both" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none"
  ): Promise<Document> {

    //normalize URL & check if valid
    url = url.trim().toLowerCase();
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    //Check allowed host list
    const allowedHosts = this.getAllowedHosts(hostMode);
    if (!allowedHosts.has(hostname)) {
      throw new Error(`Blocked host: ${hostname} blocked for url ${url}`);
    }

    // Attempt fetch with retries & return document or error
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.simulateDelay(delay);

      try {
        const response = await fetch(url);
        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          return parser.parseFromString(html, "text/html");
        } else {
          console.warn(`Fetch attempt #${attempt} status: ${response.status}`);
          if (attempt === retries) throw new Error(`Fetch failed ${attempt} times. Status: ${response.status} for ${url}`);
          await this.delay(50); //50ms delay before retry
        }
      } catch (error) {
        if (attempt === retries) throw new Error(`${(error as Error).message}`);
      }
    }
    throw new Error(`Unexpected error for ${url}`); //fallback, could be CORS or URLs blocked for safety reasons (suspected phishing etc.)
  }

  public async simulateDelay(delay: number | 'random' | 'none' = 'none'): Promise<void> {
    if (environment.production || delay === 'none') return;

    if (delay === "random") {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 1500)); //random 0.1 to 1.6 second delay
    }
    else if (typeof delay === "number" && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
    }
  }

  public async delay(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
  }

  public fetchStatus() {


  }

}
