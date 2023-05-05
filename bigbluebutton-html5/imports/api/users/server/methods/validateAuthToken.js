import { Meteor } from 'meteor/meteor';
import RedisPubSub from '/imports/startup/server/redis';
import Logger from '/imports/startup/server/logger';
import upsertValidationState from '/imports/api/auth-token-validation/server/modifiers/upsertValidationState';
import AuthTokenValidation, { ValidationStates, PendingAuthentications } from '/imports/api/auth-token-validation';
import Users from '/imports/api/users';
import createDummyUser from '../modifiers/createDummyUser';
import updateUserConnectionId from '../modifiers/updateUserConnectionId';
import ClientConnections from '/imports/startup/server/ClientConnections';
import { log } from 'winston';

const AUTH_TIMEOUT = 120000;

async function validateAuthToken(meetingId, requesterUserId, requesterToken, externalId) {
  let setTimeoutRef = null;
  const userValidation = await new Promise(async (res, rej) => {
    const observeFunc = async (obj) => {
      if (obj.validationStatus === ValidationStates.VALIDATED) {
        clearTimeout(setTimeoutRef);
        /// code from handleValidateAuthToken
        const sessionId = `${meetingId}--${requesterUserId}`;
        this.setUserId(sessionId);

        const User = await Users.findOneAsync({
          meetingId,
          userId: requesterUserId,
        });
        if (!User) {
          await createDummyUser(meetingId, requesterUserId, requesterToken);
        } else {
          await updateUserConnectionId(meetingId, requesterUserId, this.connection.id);
        }

        ClientConnections.add(sessionId, this.connection);
        /// end code from handleValidateAuthToken
        return res(obj);
      }
      if (obj.validationStatus === ValidationStates.INVALID) {
        clearTimeout(setTimeoutRef);
        return res(obj);
      }
    };
    const authTokenValidationObserver = AuthTokenValidation.find({
      meetingId, userId: requesterUserId,
    }).observe({
      added: observeFunc,
      changed: observeFunc,
    });

    setTimeoutRef = setTimeout(() => {
      authTokenValidationObserver.stop();
      rej();
    }, AUTH_TIMEOUT);

    try {
      const REDIS_CONFIG = Meteor.settings.private.redis;
      const CHANNEL = REDIS_CONFIG.channels.toAkkaApps;
      const EVENT_NAME = 'ValidateAuthTokenReqMsg';

      Logger.debug('ValidateAuthToken method called', { meetingId, requesterUserId, requesterToken, externalId });

      if (!meetingId) return false;

      await PendingAuthentications.insert({
        meetingId,
        userId: requesterUserId,
        authToken: requesterToken,
      });

      await upsertValidationState(
        meetingId,
        requesterUserId,
        ValidationStates.VALIDATING,
        this.connection.id,
      );

      const payload = {
        userId: requesterUserId,
        authToken: requesterToken,
      };

      Logger.info(`User '${requesterUserId}' is trying to validate auth token for meeting '${meetingId}' from connection '${this.connection.id}'`);

      return RedisPubSub.publishUserMessage(
        CHANNEL,
        EVENT_NAME,
        meetingId,
        requesterUserId,
        payload,
      );
    } catch (err) {
      const errMsg = `Exception while invoking method validateAuthToken ${err}`;
      Logger.error(errMsg);
      // rej(errMsg);
      clearTimeout(setTimeoutRef);
      authTokenValidationObserver.stop();
    }
  });
  return userValidation;
}

export default validateAuthToken;
