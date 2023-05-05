import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import Users from '/imports/api/users';
import userJoin from './userJoin';

import upsertValidationState from '/imports/api/auth-token-validation/server/modifiers/upsertValidationState';
import { PendingAuthentications, ValidationStates } from '/imports/api/auth-token-validation';

const clearOtherSessions = (sessionUserId, current = false) => {
  const serverSessions = Meteor.server.sessions;
  Object.keys(serverSessions)
    .filter(i => serverSessions[i].userId === sessionUserId)
    .filter(i => i !== current)
    .forEach(i => serverSessions[i].close());
};

export default async function handleValidateAuthToken({ body }, meetingId) {
  const {
    userId,
    valid,
    authToken,
    waitForApproval,
    registeredOn,
    authTokenValidatedOn,
    reasonCode,
  } = body;

  check(userId, String);
  check(authToken, String);
  check(valid, Boolean);
  check(waitForApproval, Boolean);
  check(registeredOn, Number);
  check(authTokenValidatedOn, Number);
  check(reasonCode, String);

  const pendingAuths = await PendingAuthentications.find({
    meetingId,
    userId,
    authToken,
  }).fetchAsync();
  Logger.info(`PendingAuths length [${pendingAuths.length}]`);
  if (pendingAuths.length === 0) return;
  if (!valid) {
    await Promise.all(pendingAuths.map(
      async (pendingAuth) => {
        try {
          await upsertValidationState(
            meetingId,
            userId,
            ValidationStates.INVALID,
            reasonCode,
          );

          // Schedule socket disconnection for this user
          // giving some time for client receiving the reason of disconnection
          new Promise((resolve) => {
            setTimeout(() => {
              methodInvocationObject.connection.close();
              Logger.info(`Closed connection ${connectionId} due to invalid auth token.`);
              resolve();
            }, 2000);
          });
        } catch (e) {
          Logger.error(`Error closing socket for meetingId '${meetingId}', userId '${userId}', authToken ${authToken}`);
        }
      },
    ));

    return;
  }

  await Promise.all(pendingAuths.map(
    async (pendingAuth) => {
      await PendingAuthentications.removeAsync(pendingAuth.userId, pendingAuth.authToken);

      await upsertValidationState(
        meetingId,
        userId,
        ValidationStates.VALIDATED,
      );
    },
  ));

  const selector = {
    meetingId,
    userId,
    clientType: 'HTML5',
  };

  const User = await Users.findOneAsync(selector);

  // If we dont find the user on our collection is a flash user and we can skip
  if (!User) return;

  // Publish user join message
  if (!waitForApproval) {
    Logger.info('User=', User);
    userJoin(meetingId, userId, User.authToken);
  }

  const modifier = {
    $set: {
      validated: valid,
      approved: !waitForApproval,
      loginTime: registeredOn,
      authTokenValidatedTime: authTokenValidatedOn,
      inactivityCheck: false,
    },
  };

  try {
    const numberAffected = await Users.updateAsync(selector, modifier);

    if (numberAffected) {
      const sessionUserId = `${meetingId}-${userId}`;
      const currentConnectionId = User.connectionId ? User.connectionId : false;
      clearOtherSessions(sessionUserId, currentConnectionId);

      Logger.info(`Validated auth token as ${valid} user=${userId} meeting=${meetingId}`);
    } else {
      Logger.info('No auth to validate');
    }
  } catch (err) {
    Logger.error(`Validating auth token: ${err}`);
  }
}
