const express = require('express')
const router = express.Router()
const Settings = require('../models/settings')
const autoCatch = require('../lib/auto-catch')

// GET /settings - Get all active channel settings
router.get('/', autoCatch(async (req, res) => {
  const settings = await Settings.find().sort({ createdAt: -1 })
  res.json(settings)
}))

// GET /settings/:guildId/:channelId - Check if specific channel is being collected
router.get('/:guildId/:channelId', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.params
  const setting = await Settings.findOne({ guildId, channelId })

  if (!setting) {
    return res.status(404).json({ error: 'Channel not being collected' })
  }

  res.json(setting)
}))

// POST /settings - Add channel to collection
router.post('/', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.body

  if (!guildId || !channelId) {
    return res.status(400).json({
      error: 'Both guildId and channelId are required'
    })
  }

  try {
    const settings = new Settings({
      guildId,
      channelId
    })

    await settings.save()
    res.status(201).json(settings)
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - channel already being collected
      return res.status(409).json({ error: 'Channel is already being collected' })
    }
    throw error
  }
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

// DELETE /settings/:guildId/:channelId - Remove channel from collection
router.delete('/:guildId/:channelId', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.params
  const settings = await Settings.findOneAndDelete({ guildId, channelId })

  if (!settings) {
    return res.status(404).json({ error: 'Channel not being collected' })
  }

  res.json({ message: 'Channel removed from collection' })
}))

// DELETE /settings/:id - Delete settings by ID (legacy support)
router.delete('/:id', autoCatch(async (req, res) => {
  const settings = await Settings.findByIdAndDelete(req.params.id)

  if (!settings) {
    return res.status(404).json({ error: 'Settings not found' })
  }

  res.json({ message: 'Settings deleted' })
}))

module.exports = router
