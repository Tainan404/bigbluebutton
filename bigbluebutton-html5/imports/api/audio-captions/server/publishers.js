import AudioCaptions from '/imports/api/audio-captions';
import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function audioCaptions() {
  const { meetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing AudioCaptions was requested by unauth connection ${this.connection.id}`);
    return AudioCaptions.find({ meetingId: '' });
  }

  const { userId } = tokenValidation;
  Logger.debug('Publishing AudioCaptions', { meetingId, requestedBy: userId });

  return AudioCaptions.find({ meetingId });
}

function publish(...args) {
  const boundAudioCaptions = audioCaptions.bind(this);
  return boundAudioCaptions(...args);
}

Meteor.publish('audio-captions', publish);
