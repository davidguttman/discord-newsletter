# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev                    # Start development server with auto-reload and Discord client
npm start                      # Start production server

# Testing
npm test                       # Run all tests with linting (standard --fix + tape tests)
node test/index.js            # Run tests without linting
node test/index.js test/specific-test.test.js  # Run specific test file

# Scripts
npm run archive                # Run archive-messages script
./scripts/archive-messages.js  # Direct script execution
./scripts/send-daily-summary.js # Send daily email summary
./scripts/rate-summary.js      # Rate summary script
```

## Architecture Overview

This is a Discord newsletter service that fetches messages, summarizes them with AI, and sends email summaries. The architecture uses environment-based dependency injection for testing and production flexibility.

### BrainyFlow Integration

The service now supports BrainyFlow for modular, node-based AI processing workflows:
- **Feature Flag**: `USE_BRAINYFLOW=true` enables BrainyFlow (default: false)
- **Backward Compatibility**: Falls back to original OpenAI implementation when disabled
- **Monitoring**: `/brainyflow-status` endpoint provides metrics and health checks

### Core Libraries (`lib/`)
- **Discord**: Environment-aware Discord client (`lib/discord/index.js` switches between real and mock)
- **MongoDB**: Environment-aware database (`lib/mongo/index.js` switches between real and in-memory)
- **OpenAI**: AI summarization service (legacy implementation)
- **BrainyFlow**: Modular AI processing framework (`lib/brainyflow/`)
  - **Nodes**: MessageFetch, TopicExtraction, SummaryGeneration, Formatting, EmailDelivery
  - **Flows**: Simple, Newsletter, and Email processing workflows  
  - **Monitoring**: Execution metrics and health tracking
- **Email**: Mailgun email service
- **Message Formatter**: Converts messages to different output formats (JSON, TXT)
- **Auto Catch**: Express error handling wrapper

### Environment Switching Pattern
The codebase uses a consistent pattern for environment-aware modules:
```javascript
// lib/[service]/index.js
module.exports = process.env.NODE_ENV === 'test'
  ? require('./[service]-test')
  : require('./[service]')
```

### API Structure (`api/`)
- `GET /health` - Health check with MongoDB connection status
- `GET /messages` - Fetch messages with pagination, filtering, and format options
- `POST /summarize` - Generate AI summaries of stored messages (supports BrainyFlow)
- `POST /email-summary` - Send email summaries via Mailgun (supports BrainyFlow)
- `GET /brainyflow-status` - BrainyFlow metrics, health, and configuration
- `POST /brainyflow-status/reset` - Reset BrainyFlow metrics (testing/debugging)

All API routes support both JSON and TXT output formats via `?format=txt` query parameter.

### Database Model
**Message Schema** (`models/message.js`):
- Discord message metadata (id, content, author, channel, guild)
- Thread support (threadId, parentId)
- Reply support (replyToId, mentionsReplyTarget)
- Attachments and embeds arrays
- Indexed on guildId+channelId and createdAt for performance

### Testing Architecture
- **Tape**: Lightweight testing framework
- **In-memory MongoDB**: Via mongodb-memory-server for isolated tests
- **Mock Discord Client**: Simulates Discord API responses
- **Mock Auth**: Bypasses authentication in test environment
- **Fixture Collection**: Set `COLLECT_FIXTURES=1` to save real Discord messages as test fixtures

Tests run sequentially and include automatic cleanup. The test runner supports running specific files or all tests.

### Configuration System
Environment-based configuration in `config/index.js` with defaults and productionize logging:
- MongoDB connection (with test environment using in-memory database)
- Discord bot token and channel configuration
- OpenAI API settings (model, max tokens)
- **BrainyFlow settings** (USE_BRAINYFLOW, timeouts, retry counts, batch sizes)
- Mailgun email configuration
- Authentication server and whitelist

### Authentication
- Production: Uses `authentic-service` for real authentication
- Test: Uses mock authentication that bypasses real auth checks
- Conditional middleware application based on NODE_ENV

### Error Handling
- Global error handler in `server.js` with validation error support
- `auto-catch` wrapper for async route handlers
- Graceful shutdown handling for Discord client connections

## Development Notes

### Adding New Features
1. Create tests first in appropriate `test/` subdirectory
2. Use the environment switching pattern for external services
3. Add mock implementations for test environment
4. Follow the existing async/await error handling patterns

### Message Processing
- Messages are stored with full Discord metadata
- The message formatter handles different output formats
- Thread and reply relationships are preserved in the database
- Attachments and embeds are stored as subdocuments

### Script Development
Scripts in `scripts/` directory are standalone Node.js files that can be executed directly or via npm scripts. They typically interact with the same lib/ modules used by the web service.