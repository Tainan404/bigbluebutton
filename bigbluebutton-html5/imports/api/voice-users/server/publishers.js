import VoiceUsers from '/imports/api/voice-users';
import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import ejectUserFromVoice from './methods/ejectUserFromVoice';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function voiceUser() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing VoiceUsers was requested by unauth connection ${this.connection.id}`);
    return VoiceUsers.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  const onCloseConnection = Meteor.bindEnvironment(async () => {
    try {
      // I used user because voiceUser is the function's name
      const User = await VoiceUsers.findOneAsync({ meetingId, requesterUserId });
      if (User) {
        await ejectUserFromVoice(requesterUserId);
      }
    } catch (e) {
      Logger.error(`Exception while executing ejectUserFromVoice for ${requesterUserId}: ${e}`);
    }
  });

  Logger.debug('Publishing Voice User', { meetingId, requesterUserId });

  this._session.socket.on('close', _.debounce(onCloseConnection, 100));
  return VoiceUsers.find({ meetingId });
}

function publish(...args) {
  const boundVoiceUser = voiceUser.bind(this);
  return boundVoiceUser(...args);
}

Meteor.publish('voiceUsers', publish);
