# Chronicl

## Overview

**Chronicl** is a web application that enables users to archive content from URLs using the decentralized Nostr protocol. By connecting to various Nostr relays, users can create and manage archives that are stored in a distributed manner, ensuring resilience and accessibility.
## Key Feature: Decentralized Archiving

### What is Decentralized Archiving?

Decentralized archiving refers to the ability to store and manage content in a distributed network rather than relying on a single centralized server. Chronicl leverages the Nostr protocol to facilitate this functionality, allowing users to publish their notes and archives to multiple relays. This ensures that the archived content is not dependent on a single entity, providing greater security and redundancy.

### How It Works

1. **Generate Keys**: Users generate cryptographic keys (private and public) upon initializing the app.
2. **Connect to Relays**: The application connects to multiple Nostr relays to ensure reliable communication and data storage.
3. **Archive Creation**: Users can archive content by submitting URLs. The application packages the content into an event and signs it using the user's private key.
4. **Publish Events**: The signed events are published to the connected Nostr relays, making them available across the decentralized network.
5. **Retrieve Archives**: Users can view their previous archives, which are fetched from the relays, showing only the latest entry for each day to keep the interface clean and manageable.

## Features

- **User-Friendly Interface**: Intuitive UI for fetching, archiving, and viewing content.
- **Real-Time Updates**: Connects to multiple Nostr relays to ensure up-to-date content and archives.
- **Efficient Archive Management**: Only the latest archive for each day is displayed, reducing clutter and enhancing readability.
- **Error Handling**: Provides clear error messages to improve user experience.

## Technologies Used

- **Frontend**: React, JavaScript, CSS
- **Backend**: Nostr protocol (via `nostr-tools`), WebSockets for real-time data fetching
- **Deployment**: This app can be deployed on any static hosting service (e.g., Vercel, Netlify).

## Installation

To run the Chronicl locally, follow these steps:

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/yourusername/nostr-reader.git
   cd nostr-reader```

2. **Install Dependencies**:

    Install Dependencies:

    Ensure you have Node.js installed. Then run:
     ```bash
     npm install```

3. **Run the Application:**:

    Start the development server:

    ```bash
    npm start```

    The app will be available at http://localhost:3000.
