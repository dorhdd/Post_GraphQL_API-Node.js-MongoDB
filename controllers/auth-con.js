const bcrypt = require("bcryptjs");
const jsonwevtoken = require("jsonwebtoken");

const errorsHandler = require("../errors/errors");

const User = require("../models/user");

exports.signup = async (req, res, next) => {
  errorsHandler.syncErrors(req);
  const body = req.body;
  try {
    const hashPass = await bcrypt.hash(body.password, 12);
    const user = new User({
      email: body.email,
      password: hashPass,
      name: body.name,
    });
    const result = await user.save();
    res.status(201).json({ userId: result._id });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};

exports.login = async (req, res, next) => {
  const body = req.body;
  let selectedUser;
  try {
    const user = await User.findOne({ email: body.email });
    if (!user) {
      errorsHandler.msgErrors("User does not exist", 401);
    }
    selectedUser = user;
    const matchPasswords = await bcrypt.compare(body.password, user.password);
    if (!matchPasswords) {
      errorsHandler.msgErrors("Wrong E-mail or password", 401);
    }
    const token = jsonwevtoken.sign(
      {
        email: selectedUser.email,
        userId: selectedUser._id.toString(),
      },
      process.env.secret, //sercet should be a longer private key
      { expiresIn: "1h" }
    );
    res.status(200).json({ token: token, userId: selectedUser._id.toString() });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};
