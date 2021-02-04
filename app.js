const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

const { deleteImage } = require("./util/delete-image");
const errorsHandler = require("./errors/errors");

const { graphqlHTTP } = require("express-graphql");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");

const isAuth = require("./middleware/is-auth");

const mongoose = require("mongoose");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    return cb(null, false);
  }
};



app.use(helmet());
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE, PATCH");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(isAuth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    errorsHandler.msgErrors("Please login", 401);
  }
  if (!req.file) {
    return res.status(200).json({ msg: "No image added" });
  }
  if (req.body.oldPath) {
    const oldPath = req.body.oldPath.replace("\\", "/");
    deleteImage(oldPath);
  }
  const imagePath = req.file.path.replace("\\", "/");
  return res.status(201).json({ imagePath: imagePath });
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const msg = err.msg || "Error, please try again";
      const code = err.originalError.code || 500;
      return { message: msg, status: code, data: data };
    },
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  res
    .status(error.statusCode || 500)
    .json({ msg: error.message, errors: error.data });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT);
  })
  .catch((err) => {
    console.log(err);
  });
