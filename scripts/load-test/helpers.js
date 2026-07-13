'use strict';

module.exports = {
  generateToken: function (userContext, events, done) {
    const token = process.env.TEST_TOKEN || 'dev-token-placeholder';
    userContext.vars.token = token;
    return done();
  },
};
