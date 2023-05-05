import { Meteor } from 'meteor/meteor';
import Presentations from '/imports/api/presentations';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function presentations() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing Presentation was requested by unauth connection ${this.connection.id}`);
    return Presentations.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  Logger.debug('Publishing Presentations', { meetingId, userId });

  return Presentations.find({ meetingId });
}

function publish(...args) {
  const boundPresentations = presentations.bind(this);
  return boundPresentations(...args);
}

Meteor.publish('presentations', publish);
