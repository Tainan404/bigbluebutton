import { Meteor } from 'meteor/meteor';
import LocalSettings from '/imports/api/local-settings';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function localSettings() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing LocalSettings was requested by unauth connection ${this.connection.id}`);
    return LocalSettings.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  Logger.debug('Publishing local settings', { userId });

  return LocalSettings.find({ meetingId, userId });
}

function publish(...args) {
  const boundLocalSettings = localSettings.bind(this);
  return boundLocalSettings(...args);
}

Meteor.publish('local-settings', publish);
