const { Schema, model } = require('mongoose');
const modelName = 'Cat';

let schema = new Schema({
  name: String
});

module.exports = model(modelName, schema);