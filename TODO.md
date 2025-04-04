# Discord Newsletter Migration TODO

## Core Functionality
- [x] Migrate Discord integration
  - [x] Move `lib/discord` to new structure
  - [x] Update Discord client initialization
  - [x] Test Discord connection
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
  - [x] Fix widgets API 500 errors
  - [x] Add proper error handling for widgets API

- [ ] Scripts
  - [ ] Migrate archive-messages script
  - [ ] Test archive functionality

- [x] Testing
  - [x] Migrate existing tests
  - [x] Add new tests for migrated code
  - [x] Ensure all tests pass
  - [x] Fix failing tests:
    - [x] Health check tests
    - [x] Widgets API tests
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