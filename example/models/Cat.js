const { Schema, model } = require('mongoose');
const modelName = 'Cat';

let schema = new Schema({
  name: String,
  age: Number
});

module.exports = model(modelName, schema);