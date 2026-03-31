const express = require('express');
const bodyParser = require('body-parser');
const registerRoute = require('./register');

const app = express();
app.use(bodyParser.json());

app.use('/api', registerRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
