const mongoose = require('mongoose')
const cuid = require('cuid')

const widgetSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: cuid
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  variations: [{
    name: String,
    price: Number,
    color: String
  }]
}, {
  timestamps: {
    createdAt: 'dateCreated',
    updatedAt: 'dateUpdated'
  }
})

module.exports = mongoose.model('Widget', widgetSchema) 