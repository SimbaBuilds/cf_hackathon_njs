declare module 'duckduckgo-search' {
  export class DDGS {
    text(query: string, options?: { maxResults?: number }): Promise<Array<{ snippet: string }>>;
  }
} 