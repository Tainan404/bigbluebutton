import WhiteboardMultiUser from '/imports/api/whiteboard-multi-user/';
import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function whiteboardMultiUser() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing WhiteboardMultiUser was requested by unauth connection ${this.connection.id}`);
    return WhiteboardMultiUser.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  Logger.debug('Publishing WhiteboardMultiUser', { meetingId, userId });

  return WhiteboardMultiUser.find({ meetingId });
}


function publish(...args) {
  const boundMultiUser = whiteboardMultiUser.bind(this);
  return boundMultiUser(...args);
}

Meteor.publish('whiteboard-multi-user', publish);
