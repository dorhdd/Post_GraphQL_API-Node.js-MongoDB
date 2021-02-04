exports.asyncErros = (err, next) => {
  if (!err.statusCode) {
    err.statusCode = 500;
  }
  return next(err);
};

exports.syncErrors = (conditionsArr) => {  
  const errors = [];
  for (let item of conditionsArr) {
    if (item.condition) {
      errors.push({ msg: item.msg });
    }
  }
  if (errors.length > 0) {
    const error = new Error("Validation Failed");
    error.data = errors;
    error.code = 422;
    throw error;
  }
};

exports.msgErrors = (msg, statusCode) => {
  const error = new Error(msg);
  error.statusCode = statusCode;
  throw error;
};
