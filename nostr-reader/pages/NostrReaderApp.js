import React, { useState, useEffect } from "react";
import { SimplePool } from "nostr-tools";
import { getEventHash } from "nostr-tools";
import { getSignature } from "nostr-tools";
import { getPublicKey } from "nostr-tools";
import { finalizeEvent, verifyEvent } from "nostr-tools/pure";
import * as secp256k1 from "@noble/secp256k1";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Loader2 } from "lucide-react";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

const generatePrivateKey = () => {
  return secp256k1.etc.bytesToHex(secp256k1.utils.randomPrivateKey());
};

const derivePublicKey = (privateKey) => {
  return getPublicKey(privateKey);
};

const NostrReaderApp = () => {
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [archives, setArchives] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [pool, setPool] = useState(null);
  const [articleMeta, setArticleMeta] = useState(null);

  useEffect(() => {
    initializeNostr();
    return () => {
      if (pool) {
        pool.close();
      }
    };
  }, []);

  const initializeNostr = async () => {
    try {
      console.log("Starting Nostr initialization...");

      // Generate keys using nostr-tools functions
      const privKey = generatePrivateKey();
      console.log("Private key generated");

      const pubKey = derivePublicKey(privKey);
      console.log("Public key generated");

      setPrivateKey(privKey);
      setPublicKey(pubKey);

      // Create new pool
      const newPool = new SimplePool();
      console.log("Pool created");

      // Connect to relays
      let connected = false;
      for (const relay of RELAYS) {
        try {
          console.log(`Attempting to connect to ${relay}...`);
          await newPool.ensureRelay(relay);
          console.log(`Successfully connected to ${relay}`);
          connected = true;
        } catch (err) {
          console.warn(`Failed to connect to ${relay}:`, err);
        }
      }

      if (!connected) {
        throw new Error("Could not connect to any relays");
      }

      setPool(newPool);
      setError(""); // Clear any previous errors
    } catch (err) {
      console.error("Detailed initialization error:", err);
      setError("Failed to initialize Nostr connection: " + err.message);
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
    if (!pool) {
      setError("Nostr connection not initialized");
      return;
    }

    try {
      const filter = {
        kinds: [9803],
        "#r": [urlToFetch],
      };

      // Use the querySync method to retrieve multiple events
      const events = await pool.querySync(RELAYS, filter);

      const sortedEvents = events
        .map((event) => ({
          timestamp: event.created_at * 1000,
          content: event.content,
          id: event.id,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      setArchives(sortedEvents);
    } catch (err) {
      console.error("Failed to fetch archives:", err);
      setError("Failed to fetch archives: " + err.message);
    }
  };

  const createArchive = async () => {
    if (!pool) {
      setError("Nostr connection not initialized");
      return;
    }

    try {
      // Create the event object
      const event = {
        kind: 9803,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["r", url]], // Ensure the URL is correctly set
        content: content,
      };

      // Sign the event using finalizeEvent
      const signedEvent = finalizeEvent(event, privateKey);

      // Verify the event (optional, but good for debugging)
      const isGood = verifyEvent(signedEvent);
      if (!isGood) {
        throw new Error("Event verification failed");
      }

      // Publish to all relays
      const pubs = pool.publish(RELAYS, signedEvent); // Use the signed event

      // Wait for at least one successful publish
      try {
        await Promise.any(pubs);

        // Add to local archives
        setArchives((prev) => [
          {
            timestamp: signedEvent.created_at * 1000,
            content: signedEvent.content,
            id: signedEvent.id,
          },
          ...prev,
        ]);

        setError(""); // Clear any previous errors
      } catch (err) {
        throw new Error("Failed to publish to any relay");
      }
    } catch (err) {
      console.error("Archive creation error:", err);
      setError("Failed to create archive: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">
            Chronicl - Decentralized Internet Archive
          </h1>

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
                disabled={!content || !pool}
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
