// Change these values
const dbName = 'mydbname2';
const serverPort = 3000;

const { mongoose, express, app } = require('../index')({
  // settings for mongoosy
  connect: {
    url: 'mongodb://localhost/' + dbName,
  },
  acl: (all) => {
    console.log(all)
    return true;
  }
});

app.listen(serverPort, () => console.log('Server listening on port ' + serverPort));

app.use(express.static('www'));