## About

This app creates a database 'users' in mongodb and a collection 'usersColl' in that database.

It has a number of APIs for login, create, update, delete and get list of users.

It uses `JWT` for authentication and stores passwords of users in encrypted format using `bcrypt` library.

## How to use

1. Clone this repository

2. Make sure mongodb service is up and running on port `mongodb://localhost:27017`.

3. Run `npm install` to install dependencies

4. Run `npm start` to start the server (`localhost:5000`).

## APIs

1. Login 

Method - `POST`

Route - `/login`

Protected: `false`

It will provide you an access token which you can use in request header to make request to protected routes.

2. List all the users in 'users' database

Method - `GET`

Route - `/list-users`

Protected - `true` 

3. Create a user

Method - `POST`

Route - `/create-user`

Protected - `true` 

4. Delete a user

Method - `DELETE`

Route - `/:username`

Protected - `true`

5. Update a user

Method - `PUT`

Route - `/update/:username/:field/:updatedValue`

Protected - `false`