import React, { useContext } from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import GuestPolicyComponent from './component';
import Service from '../service';
import Auth from '/imports/ui/services/auth';
import { UsersContext } from '/imports/ui/components/components-data/users-context/context';
import useMeetingSettings from '/imports/ui/core/local-states/useMeetingSettings';

const GuestPolicyContainer = (props) => {
  const [MeetingSettings] = useMeetingSettings();
  const userConfig = MeetingSettings.public.user;
  const roleModerator = userConfig.role_moderator;
  const usingUsersContext = useContext(UsersContext);
  const { users } = usingUsersContext;
  const currentUser = users[Auth.meetingID][Auth.userID];
  const amIModerator = currentUser.role === roleModerator;

  return amIModerator && <GuestPolicyComponent {...props} />;
};

export default withTracker(( ) => ({
  guestPolicy: Service.getGuestPolicy(),
  changeGuestPolicy: Service.changeGuestPolicy,
}))(GuestPolicyContainer);
