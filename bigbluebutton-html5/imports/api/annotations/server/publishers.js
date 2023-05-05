import Annotations from '/imports/api/annotations';
import { Meteor } from 'meteor/meteor';
import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function annotations() {
  const { meetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing Annotations was requested by unauth connection ${this.connection.id}`);
    return Annotations.find({ meetingId: '' });
  }

  const { userId } = tokenValidation;

  Logger.debug('Publishing Annotations', { meetingId, userId });

  return Annotations.find({ meetingId });
}

function publish(...args) {
  const boundAnnotations = annotations.bind(this);
  return boundAnnotations(...args);
}

Meteor.publish('annotations', publish);
