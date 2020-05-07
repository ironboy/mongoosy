import mongoosy from '/frontend.js';
const {
  Cat
} = mongoosy;

async function test() {
  // Create a new cat and save to db
  let aCat = new Cat({ name: 'Garfield' });
  await aCat.save();
  // after saving the cat it has an id
  console.log('aCat', aCat.js);

  let allCats = await Cat.find({});
  console.log(allCats.js);
}

test();