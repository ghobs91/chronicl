// pages/api/parse.js
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Fetch the content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Chronicl/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();

    // Create a DOM we can work with
    const dom = new JSDOM(html, {
      url: url,
      features: {
        FetchExternalResources: false,
        ProcessExternalResources: false,
      },
    });

    // Parse the article
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error("Failed to parse article content");
    }

    // Create a new DOM for sanitization
    const cleanDom = new JSDOM("");
    const purify = DOMPurify(cleanDom.window);

    // Sanitize the content
    let sanitizedContent = purify.sanitize(article.content, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "b",
        "i",
        "strong",
        "em",
        "strike",
        "code",
        "pre",
        "img",
        "figure",
        "figcaption",
        "article",
        "section",
        "div",
        "span",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id"],
      ALLOW_DATA_ATTR: false,
    });

    // Create a DOM to handle URL transformations
    const transformDom = new JSDOM(sanitizedContent, {
      url: url,
    });
    const transformDoc = transformDom.window.document;

    // Transform relative URLs to absolute
    transformDoc.querySelectorAll("img").forEach((img) => {
      if (img.src) {
        try {
          img.src = new URL(img.src, url).href;
        } catch (e) {
          // If URL parsing fails, remove the src attribute
          img.removeAttribute("src");
        }
      }
    });

    transformDoc.querySelectorAll("a").forEach((link) => {
      if (link.href) {
        try {
          link.href = new URL(link.href, url).href;
        } catch (e) {
          // If URL parsing fails, remove the href attribute
          link.removeAttribute("href");
        }
      }
    });

    // Get the transformed content
    sanitizedContent = transformDoc.body.innerHTML;

    return res.status(200).json({
      title: article.title,
      content: sanitizedContent,
      byline: article.byline,
      siteName: article.siteName,
      excerpt: article.excerpt,
      length: article.length,
      url: url,
    });
  } catch (error) {
    console.error("Error parsing URL:", error);
    return res.status(500).json({
      error: "Failed to parse URL content",
      details: error.message,
    });
  }
}
