import { Meteor } from 'meteor/meteor';
import UserInfos from '/imports/api/users-infos';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function userInfos() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing UserInfos was requested by unauth connection ${this.connection.id}`);
    return UserInfos.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  Logger.debug('Publishing UserInfos requested', { meetingId, requesterUserId });

  return UserInfos.find({ meetingId, requesterUserId });
}

function publish(...args) {
  const boundUserInfos = userInfos.bind(this);
  return boundUserInfos(...args);
}

Meteor.publish('users-infos', publish);
