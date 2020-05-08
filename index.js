const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const connectMongo = require('connect-mongo')(session);
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
      },
      login: {
        pseudoModel: 'Login',
        connectedModel: 'User',
        passwordField: 'password',
        encryptPassword: true,
        encryptionSalt: 'unique and hard to guess',
        secureSession: false // set to true if https
      },
      acl: {
        query: ({ user, model, instance, methods }) => true,
        result: ({ user, model, instance, methods, result }) => result
      }
    };
    // merge settings with defaults
    this.settings = Object.assign({}, defaults);
    for (let i in this.settings) {
      Object.assign(this.settings[i], settings[i]);
    }
    // convert relative paths to absolute ones
    let basePath = path.dirname(process.mainModule.filename);
    let acl = this.settings.acl;
    this.settings = JSON.parse(
      JSON.stringify(this.settings, (key, val) => {
        return key === 'path' && val.indexOf('.') === 0 ?
          path.resolve(basePath, val) : val;
      }));
    this.settings.acl = acl;
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
    app.use(session({
      secret: this.settings.login.encryptionSalt,
      resave: false,
      saveUninitialized: true,
      cookie: { secure: this.settings.login.secureSession },
      store: new connectMongo({ mongooseConnection: mongoose.connection })
    }));
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
      let result = await this.handleCall(req, data);
      res.json(result);
    });
  }

  async handleCall(req, data) {
    let orgData = data.slice();
    let model = orgData.shift().model;
    if (model === this.settings.login.pseudoModel) {
      return await this.loginHandler(req, data);
    }
    let query = data[0] && this.models[data[0].model];
    let _static = data[0] && data[0].static;
    if (!query) { return { error: 'No such model' }; }
    let instanceData = !_static && data.pop().instanceData;
    if (instanceData && model === this.settings.login.connectedModel) {
      let pword = instanceData[this.settings.login.passwordField];
      let alreadyEncrypted = pword.length === 64 && pword.replace(/[0-9a-f]/g, '').length === 0;
      if (!alreadyEncrypted) {
        instanceData[this.settings.login.passwordField] = this.encryptPassword(pword);
      }
    }
    if (!_static && !instanceData) { return { error: 'No instance data' }; }
    if (instanceData._id) {
      query = await query.findOne({ _id: instanceData._id });
      if (!query) { return { error: 'No such _id: ' + instanceData._id }; }
    }
    else if (instanceData) {
      query = new query();
    }
    let instance = _static ? null : query;
    if (!(await this.settings.acl.query({ user: req.session.user, model, instance, methods: orgData.slice(0, instance ? -1 : orgData.length) }))) {
      return { error: 'Not allowed by query ACL' };
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
    for (let part of data) {
      if (!query[part.method]) { return { error: 'No such method: ' + part.method }; }
      query = query[part.method](...part.args);
    }
    if (query.exec) { query = query.exec(); }
    let result;
    try {
      result = await query;
    }
    catch (error) {
      result = { error };
    }
    !_static && orgData.pop();
    if (model === this.settings.login.connectedModel) {
      // remove password field on model connected to login
      let wasArray = result instanceof Array;
      result = JSON.parse(JSON.stringify(result));
      !wasArray && (result = [result]);
      result.forEach(x => x && delete x[this.settings.login.passwordField]);
      delete result.password;
      !wasArray && (result = result[0]);
    }
    result = await this.settings.acl.result({ user: req.session.user, model, instance, methods: orgData, result });
    return result;
  }

  async loginHandler(req, data) {
    let _static = data[0].static;
    let method = data[1].method;
    let obj = data[1] && data[1].args && data[1].args[0];
    if (!_static || !['login', 'check', 'logout'].includes(method)) {
      return { error: 'Login only accepts the static methods login, check and logout' };
    }
    if (method === 'login') {
      if (!(typeof obj === 'object')) {
        return { error: 'Login must have an object as an argument' }
      }
      let password = obj[this.settings.login.passwordField];
      if (!password) {
        return { error: 'You must provide a password' }
      };
      obj[this.settings.login.passwordField] = this.encryptPassword(password);
      let Model = this.models[this.settings.login.connectedModel];
      if (!Model) {
        return { error: 'Login could not find the connected model ' + this.settings.login.connectedModel };
      }
      let user = JSON.parse(JSON.stringify(await Model.findOne(obj)));
      if (!user) {
        return { error: 'No such user + password found' }
      }
      delete user[this.settings.login.passwordField];
      req.session.user = user;
      return user;
    }
    if (method === 'check') {
      return req.session.user || { status: 'Not logged in' }
    }
    if (method == 'logout') {
      if (req.session.user) {
        delete req.session.user;
        return { status: 'Logged out successfully' }
      }
      else {
        return { error: 'Not logged in' }
      }
    }
  }

  encryptPassword(password) {
    return crypto.createHmac('sha256', this.settings.login.encryptionSalt)
      .update(password).digest('hex');
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
    app: app,
    pwencrypt: (pw) => backend.encryptPassword(pw)
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