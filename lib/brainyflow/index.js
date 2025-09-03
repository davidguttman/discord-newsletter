// BrainyFlow integration for Discord Newsletter
// This module provides the main integration point for BrainyFlow-based summarization

// Environment-aware export pattern following the existing codebase structure
module.exports = process.env.NODE_ENV === 'test'
  ? require('./brainyflow-test')
  : require('./brainyflow')
