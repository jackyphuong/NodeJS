import passport from 'passport';
import localStrategy from 'passport-local';
import co from 'co';
import dbHelper from '../lib/dbHelper';
import _ from 'lodash';
import cryptoHelper from '../../shared/cryptohelper';

let Strategy = localStrategy.Strategy;

class Secure {
  setup(app) {
    let that = this;
    app.use(passport.initialize());
    passport.use(new Strategy({
      usernameField: 'Username',
      passwordField: 'Password',
      session: false,
      passReqToCallback: true
    }, (req, userName, password, done)=> {
      that._login(userName, password).then((user)=> {
        return done(null, user);
      }).catch((err)=> {
        return done(null, false, err);
      });
    }));
  }

  checkAuth(req, res, next) {
    //noinspection JSUnresolvedFunction
    co(function*() {
      let token = (req.body && req.body.AccessToken) ||
        (req.query && req.query.AccessToken) ||
        req.headers['x-access-token'] ||
        req.headers['authorization'] ||
        req.headers['Authorization'] ||
        req.headers['access-token'];
      let decoToken;
      if (token) {
        if(_.startsWith(token, 'Bearer ')){
          token= _.replace(token, 'Bearer ', '');
        }
        decoToken = cryptoHelper.decodeJwtToken(token);
      }
      if (decoToken != null) {
          return next();
      }
      else {
        throw({AppCode: 'MSG_ERR_NO_VALID_TOKEN'});
      }
    }).catch(err => {
      return res.status(401).json(err);
    });
  }

  _login(userName, password) {
    return co(function* login() {
      yield dbHelper.openConnection();
      let sql = 'SELECT userName, password, salt FROM user WHERE UserName = ? limit 1';
      let user = yield  dbHelper.runQuery(sql, [userName]);
      if (user.length == 0) {
        throw({AppCode: 'MSG_ERR_USER_AUTHENTICATION_FAIL'});
      }
      if (_.isEmpty(user[0].password)) {
        throw({AppCode: 'MSG_ERR_USER_CORRUPT_DATA'});
      }

      var hashPassword = cryptoHelper.createHash(password, user[0].salt);
      if (user[0].password !== hashPassword) {
        throw({AppCode: 'MSG_ERR_USER_AUTHENTICATION_FAIL'});
      }

      dbHelper.closeConnection();

      return user[0];
    });
  }
}

export default new Secure();