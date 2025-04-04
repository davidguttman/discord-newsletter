# Discord Newsletter Migration TODO

## Message Fixtures Collection
To collect fixtures, set `COLLECT_FIXTURES=1` in your environment. Messages will be saved to `test/fixtures/discord-messages-{timestamp}.json`.

### Basic Messages
- [x] Plain text message
- [x] Message with user mention (@user)
- [x] Message with role mention (@role)
- [x] Message with channel mention (#channel)
- [x] Message with custom emoji
- [x] Message with standard emoji
- [x] Message with markdown (bold, italic, code blocks)
- [x] Message with multiple paragraphs
- [x] Message with URLs

### Reply Messages
- [x] Reply without mentioning the original author
- [x] Reply with mentioning the original author
- [x] Reply to a bot message
- [x] Reply to a message in a thread
- [x] Reply to a message that includes an attachment
- [x] Reply to a message that was edited

### Thread Messages
- [x] Thread starter message
- [x] Regular message in thread
- [ ] Message that mentions the thread starter
- [ ] Message that references another thread
- [ ] Message in an archived thread

### Attachments
- [ ] Single image attachment
- [ ] Multiple image attachments
- [ ] PDF file attachment
- [ ] Text file attachment
- [ ] Mixed attachments (image + file)
- [ ] Message with both attachments and text
- [ ] Message with only attachments (no text)

### Embeds
- [x] Message with link preview (from david.app URL)
- [ ] Message with YouTube video
- [ ] Message with Twitter/social media preview
- [ ] Message with rich embed (title, description, fields)
- [ ] Message with multiple embeds
- [ ] Message with failed/invalid embed

### Edge Cases
- [x] Empty message (just attachments) - we have one in the thread
- [ ] Very long message (near Discord limit)
- [ ] Message with only whitespace/newlines
- [ ] Message with unusual Unicode characters
- [x] Edited message
- [ ] Message from a user who left the server
- [x] Message that was edited multiple times
- [ ] Message with maximum number of attachments
- [ ] Message with maximum number of embeds
- [ ] Message with maximum number of mentions

## Core Functionality
- [x] Migrate Discord integration
  - [x] Move `lib/discord` to new structure
  - [x] Update Discord client initialization
  - [x] Verify Discord setup (removed unnecessary tests)
  - [ ] Refactor Discord library to separate concerns
    - [ ] Remove database operations from Discord library
    - [ ] Create a service layer to handle message processing
    - [ ] Update Discord library to emit events instead of saving directly

- [x] Database Setup
  - [x] Create MongoDB models for messages
  - [x] Migrate database connection code
  - [x] Test database connection
  - [x] Fix MongoDB connection in test environment
  - [x] Fix embeds schema validation
  - [x] Ensure proper database cleanup in tests

- [x] API Routes
  - [x] Create health check endpoint using healthpoint
  - [x] Set up message archiving endpoints
  - [x] Test API endpoints
  - [x] Fix health check database integration
  - [x] Remove widgets API (not needed)

- [ ] Scripts
  - [ ] Migrate archive-messages script
  - [ ] Test archive functionality

- [x] Testing
  - [x] Migrate existing tests
  - [x] Add new tests for migrated code
  - [x] Ensure all tests pass
  - [x] Fix failing tests:
    - [x] Health check tests
    - [x] Message model tests
    - [x] MongoDB connection tests

## Code Quality
- [x] Fix standard.js linting issues:
  - [x] Remove unused `authMiddleware` in `api/widgets.js`
  - [x] Remove unused `mockClient` in `lib/discord/discord-test.js`
  - [x] Remove unused `config` in `lib/discord/discord.js`
  - [x] Remove unused `mongoose` in `lib/discord/discord.js`
  - [x] Remove unused `config` in `middleware/auth-test.js`
  - [x] Remove unused `mongoose` in `test/api/widgets.test.js`
  - [x] Remove unused `config` in `test/api/widgets.test.js`
  - [x] Remove unused `config` in `test/auth.test.js`

## Environment
- [ ] Verify all environment variables are properly configured
- [ ] Test with production and development settings
- [ ] Ensure test environment is properly isolated

## Documentation
- [ ] Update README with new setup instructions
- [ ] Document any changes in functionality 