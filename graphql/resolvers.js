const errorsHandler = require("../errors/errors");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const jsonwebtoken = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");

const { deleteImage } = require("../util/delete-image");

module.exports = {
  signup: async ({ userInput }, req) => {
    const conditionsArr = [
      { condition: !validator.isEmail(userInput.email), msg: "Invalid E-mail" },
      {
        condition:
          validator.isEmpty(userInput.password) ||
          !validator.isLength(userInput.password, { min: 5 }),
        msg: "Password should be 5 char At least",
      },
    ];
    errorsHandler.syncErrors(conditionsArr);
    try {
      const userExist = await User.findOne({ email: userInput.email });
      if (userExist) {
        errorsHandler.msgErrors("User Exist", 409);
      }
      const hashpassword = await bcrypt.hash(userInput.password, 12);
      const user = new User({
        email: userInput.email,
        name: userInput.name,
        password: hashpassword,
      });
      const newUser = await user.save();
      return { ...newUser._doc, _id: newUser._id.toString() };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  login: async ({ email, password }) => {
    const user = await User.findOne({ email: email });
    if (!user) {
      errorsHandler.msgErrors("User not found", 404);
    }
    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      errorsHandler.msgErrors("Wrong password or E-mail", 401);
    }

    try {
      const token = jsonwebtoken.sign(
        {
          userId: user._id.toString(),
          email: user.email,
        },
        process.env.secret,
        { expiresIn: "1h" }
      );
      return { token: token, userId: user._id.toString() };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },
  postPost: async ({ postInput }, req) => {
    isAuthCheck(req);
    const conditionsArr = [
      {
        condition:
          validator.isEmpty(postInput.title) ||
          !validator.isLength(postInput.title, { min: 5 }),
        msg: "Title should be 5 char At least",
      },
      {
        condition:
          validator.isEmpty(postInput.content) ||
          !validator.isLength(postInput.content, { min: 5 }),
        msg: "Content should be 5 char At least",
      },
    ];
    errorsHandler.syncErrors(conditionsArr);
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        errorsHandler.msgErrors("Please login", 401);
      }
      const post = new Post({
        title: postInput.title,
        content: postInput.content,
        imageUrl: postInput.imageUrl,
        creator: user,
      });
      const createdPost = await post.save();
      user.posts.push(createdPost);
      await user.save();

      return {
        ...createdPost._doc,
        _id: createdPost._id.toString(),
        createdAt: createdPost.createdAt.toISOString(),
        updatedAt: createdPost.updatedAt.toISOString(),
      };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  posts: async ({ page }, req) => {
    isAuthCheck(req);
    if (!page) {
      page = 1;
    }
    const perPage = 2;

    try {
      const totalPosts = await Post.find().countDocuments();
      const posts = await Post.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate("creator");
      return {
        posts: posts.map((p) => {
          return {
            ...p._doc,
            _id: p._id.toString(),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          };
        }),
        totalPosts: totalPosts,
      };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  post: async ({ id }, req) => {
    isAuthCheck(req);
    try {
      const post = await Post.findById(id).populate("creator");
      noPostCheck(post);
      return {
        ...post._doc,
        _id: post._id.toString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  updatePost: async ({ id, postInput }, req) => {
    isAuthCheck(req);
    try {
      const post = await Post.findById(id).populate("creator");
      noPostCheck(post);
      if (post.creator._id.toString() !== req.userId.toString()) {
        errorsHandler.msgErrors("Not authorized", 401);
      }
      const conditionsArr = [
        {
          condition:
            validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 }),
          msg: "Title should be 5 char At least",
        },
        {
          condition:
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 }),
          msg: "Content should be 5 char At least",
        },
      ];
      errorsHandler.syncErrors(conditionsArr);

      post.title = postInput.title;
      post.content = postInput.content;
      if (postInput.imageUrl !== "undefined") {
        post.imageUrl = postInput.imageUrl;
      }
      const updatedPost = await post.save();
      return {
        ...updatedPost._doc,
        _id: post._id.toString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  deletePost: async ({ id }, req) => {
    isAuthCheck(req);

    try {
      const post = await Post.findById(id);
      noPostCheck(post);
      if (post.creator.toString() !== req.userId.toString()) {
        errorsHandler.msgErrors("Not authorized", 401);
      }
      deleteImage(post.imageUrl);
      await Post.findByIdAndRemove(id);
      const user = await User.findById(req.userId);
      user.posts.pull(id);
      await user.save();
      return true;
    } catch (err) {
      errorsHandler.asyncErros(err, next);
    }
  },

  user: async (args, req) => {
    isAuthCheck(req);
    const user = await User.findById(req.userId);
    if (!user) {
      errorsHandler.msgErrors("No user found", 401);
    }
    return { ...user._doc, _id: user._id.toString() };
  },

  updateStatus: async ({ status }, req) => {
    isAuthCheck(req);
    const user = await User.findById(req.userId);
    if (!user) {
      errorsHandler.msgErrors("No user found", 401);
    }
    user.status = status;
    await user.save()
    return { ...user._doc, _id: user._id.toString() };
  },
};

const isAuthCheck = (req) => {
  if (!req.isAuth) {
    errorsHandler.msgErrors("Please login", 401);
  }
};

const noPostCheck = (post) => {
  if (!post) {
    errorsHandler.msgErrors("No post found", 401);
  }
};
