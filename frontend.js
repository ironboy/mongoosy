export default /*const mongoosy =*/ (() => {

  class GenericAwaitFuncProxy {

    constructor(resolver, _class, obj) {
      // the resolver should be a function
      // it will receive data, resolve func, reject func
      // the _class should be a class used when
      // the instance is used with new
      // obj is an obj to proxy for extra methods
      this.mem = [];
      this.obj = obj;
      this.resolver = resolver;
      this.class = _class;
      return this.makeProxy();
    }

    makeProxy() {
      let that = this;
      return new Proxy(!that.mem.length && that.obj ? that.obj : function (...args) {
        let last = that.mem.slice(-1)[0];
        if (last.method === 'then') {
          that.mem.pop();
          that.resolver(that.mem, ...args);
          that.mem = [];
          return;
        }
        last.args = args;
        return that.makeProxy();
      }, {
        get(...args) {
          if (!that.mem.length && args[1] === 'then') {
            return new that.class(that.obj);
          }
          if (that.obj && that.obj[args[1]]) { return that.obj[args[1]]; }
          if (args[1] === 'js') { return that.obj; }
          if (args[1] === 'prototype') { return that.class.prototype; }
          that.mem.push({ method: args[1] })
          return that.makeProxy();
        },
        construct(...args) {
          return new that.class(...args[1]);
        }
      });
    }

  }

  class Mongoosy {

    constructor(_class, _arrayClass) {
      return new GenericAwaitFuncProxy(async (data, resolve) => {
        data.unshift({ model: _class.name, static: true });
        let [response, error] = await Mongoosy.fetch(data);
        let notArray = !error && response.constructor !== Array;
        notArray && (response = [response]);
        !error && (response = new _arrayClass(...response.map(x =>
          new _class(x)
        )));
        notArray && (response = response[0]);
        resolve(error || response);
      }, _class, _class);
    }

    static async fetch(data) {
      let { static: _static, model } = data[0];
      let { method: action } = data[1];
      let raw = await fetch('/api/mongoosy', {
        method: 'POST',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: JSON.stringify(data, (...args) => {
            let [, val] = args;
            return val.constructor === RegExp ?
              { $regex: val.toString() } : val;
          })
        })
      });
      let error;
      let response = await raw.json().catch(e => {
        error = { error: e };
      });
      !response && (error = new Error('Not found'));
      error = error || response.error;
      error = error && { error: error, js: { error: error } };
      return [response, error];
    }

    static get mainProxyTrap() {
      return {
        get(...args) {
          let model = args[1];
          let f = new Function('Model', 'ModelArray', `
          return [
            class ${model} extends Model {},
            class ${model}Array extends ModelArray {}
          ]
        `);
          return new Mongoosy(...f(Model, ModelArray));
        }
      }
    }

  }

  class Model {

    constructor(obj) {
      Object.assign(this, obj);
      return new GenericAwaitFuncProxy(async (data, resolve) => {
        data.unshift({ model: this.constructor.name, static: false });
        data.push({ instanceData: this });
        let error;
        [data, error] = await Mongoosy.fetch(data);
        if (data) {
          Object.assign(this, data);
        }
        resolve(error || this);
      }, this.constructor, this);
    }

    static addMethods(methods) {
      Object.assign(this.prototype, methods);
    }

  }

  class ModelArray extends Array {
    get js() {
      return new this.constructor(...this.map(x => x.js));
    }
  }

  return new Proxy({}, Mongoosy.mainProxyTrap);

})();