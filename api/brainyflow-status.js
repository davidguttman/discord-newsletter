const express = require('express')
const autoCatch = require('../lib/auto-catch')
const { getMetrics, resetMetrics } = require('../lib/brainyflow/monitoring')

const router = express.Router()

// GET /brainyflow-status - Get BrainyFlow metrics and status
router.get('/', autoCatch(async (req, res) => {
  const metrics = getMetrics()

  res.json({
    status: 'active',
    metrics,
    health: {
      isHealthy: metrics.flowExecutions === 0 || parseFloat(metrics.successRate) > 90,
      lastExecution: metrics.lastExecutionTime > 0 ? `${metrics.lastExecutionTime}ms` : 'Never',
      averageExecution: metrics.averageExecutionTime > 0 ? `${Math.round(metrics.averageExecutionTime)}ms` : 'N/A'
    }
  })
}))

// POST /brainyflow-status/reset - Reset metrics (for testing/debugging)
router.post('/reset', autoCatch(async (req, res) => {
  resetMetrics()

  res.json({
    success: true,
    message: 'BrainyFlow metrics have been reset'
  })
}))

// GET /brainyflow-status/config - Get current configuration
router.get('/config', autoCatch(async (req, res) => {
  const config = require('../config')

  res.json({
    brainyflow: {
      enabled: config.useBrainyFlow,
      maxVisits: config.brainyFlowMaxVisits,
      timeout: config.brainyFlowTimeout,
      retryCount: config.brainyFlowRetryCount,
      batchSize: config.brainyFlowBatchSize
    }
  })
}))

module.exports = router
