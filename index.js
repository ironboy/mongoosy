const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const app = express();
let allModels;

class MongoosyBackend {

  constructor(settings = {}) {
    let defaults = {
      query: {
        route: '/api/mongoosy*'
      },
      expressJson: {
        limit: '1mb'
      },
      models: {
        path: './models'
      },
      connect: {
        url: 'mongodb://localhost/test',
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true
      }
    };
    // merge settings with defaults
    this.settings = Object.assign({}, defaults);
    for (let i in this.settings) {
      Object.assign(this.settings[i], settings[i]);
    }
    // convert relative paths to absolute ones
    let basePath = path.dirname(process.mainModule.filename);
    this.settings = JSON.parse(
      JSON.stringify(this.settings, (key, val) => {
        return key === 'path' && val.indexOf('.') === 0 ?
          path.resolve(basePath, val) : val;
      }));
    this.start();
  }

  async start(settings) {
    let { expressJson, models } = this.settings;
    app.use(express.json(expressJson));
    this.models = await this.readModels(models.path);
    allModels = this.models;
    this.connect();
    this.addRoute();
  }

  connect() {
    let s = { ...this.settings.connect };
    let { url } = s;
    delete s.url;
    mongoose.connect(url, s);
  }

  backToRegEx(val) {
    // convert back to reg ex from stringified reg ex
    return new RegExp(
      val.replace(/\w*$/, '').replace(/^\/(.*)\/$/, '$1'),
      val.match(/\w*$/)[0]
    );
  }

  addRoute() {
    app.post(this.settings.query.route, async (req, res) => {
      let data = JSON.parse(req.body.json, (key, val) => {
        return val && val.$regex ? this.backToRegEx(val.$regex) : val;
      });
      let result = await this.handleCall(req, res, data);
      res.json(result);
    });
  }

  async handleCall(req, res, data) {
    let query = data[0] && this.models[data[0].model];
    let _static = data[0] && data[0].static;
    if (!query) { return { error: 'No such model' }; }
    let instanceData = !_static && data.pop().instanceData;
    if (!_static && !instanceData) { return { error: 'No instance data' }; }
    if (instanceData._id) {
      query = await query.findOne({ _id: instanceData._id });
      if (!query) { return { error: 'No such _id: ' + instanceData._id }; }
    }
    else if (instanceData) {
      query = new query();
    }
    if (!_static) {
      Object.assign(query, instanceData);
    }
    data.shift();
    for (let part of data) {
      if (part.method.indexOf('find') === 0 && typeof part.args[0] === 'string') {
        part.args[0] = { _id: part.args[0] };
      }
    }
    if (query.acl && !(await query.acl(req, res, data))) {
      return;
    }
    for (let part of data) {
      if (!query[part.method]) { return { error: 'No such method: ' + part.method }; }
      query = query[part.method](...part.args);
    }
    if (query.exec) { query = query.exec(); }
    return await query;
  }

  async readModels(...folderPath) {
    let filePaths = await this.getFileNames(path.join(...folderPath));
    let models = {};
    for (let file of filePaths) {
      try {
        let model = require(file);
        models[model.modelName] = model;
      }
      catch (e) {
        console.log('The file ' + file + ' does not contain a valid Mongoose model!');
        console.log(e);
      }
    }
    return models;
  }

  getFileNames(folderPath) {
    // read a folder recursively looking for js files
    let fs = require('fs');
    let base = { __count: 0, arr: [] };
    if (!fs.existsSync(folderPath)) { return []; }
    recursiveReadDir(folderPath);
    let resolve;
    let callback = x => resolve(x);
    return new Promise((res) => {
      resolve = res;
    });
    // recursor
    function recursiveReadDir(folderPath) {
      base.__count++;
      fs.readdir(folderPath, function (err, x) {
        base.__count--;
        for (let j = 0; j < x.length; j++) {
          let i = x[j];
          if (i.indexOf(".") < 0 && !err) {
            recursiveReadDir(path.join(folderPath, i), callback);
          }
          else if (i.indexOf(".js") > 0) {
            base.arr.push(path.join(folderPath, i));
          }
        }
        if (base.__count === 0) { callback(base.arr); }
      });
    }
  }

}

const main = (...args) => {
  let backend = new MongoosyBackend(...args);
  return {
    mongoose: mongoose,
    express: express,
    app: app
  }
};

main.addCMSPostHooks = (schema) => {
  schema.post('save', async (doc) => {
    const CmsMeta = allModels.CmsMeta;
    if (!CmsMeta) { return; }
    let item = await CmsMeta.findOne({ id: doc._id });
    if (!item) {
      item = new CmsMeta({
        id: doc._id,
        model: doc.constructor.modelName,
        slug: doc._id
      });
      await item.save();
    }
  });
  schema.post('remove', async (doc) => {
    const CmsMeta = allModels.CmsMeta;
    if (!CmsMeta) { return; }
    let item = await CmsMeta.find({ id: doc._id });
    await item.remove();
  });
};

// Export
module.exports = main;