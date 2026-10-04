import { CONFIG } from "../config";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
}

export class SearchTool {
  /**
   * Search the live web using real providers with fallback
   */
  static async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    if (!query || !query.trim()) return [];

    const cleanedQuery = query.trim();

    // 1. Check if external Search API Key is provided
    if (CONFIG.SEARCH_API_KEY) {
      try {
        const serperResults = await this.searchSerper(cleanedQuery, maxResults);
        if (serperResults.length > 0) return serperResults;
      } catch (e) {
        console.warn("Serper search failed, trying fallback:", e);
      }
    }

    // 2. Query Live DuckDuckGo search for real-world web URLs and snippets
    try {
      const ddgResults = await this.searchDuckDuckGo(cleanedQuery, maxResults);
      if (ddgResults.length > 0) return ddgResults;
    } catch (e) {
      console.warn("DuckDuckGo search failed:", e);
    }

    // 3. Query Wikipedia API for encyclopedic and scientific entities
    try {
      const wikiResults = await this.searchWikipedia(cleanedQuery, maxResults);
      if (wikiResults.length > 0) return wikiResults;
    } catch (e) {
      console.warn("Wikipedia search fallback failed:", e);
    }

    return [];
  }

  /**
   * Serper / Google API integration
   */
  private static async searchSerper(query: string, maxResults: number): Promise<SearchResult[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": CONFIG.SEARCH_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });

    if (!res.ok) throw new Error(`Serper API returned ${res.status}`);
    const data = await res.json();
    const results: SearchResult[] = [];

    if (data.organic && Array.isArray(data.organic)) {
      for (const item of data.organic.slice(0, maxResults)) {
        if (item.link && item.title) {
          results.push({
            title: item.title,
            url: item.link,
            snippet: item.snippet || "",
            sourceName: new URL(item.link).hostname.replace("www.", ""),
          });
        }
      }
    }
    return results;
  }

  /**
   * DuckDuckGo search integration (fetching real web snippets & links)
   */
  private static async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BharmashiraAI/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
    const html = await res.text();

    const results: SearchResult[] = [];
    // Extract results from DDG HTML
    // Patterns: <a class="result__url" href="..."> and <a class="result__snippet" ...>
    const linkRegex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
    const titleRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>\s*([^\s<]+)/g;

    // Alternative robust parser for DuckDuckGo HTML result blocks
    const resultBlocks = html.split('<div class="result results_links');
    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];
      const titleMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>(.*?)<\/a>/);

      if (titleMatch && titleMatch[1]) {
        let rawUrl = titleMatch[1];
        // DDG redirects /l/?kh=-1&uddg=https%3A%2F%2Fexample.com
        if (rawUrl.includes("uddg=")) {
          const params = new URLSearchParams(rawUrl.substring(rawUrl.indexOf("?")));
          const uddg = params.get("uddg");
          if (uddg) rawUrl = decodeURIComponent(uddg);
        }

        const cleanTitle = titleMatch[2].replace(/<[^>]+>/g, "").trim();
        const cleanSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";

        if (rawUrl.startsWith("http") && cleanTitle) {
          try {
            const hostname = new URL(rawUrl).hostname.replace("www.", "");
            results.push({
              title: cleanTitle,
              url: rawUrl,
              snippet: cleanSnippet,
              sourceName: hostname,
            });
          } catch {
            // ignore malformed URL
          }
        }
      }
    }

    return results;
  }

  /**
   * Search Wikipedia for factual/scientific summaries
   */
  private static async searchWikipedia(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BharmashiraAI/1.0" },
    });

    if (!res.ok) return [];
    const data = await res.json();
    // Format: [query, [titles], [descriptions], [urls]]
    const titles = data[1] || [];
    const descriptions = data[2] || [];
    const urls = data[3] || [];

    const results: SearchResult[] = [];
    for (let i = 0; i < titles.length; i++) {
      if (urls[i] && titles[i]) {
        results.push({
          title: titles[i],
          url: urls[i],
          snippet: descriptions[i] || `Information about ${titles[i]} on Wikipedia.`,
          sourceName: "en.wikipedia.org",
        });
      }
    }
    return results;
  }

  /**
   * Fetch page content snippet with size and timeout guards
   */
  static async fetchPageContent(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BharmashiraAI/1.0",
          "Accept": "text/html,application/xhtml+xml,text/plain",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return "";
      const text = await res.text();
      
      // Strip scripts, styles, html tags, excessive whitespace
      const cleaned = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Cap at 4000 characters per source for dense context efficiency
      return cleaned.slice(0, 4000);
    } catch {
      return "";
    }
  }
}
