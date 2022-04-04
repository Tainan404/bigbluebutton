import { check } from 'meteor/check';

import userLeftFlag from '../modifiers/userLeftFlagUpdated';

export default function handleUserLeftFlag({ body }, meetingId) {
  const {
    intId,
    userLeftFlag: left,
  } = body;

  check(intId, String);
  check(left, Boolean);

  userLeftFlag(meetingId, intId, left);
}
