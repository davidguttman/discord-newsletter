const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/auth')
const autoCatch = require('../lib/auto-catch')
const Widget = require('../models/widget')
const middleware = require('../middleware')

/**
 * @openapi
 * /widgets:
 *   get:
 *     summary: List all widgets
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of widgets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Widget'
 */
router.get('/', ...middleware, autoCatch(async (req, res) => {
  const widgets = await Widget.find()
  res.json(widgets)
}))

/**
 * @openapi
 * /widgets:
 *   post:
 *     summary: Create a new widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WidgetInput'
 *     responses:
 *       201:
 *         description: Widget created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 *       400:
 *         description: Validation error
 */
router.post('/', ...middleware, autoCatch(async (req, res) => {
  try {
    const widget = new Widget(req.body)
    await widget.save()
    res.status(201).json(widget)
  } catch (err) {
    if (err.name === 'ValidationError') {
      res.status(400).json({ error: err.message })
    } else {
      throw err
    }
  }
}))

/**
 * @openapi
 * /widgets/{id}:
 *   get:
 *     summary: Get a widget by ID
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Widget found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 */
router.get('/:id', ...middleware, autoCatch(async (req, res) => {
  const widget = await Widget.findById(req.params.id)
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' })
  }
  res.json(widget)
}))

/**
 * @openapi
 * /widgets/{id}:
 *   put:
 *     summary: Update a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WidgetInput'
 *     responses:
 *       200:
 *         description: Widget updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 */
router.put('/:id', ...middleware, autoCatch(async (req, res) => {
  try {
    const widget = await Widget.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' })
    }
    res.json(widget)
  } catch (err) {
    if (err.name === 'ValidationError') {
      res.status(400).json({ error: err.message })
    } else {
      throw err
    }
  }
}))

/**
 * @openapi
 * /widgets/{id}:
 *   delete:
 *     summary: Delete a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Widget deleted
 */
router.delete('/:id', ...middleware, autoCatch(async (req, res) => {
  const widget = await Widget.findByIdAndDelete(req.params.id)
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' })
  }
  res.status(204).send()
}))

module.exports = router 