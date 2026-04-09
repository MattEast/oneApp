const express = require('express');
const router = express.Router();

router.use('/', require('./routes/auth'));
router.use('/', require('./routes/account'));
router.use('/one-time-entries', require('./routes/oneTimeEntries'));
router.use('/bank-sync', require('./routes/bankSync'));
router.use('/recurring-obligations', require('./routes/recurringObligations'));
router.use('/', require('./routes/deprecated'));

module.exports = router;
