import { Meteor } from 'meteor/meteor';
import UserSettings from '/imports/api/users-settings';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function userSettings() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing UserSettings was requested by unauth connection ${this.connection.id}`);
    return UserSettings.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  Logger.debug('Publishing UserSettings', { meetingId, userId });

  return UserSettings.find({ meetingId, userId });
}

function publish(...args) {
  const boundUserSettings = userSettings.bind(this);
  return boundUserSettings(...args);
}

Meteor.publish('users-settings', publish);
