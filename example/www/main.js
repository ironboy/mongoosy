import mongoosy from '/frontend';
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