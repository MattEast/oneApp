const express = require('express');
const router = express.Router();

// TODO: Add validation, hashing, and DB logic
router.post('/register', async (req, res) => {
  const { fullname, email, password } = req.body;
  // Basic validation
  if (!fullname || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  // Simulate user creation
  return res.status(201).json({ message: 'User registered successfully.' });
});

module.exports = router;
