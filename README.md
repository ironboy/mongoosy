# Mongoosy
Round-trip front-end mongoose.

## Install
```
npm i mongoosy
```

## Setting up the backend
You don't have to npm install **express** and **mongoose**. Mongoosy will do that for you.

You import mongoose, express and your app (your server) from mongoosy.

You also send your settings to mongoosy when requiring it. Typically you will want to change the database name (otherwise it defaults to **test**).

You also need to start the app (the server) on a port of your choice.

```js
// Change these values
const dbName = 'mydbname';
const serverPort = 3000;

const { mongoose, express, app, pwencrypt } = require('mongoosy')({
  // settings for mongoosy
  connect: {
    url: 'mongodb://localhost/' + dbName
  }
});

app.listen(serverPort, () => console.log('Server listening on port ' + serverPort));
```

Mongoosy expect mongoose models to be stored as separate files that each export a monoogse model in a folder called **models**. 

### Default settings
You can change which folder to look in for models and a some other settings if you want to. These are the defaults settings used if you don't change them:

```js
{
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
}
```

## Setting up the frontend
**Note:** We expect you to use **mongoosy** in a frontend environment that support the **import** command.

### Import your models
```js
import mongoosy from 'mongoosy/frontend';
const {
  // Replace with names
  // of models you have defined
  // in the models folder
  Cat,
  CatOwner
} = mongoosy;
```

That's it! Now you can use your models exactly as you would on the backend (utilizing the full Mongoose API)! 

**Note:** Make sure  to always use them with modern syntax - await/promises - *not* callbacks.

### Example
Just a basic example - you can do so much more since you have all of Mongoose available - population and other advanced queries...

**Note**: As you can see below we are asking for the property *.js* in our *console.logs*. **You should only use this in console.logs** (and you don't have to) - it just gives the log of objects and arrays a little cleaner look since the objects are *proxy objects* and otherwise will be logged as such.

```js
async function doStuff() {
  // Use mongoose from the frontend
  // through mongoosy

  // Create a new cat and save to db
  let aCat = new Cat({ name: 'Garfield' });
  await aCat.save();
  // after saving the cat it has an id
  console.log('aCat', aCat.js);

  // Read all cats from the db
  let allCats= await Cat.find();
  console.log('allCats', allCats.js);

  // Create a new cat owner and save to db
  let aCatOwner = new CatOwner({ name: 'Jon'});
  await aCatOwner.save();
  // after saving the cat owner he has an id
  console.log('aCatOwner', aCatOwner.js);

  // Read that cat owner again from the db
  let foundCatOwner = await CatOwner.findOne({ _id: aCatOwner._id });
  console.log('foundCatOwner', foundCatOwner.js);

  // Read all cat owners from the db
  let allCatOwners = await CatOwner.find();
  console.log('allCatOwners', allCatOwners.js);

}
```

### Gotchas: Reading a property that might be undefined
When you are trying to read a property that might be undefined from a document you will get a Proxy object back. This is because **mongoosy** is based on Proxy-objects and has now way of knowing if you are asking for a method or a property *in the specific case when a property is undefined*.

Therefore we have build in a workaround, if you aske for the property with _ (underscore) added as the last character of the property name you will get the property value or **undefined** if the property is undefined.

## Login and ACL
Mongoosy automatically handles logins connected to a model (like User), encrypts passwords, handles sessions... A "fake model" called **Login** is always available, with the three methods **login**, **logout** and **check** (se example code below).

Mongoosy also allows andvanced **ACL (Access Control List)** security based on users and/or user roles by giving you two "hooks" you can connect to your own functions in the settings. One prevents queries to run if you return false, the other one lets you filter results. The hooks recieve detailed information about the query and the logged in user - it is up to you to setup your control structure based on this!

There is a working example you can run:

```
cd node_modules/mongoosy/example
node index
```

This is the code used in the example:

### Backend code (with examples of how to use ACL)
```js
const path = require('path');
const { mongoose, express, app, pwencrypt } = require('mongoosy')({
  // settings for mongoosy
  connect: {
    url: 'mongodb://localhost/login-example-db'
  },
  acl: {
    query: aclQuery,
    result: aclResult
  }
});

app.listen(3000, () => console.log('Server listening on port 3000'));
app.use(express.static('www'));
app.get('/frontend', (req, res) => res.sendFile(path.resolve(__dirname, '../frontend.js')));

function aclQuery({ user, model, instance, methods }) {
  // blacklisting is safest 
  // - i.e.return false unless you want to allow something
  console.log('aclQuery', JSON.stringify(arguments, '', '  '));
  return false ||
    (user && user.roles.includes('god')) ||
    (user && user.roles.includes('catwatcher') && methods[0].method === 'find' && methods.length === 1) ||
    (user && user.roles.includes('catcreator') && methods[0].method === 'save' && methods.length === 1);
}

function aclResult({ user, model, instance, methods, result }) {
  // can modify results
  console.log('aclResult', JSON.stringify(arguments, '', '  '));
  if (!user || !user.roles.includes('god') && model === 'Cat' && result instanceof Array) {
    console.log('You are not a god so no Garfield for you!');
    result = result.filter(x => x.name !== 'Garfield');
  }
  return result;
}

async function createGodUser() {
  let User = require('./models/User');
  let foundGod = await User.findOne({ email: 'god@gmail.com' });
  if (foundGod) { return; }
  let god = new User({ email: 'god@gmail.com', password: pwencrypt('666'), roles: ['god'] });
  console.log('Created god user...');
  await god.save();
}

createGodUser();
```

### Frontend code (with examples of how to use Login)
```js
import mongoosy from 'mongoosy/frontend';
const {
  Cat,
  Login,
  User
} = mongoosy;

const $ = cssSelector => document.querySelector(cssSelector);

start();

async function start() {
  document.body.innerHTML = /*html*/`
    <h1>Mongoosy login/ACL example</h1>
    <p>First <a href="#">setup/reset the test data</a></p>
    <p>Then you can try to login as </p>
    <ul>
      <li>catwatcher@gmail.com (pw: 1234) - can see cats</li>
      <li>catcreator@gmail.com (pw: 4321) - can see and create cats</li>
      <li>god@gmail.com (pw: 666) - can do everything &amp; the only one who can see Garfield</li>
    </ul>
    <hr>
    <a href="#">Add a cat</a>&nbsp;&nbsp;&nbsp;
    <span class="user"></span>
    <hr>
    <h3>Cats</h3>
    <div class="cats"></div>
  `;

  $('body').addEventListener('click', e => {
    let t = (e.target.closest('a') || {}).innerText;
    t === 'Login' && login();
    t === 'Logout' && logout();
    t === 'Add a cat' && addCat();
    t === 'setup/reset the test data' && setupTestData();
  });

  updateLoginInfo();
}

async function updateLoginInfo() {
  let user = await Login.check();
  $('.user').innerHTML = user.js.email ?
    `Logged in as ${user.email}&nbsp;&nbsp;&nbsp;
    <a href="#">Logout</a>` :
    `<a href="#">Login</a>`
  await listCats();
}

async function login() {
  let email = prompt('Email');
  let password = prompt('Password');
  let loginResult = await Login.login({ email, password });
  loginResult.js.error && alert(loginResult.js.error);
  updateLoginInfo();
}

async function logout() {
  await Login.logout();
  updateLoginInfo();
}

async function addCat() {
  let name = prompt('Add a new cat:');
  let cat = new Cat({ name });
  await cat.save();
  if (cat.error === 'Not allowed by query ACL') {
    alert('You are not allowed to create cats!');
  }
  await listCats();
}

async function listCats() {
  let allCats = await Cat.find({});
  $('.cats').innerHTML = allCats.error === 'Not allowed by query ACL' ?
    'You are not allowed to see the cats.' :
    allCats.map(x => x.name + '<br>').join('');
}

async function setupTestData() {
  // login as a god and create som test data
  await Login.login({ email: 'god@gmail.com', password: '666' });

  let catNames = ["Garfield", "Heathcliff", "Felix the Cat", "Tom", "Hello Kitty", "Sylvester", "Tigger", "Simba"];

  let userDetails = [
    { email: 'catwatcher@gmail.com', password: '1234', roles: ['catwatcher'] },
    { email: 'catcreator@gmail.com', password: '4321', roles: ['catwatcher', 'catcreator'] }
  ];

  await Cat.deleteMany({});
  await User.deleteMany({ email: { $ne: 'god@gmail.com' } });

  for (let name of catNames) {
    let cat = new Cat({ name });
    await cat.save();
  }

  for (let detail of userDetails) {
    let user = new User(detail);
    await user.save();
  }

  // god leaves the building
  await Login.logout();
  alert('Test data created (and no user logged in)!');
  updateLoginInfo();
}
```

### Models

#### User
```js
const { Schema, model } = require('mongoose');
const modelName = 'User';

let schema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  roles: [String]
});

module.exports = model(modelName, schema);
```

#### Cat
```js
const { Schema, model } = require('mongoose');
const modelName = 'Cat';

let schema = new Schema({
  name: String
});

module.exports = model(modelName, schema);
```