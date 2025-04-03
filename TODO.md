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
  - [ ] Test database connection

- [x] API Routes
  - [x] Create health check endpoint using healthpoint
  - [x] Set up message archiving endpoints
  - [ ] Test API endpoints

- [ ] Scripts
  - [ ] Migrate archive-messages script
  - [ ] Test archive functionality

- [ ] Testing
  - [ ] Migrate existing tests
  - [ ] Add new tests for migrated code
  - [ ] Ensure all tests pass

## Environment
- [ ] Verify all environment variables are properly configured
- [ ] Test with production and development settings

## Documentation
- [ ] Update README with new setup instructions
- [ ] Document any changes in functionality 