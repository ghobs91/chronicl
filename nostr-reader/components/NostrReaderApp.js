import React, { useState, useEffect } from "react";
import {
  generatePrivateKey,
  getPublicKey,
  getEventHash,
  signEvent,
} from "nostr-tools";
import { RelayPool } from "nostr-tools";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert } from "./ui/alert";
import { Loader2 } from "lucide-react";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

const NostrReaderApp = () => {
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [relayPool, setRelayPool] = useState(null);
  const [articleMeta, setArticleMeta] = useState(null);

  useEffect(() => {
    initializeNostr();
    return () => {
      if (relayPool) {
        relayPool.close();
      }
    };
  }, []);

  const initializeNostr = async () => {
    try {
      const privKey = generatePrivateKey();
      const pubKey = getPublicKey(privKey);
      setPrivateKey(privKey);
      setPublicKey(pubKey);

      const pool = new RelayPool(RELAYS);
      await Promise.all(
        RELAYS.map(
          (relay) =>
            new Promise((resolve, reject) => {
              pool.on("connect", (relay) => resolve());
              pool.on("error", (relay) => reject());
            }),
        ),
      );
      setRelayPool(pool);
    } catch (err) {
      setError("Failed to initialize Nostr connection");
    }
  };

  const fetchAndParseContent = async (urlToFetch) => {
    setLoading(true);
    setError("");
    setArticleMeta(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: urlToFetch }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch content");
      }

      setContent(data.content);
      setArticleMeta({
        title: data.title,
        byline: data.byline,
        siteName: data.siteName,
        excerpt: data.excerpt,
      });

      await fetchNostrArchives(urlToFetch);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNostrArchives = async (urlToFetch) => {
    try {
      const filter = {
        kinds: [9802],
        "#r": [urlToFetch],
      };

      const events = [];
      const sub = relayPool.sub([filter]);

      return new Promise((resolve, reject) => {
        sub.on("event", (event) => {
          events.push({
            timestamp: event.created_at * 1000,
            content: event.content,
            id: event.id,
          });
        });

        sub.on("eose", () => {
          const sortedEvents = events.sort((a, b) => b.timestamp - a.timestamp);
          setArchives(sortedEvents);
          resolve();
        });

        setTimeout(() => {
          sub.unsub();
          resolve();
        }, 3000);
      });
    } catch (err) {
      setError("Failed to fetch archives");
    }
  };

  const createArchive = async () => {
    try {
      const event = {
        kind: 9802,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["r", url]],
        content: content,
        pubkey: publicKey,
      };

      event.id = getEventHash(event);
      event.sig = signEvent(event, privateKey);

      await Promise.all(
        RELAYS.map(
          (relay) =>
            new Promise((resolve, reject) => {
              relayPool.publish(event, relay);
              resolve();
            }),
        ),
      );

      setArchives([
        {
          timestamp: event.created_at * 1000,
          content: event.content,
          id: event.id,
        },
        ...archives,
      ]);
    } catch (err) {
      setError("Failed to create archive");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Nostr Reader</h1>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Enter URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => fetchAndParseContent(url)}
                disabled={loading || !url}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Read"
                )}
              </Button>
              <Button
                onClick={createArchive}
                disabled={!content || !relayPool}
                variant="secondary"
              >
                Archive
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <p>{error}</p>
              </Alert>
            )}

            {archives.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <div className="w-full text-sm text-gray-600 mb-2">
                  Previous archives:
                </div>
                {archives.map((archive) => (
                  <Button
                    key={archive.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedArchive(archive)}
                  >
                    {new Date(archive.timestamp).toLocaleDateString()}
                  </Button>
                ))}
              </div>
            )}

            {(content || selectedArchive) && (
              <div className="mt-6 bg-white rounded-lg shadow-sm">
                <div className="p-6">
                  {articleMeta && !selectedArchive && (
                    <div className="mb-6 border-b pb-4">
                      <h1 className="text-2xl font-bold mb-2">
                        {articleMeta.title}
                      </h1>
                      {articleMeta.byline && (
                        <p className="text-sm text-gray-600 mb-1">
                          {articleMeta.byline}
                        </p>
                      )}
                      {articleMeta.siteName && (
                        <p className="text-sm text-gray-600 mb-2">
                          {articleMeta.siteName}
                        </p>
                      )}
                      {articleMeta.excerpt && (
                        <p className="text-sm text-gray-600 italic">
                          {articleMeta.excerpt}
                        </p>
                      )}
                    </div>
                  )}
                  <div
                    className="prose lg:prose-xl max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: selectedArchive
                        ? selectedArchive.content
                        : content,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NostrReaderApp;
