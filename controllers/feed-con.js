const fs = require("fs");
const path = require("path");

const Post = require("../models/post");
const User = require("../models/user");

const errorsHandler = require("../errors/errors");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};

exports.postPost = async (req, res, next) => {
  errorsHandler.syncErrors(req);
  if (!req.file) {
    errorsHandler.syncErrors("No image provided", 422);
  }
  const body = req.body;
  const imageUrl = req.file.path.replace("\\", "/");
  let creator;

  const post = new Post({
    title: body.title,
    content: body.content,
    imageUrl: imageUrl,
    creator: req.userId,
  });
  try {
    await post.save();
    const user = await User.findById(req.userId);
    creator = user;
    user.posts.push(post);
    await user.save();

    res.status(201).json({
      post: post,
      creator: { _id: creator._id, name: creator.name },
    });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      errorsHandler.msgErrors("Can't find post", 422);
    }
    res.status(200).json({ post: post });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};

exports.editPost = async (req, res, next) => {
  errorsHandler.syncErrors(req);
  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }
  if (!imageUrl) {
    errorsHandler.msgErrors("No file added", 422);
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      errorsHandler.msgErrors("Can't find post", 422);
    }
    if (post.creator.toString() !== req.userId) {
      errorsHandler.msgErrors("Authorization Error", 403);
    }
    if (imageUrl !== post.imageUrl) {
      deleteFile(post.imageUrl);
    }
    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const updatePost = await post.save();
    res.status(200).json({ post: updatePost });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      errorsHandler.msgErrors("Can't find post", 422);
    }
    if (post.creator.toString() !== req.userId) {
      errorsHandler.msgErrors("Authorization Error", 403);
    }
    //find if user create this post
    deleteFile(post.imageUrl);
    await Post.findByIdAndRemove(postId);
    const user = await User.findById(req.userId);

    user.posts.pull(postId);
    const result = user.save();
    res.status(200).json({ post: result });
  } catch (err) {
    errorsHandler.asyncErros(err, next);
  }
};
