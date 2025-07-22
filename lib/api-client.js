class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.defaultOptions = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async request(url, options = {}) {
    const fullUrl = `${this.baseUrl}${url}`
    const requestOptions = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.defaultOptions.headers,
        ...(options.headers || {})
      }
    }

    let lastError
    const maxRetries = 5
    const baseDelay = 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(fullUrl, requestOptions)
        
        if (!response.ok) {
          const errorText = await response.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          
          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
          }
          
          // Retry on server errors (5xx) and rate limits (429)
          if (attempt === maxRetries) {
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
          }
          
          lastError = new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
        } else {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            return await response.json()
          } else {
            return await response.text()
          }
        }
      } catch (error) {
        lastError = error
        
        // Don't retry on non-network errors unless they're server errors
        if (!error.message.includes('fetch') && !error.message.includes('HTTP 5')) {
          if (attempt === maxRetries) {
            throw error
          }
        }
      }

      // Wait before retrying with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
        console.log(`API request failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`)
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  // Convenience methods
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' })
  }

  // Discord Newsletter specific methods
  async getGuilds() {
    return this.get('/guilds')
  }

  async getChannels(guildId) {
    return this.get(`/guilds/${guildId}/channels`)
  }

  async getMessages(guildId, channelId, params = {}) {
    const searchParams = new URLSearchParams(params)
    return this.get(`/messages?guildId=${guildId}&channelId=${channelId}&${searchParams}`)
  }

  async getPreview(guildId, channelId, limit = 10) {
    return this.get(`/preview/${guildId}/${channelId}?limit=${limit}`)
  }

  async getSettings() {
    return this.get('/settings')
  }

  async createSettings(guildId, channelId) {
    return this.post('/settings', { guildId, channelId })
  }

  async deleteSettings(settingsId) {
    return this.delete(`/settings/${settingsId}`)
  }

  async getHealth() {
    return this.get('/health')
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient
} else if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient
}