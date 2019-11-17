const { Schema, model } = require('mongoose');
const { addCMSPostHooks } = require('../mongoosy-backend');

let schema = new Schema({
  id: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true,
    refPath: 'model'
  },
  slug: {
    type: String,
    unique: true,
    index: true,
  },
  model: {
    type: String,
    required: true
  },
  hideInMenu: Boolean
});

module.exports = model('CmsMeta', schema);