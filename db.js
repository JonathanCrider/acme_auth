const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt')
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

const Note = conn.define('note', {
  text: STRING,
});

User.hasMany(Note)
Note.belongsTo(User)

User.addHook('beforeSave', (user) => {
  if (user._changed.has('password')) {
    user.password = bcrypt.hash(user.password, 5);
  }
});

User.byToken = async (token) => {
  try {
    const id = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(id);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  if (user && bcrypt.compare(password, user.password)) {
    return jwt.sign(user.id, process.env.JWT);
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [
    { text: 'lucy note 1', userId: lucy.id },
    { text: 'lucy note 2', userId: lucy.id },
    { text: 'larry note 1', userId: larry.id },
    { text: 'moe note 1', userId: moe.id }
  ]
  await Promise.all(
    notes.map(note => Note.create(note))
  );
  moe.save()
  lucy.save()
  larry.save()
  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note
  },
};
