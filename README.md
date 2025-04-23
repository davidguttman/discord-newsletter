# Discord Newsletter 📰

Fetches messages from Discord channels, summarizes them using AI, and emails the summary.

## Features ✨

- **Express Server**: Fast and minimalist web framework
- **MongoDB Integration**: With Mongoose ORM and in-memory testing
- **Discord Integration**: Connects to Discord API to fetch messages
- **OpenAI Integration**: Uses OpenAI API for message summarization
- **Mailgun Integration**: Sends email summaries via Mailgun API
- **Authentication**: Built-in auth middleware with test environment support
- **Testing**: Comprehensive test setup with tape and supertest
- **Error Handling**: Automatic error catching and formatting
- **Health Checks**: Built-in monitoring endpoint
- **Environment Config**: Easy configuration with dotenv
- **API Endpoints**: Fetch messages, trigger summarization, and email summaries
- **Message Tagging**: Categorize and filter messages with custom tags (see [docs/tags-feature.md](docs/tags-feature.md))
- **Custom Email Templates**: Multiple email layouts for different use cases

## Quick Start 🚀

1. Clone and install:

```bash
git clone https://github.com/davidguttman/discord-newsletter.git
cd discord-newsletter
npm install
```

2. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=discord-newsletter # Or your preferred DB name
GOOGLE_PROJECT_ID=your-project-id # Optional for production logging
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json # Optional for production logging
AUTHENTIC_SERVER=your-authentic-server # Optional for authentication
WHITELIST=email1@example.com,email2@example.com # Optional for authentication

# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini # Or your preferred model
OPENAI_MAX_TOKENS=10000 # Optional

# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_FROM="Discord Newsletter <newsletter@yourdomain.com>" # Customize sender
MAILGUN_TO=recipient@example.com # Default recipient
```

_Make sure to replace placeholders like `<YOUR_REPOSITORY_URL>`, `your_discord_bot_token`, etc. with your actual values._

4. Start developing:

```bash
npm run dev
```

## Development 💻

The development server will restart on file changes:

```bash
npm run dev
```

It also starts the Discord bot connection.

## Testing 🧪

Run the test suite:

```bash
npm test
```

Features:

- Tape for lightweight testing
- Supertest for HTTP assertions
- In-memory MongoDB for database tests
- Predictable test authentication
- Mock Discord client for testing

## Production 🌎

1. Set your production environment variables
2. Start the server:

```bash
npm start
```

## Project Structure 📁

```
.
├── api/              # API route handlers
├── config/           # Configuration loader (config/index.js, .env*)
├── lib/              # Shared libraries (Discord, Mongo, OpenAI, Mailgun)
├── middleware/       # Express middleware (e.g., authentication)
├── models/           # Mongoose models (e.g., Message)
├── routes/           # Express route definitions (deprecated, see api/)
├── scripts/          # Utility scripts
├── test/             # Test files and helpers
├── .env.example      # Example environment variables
├── package.json      # Project configuration
└── server.js         # Application entry point
```

_(Note: The `routes/` directory might be deprecated or unused in favor of `api/`)_

## API Endpoints 🛣️

- `GET /health` - Health check (includes MongoDB connection status)
- `GET /messages` - Fetch and store messages from the configured Discord channel
- `POST /summarize` - Generate a summary of stored messages using OpenAI
- `POST /email-summary` - Send the generated summary via email using Mailgun
- `GET /tags` - Get all available tags
- `POST /message-tags/:messageId/tags/:tagId` - Add a tag to a message
- `GET /summarize/channel/:channelId?tags=id1,id2` - Generate filtered summaries by tag

_(Authentication might be required for some endpoints depending on the setup)_

## Code Style 📝

This project follows standard.js style:

- No semicolons
- 2 spaces
- Single quotes
- No var
- Arrow functions
- Object shorthand
- No classes

## Contributing 🤝

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License 📄

MIT © [David Guttman](http://davidguttman.com/)
