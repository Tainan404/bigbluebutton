import GroupChat from '/imports/api/group-chat';
import { Meteor } from 'meteor/meteor';

import Logger from '/imports/startup/server/logger';
import AuthTokenValidation, { ValidationStates } from '/imports/api/auth-token-validation';
import { extractCredentials } from '/imports/api/common/server/helpers';

async function groupChat() {
  const { meetingId: creadentialMeetingId, requesterUserId } = extractCredentials(this.userId);
  const tokenValidation = await AuthTokenValidation
    .findOneAsync({ meetingId: creadentialMeetingId, userId: requesterUserId });

  if (!tokenValidation || tokenValidation.validationStatus !== ValidationStates.VALIDATED) {
    Logger.warn(`Publishing GroupChat was requested by unauth connection ${this.connection.id}`);
    return GroupChat.find({ meetingId: '' });
  }

  const { meetingId, userId } = tokenValidation;

  const CHAT_CONFIG = Meteor.settings.public.chat;
  const PUBLIC_CHAT_TYPE = CHAT_CONFIG.type_public;

  Logger.debug('Publishing group-chat', { meetingId, userId });

  return GroupChat.find({
    $or: [
      { meetingId, access: PUBLIC_CHAT_TYPE },
      { meetingId, users: { $all: [userId] } },
    ],

  });
}

function publish(...args) {
  const boundGroupChat = groupChat.bind(this);
  return boundGroupChat(...args);
}

Meteor.publish('group-chat', publish);
