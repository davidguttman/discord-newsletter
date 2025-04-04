# Discord Newsletter Migration TODO

## Core Functionality
- [x] Migrate Discord integration
  - [x] Move `lib/discord` to new structure
  - [x] Update Discord client initialization
  - [ ] Test Discord connection
  - [ ] Refactor Discord library to separate concerns
    - [ ] Remove database operations from Discord library
    - [ ] Create a service layer to handle message processing
    - [ ] Update Discord library to emit events instead of saving directly

- [x] Database Setup
  - [x] Create MongoDB models for messages
  - [x] Migrate database connection code
  - [x] Test database connection
  - [ ] Fix MongoDB connection in test environment
  - [ ] Fix embeds schema validation
  - [ ] Ensure proper database cleanup in tests

- [x] API Routes
  - [x] Create health check endpoint using healthpoint
  - [x] Set up message archiving endpoints
  - [x] Test API endpoints
  - [ ] Fix health check database integration
  - [ ] Fix widgets API 500 errors
  - [ ] Add proper error handling for widgets API

- [ ] Scripts
  - [ ] Migrate archive-messages script
  - [ ] Test archive functionality

- [x] Testing
  - [x] Migrate existing tests
  - [x] Add new tests for migrated code
  - [x] Ensure all tests pass
  - [ ] Fix failing tests:
    - [ ] Health check tests
    - [ ] Widgets API tests
    - [ ] Message model tests
    - [ ] MongoDB connection tests

## Environment
- [ ] Verify all environment variables are properly configured
- [ ] Test with production and development settings
- [ ] Ensure test environment is properly isolated

## Documentation
- [ ] Update README with new setup instructions
- [ ] Document any changes in functionality 