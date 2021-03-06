const mongoose = require('mongoose');
const passport = require('passport');
const router = require('express').Router();
const auth = require('../auth');
const Users = mongoose.model('Users');

router.get('/', auth.optional, (req, res, next) => { return res.status(200).end() } )
//POST new user route (optional, everyone has access)
router.post('/', auth.optional, (req, res, next) => {
  //TODO: Advanced server-side validation using Mongoose Schemas
  const { body: { user } } = req;
  try {
    if(!user.email) {
      return res.status(422).json({
        errors: {
          email: 'is required',
        },
      });
    }
    if(!user.name) {
      return res.status(422).json({
        errors: {
          name: 'is required',
        },
      });
    }
    if(!user.password) {
      return res.status(422).json({
        errors: {
          password: 'is required',
        },
      });
    }
    return Users.exists({ email: user.email }).then((data) => {
      if (data) {
        return res.status(422).json({
          errors: {
            email: 'is already registered',
          }})
      }
      else {
        const finalUser = new Users(user);
        finalUser.setPassword(user.password);

        return finalUser.save()
          .then(() => res.json({ user: finalUser.toAuthJSON() }))
          .catch(err => res.status(422).json(err));
      }
    });
  } catch (error) {
    return res.status(500);
  }
});

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, (req, res, next) => {
  const { body: { user } } = req;

  if(!user.email) {
    return res.status(422).json({
      errors: {
        email: 'is required',
      },
    });
  }

  if(!user.password) {
    return res.status(422).json({
      errors: {
        password: 'is required',
      },
    });
  }

  return passport.authenticate('local', { session: false }, (err, passportUser, info) => {
    if(err) {
      return next(err);
    }

    if(passportUser) {
      const user = passportUser;
      user.token = passportUser.generateJWT();

      return res.json({ user: user.toAuthJSON() });
    }

    return res.status(400).json(info);
  })(req, res, next);
});

//GET current route (required, only authenticated users have access)
router.get('/current', auth.required, (req, res, next) => {
  const { payload: { id } } = req;

  return Users.findById(id)
    .then((user) => {
      if(!user) {
        return res.sendStatus(400);
      }

      return res.json({ user: user.toAuthJSON() });
    });
});

router.get('/current/notebook', auth.required, (req, res, next) => {
  const { payload: { id } } = req;

  return Users.findById(id)
    .then((user) => {
      if(!user) {
        return res.sendStatus(400);
      }
      return res.json(user.notebookJSON());
    });
});

router.post('/current/notebook', auth.required, (req, res, next) => {
  const id = req.payload.id;
  const notebook = req.body.notebook;
  const data = req.body.data || req.body.mutableData;
  const updateObj = {...notebook && {notebook: notebook}, ...data && {mutableData: data}}

  console.dir(updateObj);

  return Users.findByIdAndUpdate(id, updateObj, {new: true, runValidators: true})
    .then((user) => {
      if(!user) {
        return res.sendStatus(400);
      }
      return res.json(user.notebookJSON());
    })
    .catch( err => {
      console.error(err);
      res.status(422).json(err);
    });
});

// router.post('/current/data', auth.required, (req, res, next) => {
//   const id = req.payload.id;
//   const data = req.body.data;
//
//   return Users.findByIdAndUpdate(id, {data: data}, {new: true, runValidators: true})
//     .then((user) => {
//       if(!user) {
//         return res.sendStatus(400);
//       }
//       return res.json(user.notebookJSON());
//     })
//     .catch( err => {
//       res.status(422).json(err);
//     });
// });
module.exports = router;
