import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import { RecordMeetings } from '/imports/api/meetings';
import Auth from '/imports/ui/services/auth';
import { notify } from '/imports/ui/services/notification';
import VoiceUsers from '/imports/api/voice-users';
import RecordIndicator from './component';

const APP_CONFIG = Meteor.settings.public.app;
const ALLOW_BREAKOUT_RECORDING = APP_CONFIG.allowBreakoutRecording;

const RecordIndicatorContainer = props => (
  <RecordIndicator {...props} />
);

export default withTracker(() => {
  const meetingId = Auth.meetingID;
  const recordObeject = RecordMeetings.findOne({ meetingId });

  RecordMeetings.find({ meetingId: Auth.meetingID }, { fields: { recording: 1 } }).observeChanges({
    changed: (id, fields) => {
      if (fields && fields.recording) {
        this.window.parent.postMessage({ response: 'recordingStarted' }, '*');
      }

      if (fields && !fields.recording) {
        this.window.parent.postMessage({ response: 'recordingStopped' }, '*');
      }
    },
  });

  const micUser = VoiceUsers.findOne({ meetingId, joined: true, listenOnly: false }, {
    fields: {
      joined: 1,
    },
  });
  return {
    allowStartStopRecording: !!(recordObeject && recordObeject.allowStartStopRecording),
    autoStartRecording: recordObeject && recordObeject.autoStartRecording,
    record: (recordObeject && recordObeject.record)
     || (recordObeject?.allowStartStopRecording && ALLOW_BREAKOUT_RECORDING),
    recording: recordObeject && recordObeject.recording,
    time: recordObeject && recordObeject.time,
    notify,
    micUser,
  };
})(RecordIndicatorContainer);
