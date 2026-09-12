Q&A Setup and admin password

1) Install dependencies

   In the project root run:

   npm install

2) Create the admin username and password (securely)

   Use the setup script which creates `config.json` containing a bcrypt password hash and a JWT secret:

   node setup-password.js --username yourAdminName --password yourSecurePassword

   This will write `config.json`. Do NOT commit `config.json` to a public repo.

3) Start the server

   npm start

   The server serves the website and provides API endpoints:

   - POST /api/ask  — public: submit a question (rate-limited to 1 per hour per IP)
   - GET  /api/questions — list questions
   - POST /api/login — admin login, returns a JWT
   - POST /api/answer — admin-only (Authorization: Bearer <token>) to answer a question

4) Using the site

   - Visit `/qa/` to ask questions and view the public list.
   - Visit `/qa/login.html` to login as the admin and answer questions.

Security notes

- Passwords are stored as bcrypt hashes in `config.json` created by `setup-password.js`.
- The rate limit for asking questions is enforced per IP: 1 ask per hour.
- This is a minimal demo server intended for low-traffic sites. For production use, run behind HTTPS, secure the `config.json`, and consider stronger user management.
