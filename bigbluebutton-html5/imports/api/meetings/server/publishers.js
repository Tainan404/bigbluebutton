import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import Meetings from '/imports/api/meetings';
import Users from '/imports/api/users';
import Logger from '/imports/startup/server/logger';

function meetings(credentials, isModerator) {
  const { meetingId, requesterUserId, requesterToken } = credentials;

  check(meetingId, String);
  check(requesterUserId, String);
  check(requesterToken, String);

  Logger.info(`Publishing meeting =${meetingId} ${requesterUserId} ${requesterToken}`);

  const selector = {
    $or: [
      { meetingId },
      {
        'meetingProp.isBreakout': true,
        'breakoutProps.parentId': meetingId,
      },
    ],
  };

  if (isModerator) {
    const User = Users.findOne({ userId: requesterUserId });
    if (!User.moderator) return null;
    selector.$or.push({
      'meetingProp.isBreakout': true,
      'breakoutProps.parentId': meetingId,
    });
  }

  const options = {
    fields: {
      password: false,
    },
  };

  return Meetings.find(selector, options);
}

function publish(...args) {
  const boundMeetings = meetings.bind(this);
  return boundMeetings(...args);
}

Meteor.publish('meetings', publish);
