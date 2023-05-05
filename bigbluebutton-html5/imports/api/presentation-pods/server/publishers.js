import { Meteor } from 'meteor/meteor';
import PresentationPods from '/imports/api/presentation-pods';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function presentationPods() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing PresentationPods was requested by unauth connection ${this.connection.id}`);
    return PresentationPods.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;
  Logger.debug('Publishing presentation-pods', { meetingId, userId });

  return PresentationPods.find({ meetingId });
}

function publish(...args) {
  const boundPresentationPods = presentationPods.bind(this);
  return boundPresentationPods(...args);
}

Meteor.publish('presentation-pods', publish);
