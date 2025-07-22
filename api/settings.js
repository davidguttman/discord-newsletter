const express = require('express')
const router = express.Router()
const Settings = require('../models/settings')
const autoCatch = require('../lib/auto-catch')

// GET /settings - Get current settings
router.get('/', autoCatch(async (req, res) => {
  const settings = await Settings.findOne().sort({ createdAt: -1 })
  
  if (!settings) {
    return res.status(404).json({ error: 'No settings found' })
  }
  
  res.json(settings)
}))

// POST /settings - Create or update settings
router.post('/', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.body
  
  if (!guildId || !channelId) {
    return res.status(400).json({ 
      error: 'Both guildId and channelId are required' 
    })
  }
  
  const settings = new Settings({
    guildId,
    channelId
  })
  
  await settings.save()
  res.status(201).json(settings)
}))

// PUT /settings/:id - Update existing settings
router.put('/:id', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.body
  
  const settings = await Settings.findByIdAndUpdate(
    req.params.id,
    { guildId, channelId },
    { new: true, runValidators: true }
  )
  
  if (!settings) {
    return res.status(404).json({ error: 'Settings not found' })
  }
  
  res.json(settings)
}))

// DELETE /settings/:id - Delete settings
router.delete('/:id', autoCatch(async (req, res) => {
  const settings = await Settings.findByIdAndDelete(req.params.id)
  
  if (!settings) {
    return res.status(404).json({ error: 'Settings not found' })
  }
  
  res.json({ message: 'Settings deleted' })
}))

module.exports = router