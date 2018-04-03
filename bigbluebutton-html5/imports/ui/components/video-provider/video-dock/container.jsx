import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import Auth from '/imports/ui/services/auth';
import Meetings from '/imports/api/meetings/';
import Users from '/imports/api/users/';
import mapUser from '/imports/ui/services/user/mapUser';
import VideoDock from './component';
import VideoService from '../service';

const VideoDockContainer = ({ children, ...props }) => <VideoDock {...props}>{children}</VideoDock>;

export default withTracker(({ sharedWebcam }) => {
  const meeting = Meetings.findOne({ meetingId: Auth.meetingID });
  const lockCam = meeting.lockSettingsProp ? meeting.lockSettingsProp.disableCam : false;
  const userId = Auth.userID;
  const currentUser = Users.findOne({ userId });
  const currentUserIsModerator = mapUser(currentUser).isModerator;

  const withActiveStreams = (users) => {
    const activeFilter = (user) => {
      const isLocked = lockCam && user.locked;
      return !isLocked && (user.has_stream || (sharedWebcam && user.userId === userId));
    };

    return users
      .filter(activeFilter);
  };


  const webcamOnlyModerator = (users) => {
    const webcamOnlyModeratorFilter = (user) => {
      const mappedUser = mapUser(user);
      const himSelf = mappedUser.id === userId;
      if (!VideoService.webcamOnlyModerator()) return true;
      return mappedUser.isModerator || himSelf;
    };
    if (currentUserIsModerator) return users;
    return users.filter(webcamOnlyModeratorFilter);
  };

  const users = webcamOnlyModerator(withActiveStreams(VideoService.getAllUsers()));

  return {
    users,
    userId,
  };
})(VideoDockContainer);
