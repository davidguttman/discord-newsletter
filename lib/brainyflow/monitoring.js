// BrainyFlow monitoring and metrics collection

const config = require('../../config')

// Metrics collection
const metrics = {
  flowExecutions: 0,
  flowSuccesses: 0,
  flowFailures: 0,
  averageExecutionTime: 0,
  lastExecutionTime: 0,
  nodeExecutions: {},
  errors: []
}

/**
 * Record a flow execution start
 * @param {string} flowType - Type of flow (simple, newsletter, email)
 * @param {Object} options - Flow options
 * @returns {Object} Execution context for timing
 */
function recordFlowStart (flowType, options = {}) {
  metrics.flowExecutions++

  const executionContext = {
    flowType,
    startTime: Date.now(),
    options
  }

  console.log(`📊 BrainyFlow: Starting ${flowType} flow execution #${metrics.flowExecutions}`)

  return executionContext
}

/**
 * Record a flow execution completion
 * @param {Object} executionContext - Context from recordFlowStart
 * @param {boolean} success - Whether the flow succeeded
 * @param {Error} error - Error if flow failed
 */
function recordFlowCompletion (executionContext, success, error = null) {
  const executionTime = Date.now() - executionContext.startTime
  metrics.lastExecutionTime = executionTime

  // Update average execution time
  if (metrics.flowExecutions > 1) {
    metrics.averageExecutionTime = (
      (metrics.averageExecutionTime * (metrics.flowExecutions - 1)) + executionTime
    ) / metrics.flowExecutions
  } else {
    metrics.averageExecutionTime = executionTime
  }

  if (success) {
    metrics.flowSuccesses++
    console.log(`✅ BrainyFlow: ${executionContext.flowType} flow completed successfully in ${executionTime}ms`)
  } else {
    metrics.flowFailures++
    metrics.errors.push({
      flowType: executionContext.flowType,
      error: error?.message || 'Unknown error',
      timestamp: new Date(),
      executionTime
    })
    console.log(`❌ BrainyFlow: ${executionContext.flowType} flow failed in ${executionTime}ms: ${error?.message}`)
  }

  // Keep only the last 10 errors
  if (metrics.errors.length > 10) {
    metrics.errors = metrics.errors.slice(-10)
  }
}

/**
 * Record a node execution
 * @param {string} nodeName - Name of the node
 * @param {number} executionTime - Time taken in milliseconds
 */
function recordNodeExecution (nodeName, executionTime) {
  if (!metrics.nodeExecutions[nodeName]) {
    metrics.nodeExecutions[nodeName] = {
      count: 0,
      totalTime: 0,
      averageTime: 0
    }
  }

  const nodeMetrics = metrics.nodeExecutions[nodeName]
  nodeMetrics.count++
  nodeMetrics.totalTime += executionTime
  nodeMetrics.averageTime = nodeMetrics.totalTime / nodeMetrics.count
}

/**
 * Get current metrics for monitoring dashboard
 * @returns {Object} Current metrics
 */
function getMetrics () {
  const successRate = metrics.flowExecutions > 0
    ? (metrics.flowSuccesses / metrics.flowExecutions * 100).toFixed(2)
    : 0

  return {
    ...metrics,
    successRate: `${successRate}%`,
    configuration: {
      useBrainyFlow: config.useBrainyFlow,
      maxVisits: config.brainyFlowMaxVisits,
      timeout: config.brainyFlowTimeout,
      retryCount: config.brainyFlowRetryCount,
      batchSize: config.brainyFlowBatchSize
    },
    timestamp: new Date()
  }
}

/**
 * Reset metrics (useful for testing)
 */
function resetMetrics () {
  metrics.flowExecutions = 0
  metrics.flowSuccesses = 0
  metrics.flowFailures = 0
  metrics.averageExecutionTime = 0
  metrics.lastExecutionTime = 0
  metrics.nodeExecutions = {}
  metrics.errors = []
}

/**
 * Check if BrainyFlow should be used based on rollout configuration
 * @param {Object} context - Request context (user, channel, etc.)
 * @returns {boolean} Whether to use BrainyFlow
 */
function shouldUseBrainyFlow (context = {}) {
  // Always respect the main feature flag
  if (!config.useBrainyFlow) {
    return false
  }

  // Add any additional rollout logic here
  // For example, channel-based rollout, user-based rollout, etc.

  // For now, if the feature flag is enabled, use BrainyFlow
  return true
}

/**
 * Log rollout decision for debugging
 * @param {boolean} decision - Whether BrainyFlow was chosen
 * @param {Object} context - Request context
 */
function logRolloutDecision (decision, context = {}) {
  const reason = decision ? 'BrainyFlow enabled' : 'Using legacy OpenAI'
  console.log(`🎯 BrainyFlow Rollout: ${reason} for ${JSON.stringify(context)}`)
}

module.exports = {
  recordFlowStart,
  recordFlowCompletion,
  recordNodeExecution,
  getMetrics,
  resetMetrics,
  shouldUseBrainyFlow,
  logRolloutDecision
}
