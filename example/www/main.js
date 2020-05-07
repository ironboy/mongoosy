import mongoosy from '/frontend.js';
const {
  Cat,
  Login,
  User
} = mongoosy;

async function test() {
  /*
  // Create a new cat and save to db
  let aCat = new Cat({ name: 'Garfield' });
  await aCat.save();
  // after saving the cat it has an id
  console.log('aCat', aCat.js);

  let allCats = await Cat.find({});
  console.log(allCats.js);*/
  /*
    await Login.login({ email: 'hej', password: 'hoho' });
    */
  //await User.remove({});
  /*let a = new User({ email: 'hejastet', password: 'hohoh' });
  console.log(await a.save());
  console.log(await User.find({}));*/
  console.log(await Login.login({ email: 'hejastet', password: 'hohoh' }));
  console.log(await Login.check());
  console.log(await Cat.find({}));
  //console.log(await Login.logout());
}
test();