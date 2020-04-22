# Mongoosy
Round-trip front-end mongoose.

## Install
```
npm i mongoosy
```

## Setting up the backend
You don't have to npm install **express** and **mongoose**.Mongoosy will do that for you.

You import mongoose, express and your app (your server) from mongoosy.

You also send your settings to mongoosy when requiring it. Typically you will want to change the database name (otherwise it defaults to **test**).

You also need to start the app (the server) on a port of your choice.

```js
// Change these values
const dbName = 'mydbname';
const serverPort = 3000;

const { mongoose, express, app } = require('mongoosy')({
  // settings for mongoosy
  connect: {
    url: 'mongodb://localhost/' + dbName
  }
});

app.listen(serverPort, () => console.log('Server listening on port ' + serverPort));
```

Mongoosy expect mongoose models to be stored as separate files that each export a monoogse model in a folder called **models**. 

### Default settings
You can change which folder to look in for models and a some  other settings if you want to. These are the defaults settings used if you don't change them:

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
  Cat
  CatOwner
} = mongoosy;
```

That's it! Now you can use your models exactly as you would on the backend (utilizing the full Mongoose API)! 

**Note:** Make sure  to always use them with modern syntax - await/promises - *not* callbacks.

### Example
Just a basic example - you can do so much more since you have all of Mongoose available - population and other advanced queries...

**Note**: As you can see below we are asking for the property *.js* in our *console.logs*. **You should only use this in console.logs** (and you don't have to) - it just gives the log of objects and arrays that a little bit cleaner look since the objects are *proxy objects* and otherwise will be logged as such.

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