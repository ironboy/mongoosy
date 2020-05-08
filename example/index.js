const path = require('path');
const { mongoose, express, app, pwencrypt } = require('../index')({
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