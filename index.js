const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const PORT = 5000;
const DB_NAME = 'users';
const COLL_NAME = 'usersColl';
const MONGODB_URL = 'mongodb://localhost:27017/';

const BCRYPT_SALT_ROUNDS = 10;
const JWT_SECRET_KEY = 'secretkey';

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json());

let db = null;

MongoClient.connect(MONGODB_URL, { useNewUrlParser: true }, (err, client) => {
	if (err) throw err;

	db = client.db(DB_NAME);

	/*
		Create collection (with schema) if not present
	*/
	db.listCollections({}, {nameOnly: true}).toArray((err, arr) => {
		let index = arr.findIndex(details => details['name'] == COLL_NAME)
		if (index == -1) _createCollection(); // collection already not present
	})

	/*
		Insert one initial user (admin) in collections with following credentials:
		username: admin
		password: admin
	*/
	db.collection(COLL_NAME).findOne({username: 'admin'}, (err, res) => {
		if (err) throw err;

		if (!res) _addAdminToDatabase(); // admin already not present
	})

});

function _createCollection() {
	db.createCollection(COLL_NAME, (err, res) => {
		if (err) throw err;

		db.command({
			collMod: COLL_NAME,
			validator: {
				$jsonSchema: {
					bsonType: "object",
					required: ["firstName", "mobile", "email"],
					properties: {
						firstName: {
							bsonType: "string",
							maxLength: 20,
							minLength: 1,
							pattern: "^[a-zA-Z]*$"
						},
						middleName: {
							bsonType: "string",
							maxLength: 20,
							pattern: "^[a-zA-Z]*$"
						},
						lastName: {
							bsonType: "string",
							maxLength: 20,
							pattern: "^[a-zA-Z]*$"
						},
						mobile: {
							bsonType: "int",
							minimum: 1000000000,
							maximum: 9999999999
						},
						email: {
							bsonType: "string",
							maxLength: 30
						},
						password: {
							bsonType: "string"
						},
						role: {
							bsonType: "string",
							enum: ["ADMIN", "USER"]
						}
					}
				}
			}
		})
	})
}

function _addAdminToDatabase() {
	bcrypt.hash('admin', BCRYPT_SALT_ROUNDS, (err, hash) => {
		if (err) throw err;
		let admin = {
			username: 'admin',
			password: hash,
			firstName: 'admin',
			mobile: 1000000000,
			email: 'test@gmail.com',
			role: 'ADMIN'
		}
		db.collection(COLL_NAME).insertOne(admin, (err, res) => {
			if (err) throw err;
		});
	})
}

function adminAuthorization(req, res, next) {
	if (!req.headers['authorization']) {
		res.json({
			error: 'No authorization header found.'
		})
		return
	}
	
	const authHeader = req.headers['authorization'];
	const token = authHeader.split(' ')[1];
	jwt.verify(token, JWT_SECRET_KEY, (err, payload) => {
		if (err) {
			res.send({
				error: err
			})
			return;
		}
		let role = payload.role;
		if (role == 'ADMIN') {
			next();
		} else {
			res.send({
				error: 'Unauthorized user'
			})
		}
	})
}

app.get('/list-users', adminAuthorization, (req, res) => {
	db.collection(COLL_NAME).find({}).toArray((err,arr) => {
		if (err) {
			res.json({
				error: err
			})
			return;
		}
		res.json(arr);
	})
})

app.post('/create-user', adminAuthorization, (req, res) => {
	let firstName = req.body.firstName;
	let middleName = req.body.middleName;
	let lastName = req.body.lastName;
	let mobile = parseInt(req.body.mobile, 10);
	let email = req.body.email;
	let role = req.body.role;
	let password = req.body.password;

	let username = firstName + String(mobile);

	if (!email.match(/^.+@.+\..+$/))
		return res.json({
			error: 'Invalid email'
		})

	bcrypt.hash(password, BCRYPT_SALT_ROUNDS, (err, hash) => {
		if (err) {
			res.send({
				error: err
			});
			return;
		}

		let doc = {
			firstName,
			middleName,
			lastName,
			mobile,
			email,
			role,
			username,
			password: hash
		}

		db.collection(COLL_NAME).insertOne(doc, (err,result) => {
			if (err) {
				res.send({
					error: err
				})
				return;
			}
			res.json({
				message: 'User created',
				username
			})
		})
	})
});

app.delete('/:username', adminAuthorization, (req, res) => {
	let username = req.params.username;
	db.collection(COLL_NAME).deleteOne({username}, (err, result) => {
		if (err) {
			return res.json({
				error: err
			})
		}
		if (result.deletedCount == 0) {
			res.send({
				error: 'No user found with this username'
			})
		} else {
			res.send({
				message: result.deletedCount + ' user deleted'
			})
		}
	})
});

app.put('/update/:username/:field/:updatedValue', (req, res) => {
	let username = req.params.username;
	let field = req.params.field;
	let updatedValue = req.params.updatedValue;
	
	if (!username || !field || !updatedValue) {
		return res.send({
			error: 'Three request parameters are required: username, field, value'
		})
	}

	if (updatedValue.trim().length == 0) {
		return res.send({
			error: 'Invalid new value for this field'
		})
	}

	if (field == 'password') {
		bcrypt.hash(pasword, BCRYPT_SALT_ROUNDS, (err, hash) => {
			if (err) return res.send({
				error: err
			})
			_updateUser(field, hash);
		})
	} else if (field == 'mobile') {
		updatedValue = parseInt(updatedValue, 10);
		_updateUser(field, updatedValue);
	} else {
		_updateUser(field, updatedValue);
	}

	function _updateUser(field, value) {
		let query = { username };
		let updates = { $set: JSON.parse(`{ "${field}": "${value}" }`) };
		db.collection(COLL_NAME).updateOne(query, updates, (err, result) => {
			if (err) return res.send({ error: err });
			if (result.matchedCount == 0) {
				res.send({
					error: 'No user found for this username'
				})
			} else {
				res.send({
					message: result.matchedCount + ' user updated'
				})
			}
		})
	}
})

app.post('/login', (req, res) => {
	let username = req.body.username;
	let password = req.body.password;

	db.collection(COLL_NAME).findOne({username}, (err, user) => {
		if (err) {
			res.json({
				error: err
			});
		} else if (user) {
			let passwordHash = user.password;
			bcrypt.compare(password, passwordHash, (err, isValid) => {
				if (err) {
					res.send({
						error: err
					})
				} else if (isValid) {
					let accessToken = 'Bearer ' + jwt.sign({username, role: user.role}, JWT_SECRET_KEY, {expiresIn: '1h'});
					res.json({
						message: 'Login successful. Use the following access token to make requests to protected routes',
						accessToken
					})
				} else {
					res.json({
						message: 'Wrong password'
					})
				}
			})
		} else {
			res.json({
				message: 'No user found with this username.'
			})
		}
	})
})


app.listen(PORT, (err) => {
	console.log('Server running on port', PORT);
})