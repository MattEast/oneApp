const express = require('express');
const authenticateJWT = require('../middleware/authenticateJWT');
const { findUserByEmail } = require('../services/authService');
const {
  createOneTimeEntryForUser,
  listOneTimeEntriesForUser,
  removeOneTimeEntryForUser,
  updateOneTimeEntryForUser
} = require('../services/oneTimeEntriesService');
const { logInfo, logWarn, maskEmail } = require('../utils/observability');
const apiResponse = require('../utils/apiResponse');
const { sendInvalidSession } = require('../utils/httpResponses');

const router = express.Router();

async function findCurrentUser(req) {
  return await findUserByEmail(req.user.email);
}

router.get('/', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const entries = await listOneTimeEntriesForUser(user.id);
  return apiResponse.success(res, { oneTimeEntries: entries });
});

router.post('/', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await createOneTimeEntryForUser(user.id, req.body);
  if (result.error) {
    logWarn('financial.one_time_entry.create.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  logInfo('financial.one_time_entry.created', {
    email: maskEmail(user.email),
    entryId: result.value.id,
    type: result.value.type
  });
  return apiResponse.success(res, { oneTimeEntry: result.value }, 201);
});

router.put('/:entryId', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await updateOneTimeEntryForUser(user.id, req.params.entryId, req.body);
  if (result.error) {
    logWarn('financial.one_time_entry.update.rejected', {
      email: maskEmail(user.email),
      entryId: req.params.entryId,
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  logInfo('financial.one_time_entry.updated', {
    email: maskEmail(user.email),
    entryId: result.value.id,
    type: result.value.type
  });
  return apiResponse.success(res, { oneTimeEntry: result.value });
});

router.delete('/:entryId', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await removeOneTimeEntryForUser(user.id, req.params.entryId);
  if (result.error) {
    logWarn('financial.one_time_entry.delete.rejected', {
      email: maskEmail(user.email),
      entryId: req.params.entryId,
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  logInfo('financial.one_time_entry.deleted', {
    email: maskEmail(user.email),
    entryId: result.value.id
  });
  return apiResponse.success(res, { deletedEntryId: result.value.id });
});

module.exports = router;
