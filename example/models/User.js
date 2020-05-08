const { Schema, model } = require('mongoose');
const modelName = 'User';

let schema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  roles: [String]
});

module.exports = model(modelName, schema);