import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import deviceInfo from '/imports/utils/deviceInfo';
import { useMutation } from '@apollo/client';
import LeaveMeetingButton from './component';
import { meetingIsBreakout } from '/imports/ui/components/app/service';
import { layoutSelectInput, layoutSelect } from '../../layout/context';
import { SMALL_VIEWPORT_BREAKPOINT } from '../../layout/enums';
import { USER_LEAVE_MEETING } from '/imports/ui/core/graphql/mutations/userMutations';
import { useStorageKey } from '/imports/ui/services/storage/hooks';

const LeaveMeetingButtonContainer = (props) => {
  const { width: browserWidth } = layoutSelectInput((i) => i.browser);
  const isMobile = browserWidth <= SMALL_VIEWPORT_BREAKPOINT;
  const isRTL = layoutSelect((i) => i.isRTL);
  const [userLeaveMeeting] = useMutation(USER_LEAVE_MEETING);
  const isDropdownOpen = useStorageKey('dropdownOpen');

  return (
    <LeaveMeetingButton {...
      {
        isMobile, isRTL, userLeaveMeeting, isDropdownOpen, ...props,
      }
    }
    />
  );
};

export default withTracker((props) => ({
  amIModerator: props.amIModerator,
  isMobile: deviceInfo.isMobile,
  isMeteorConnected: Meteor.status().connected,
  isBreakoutRoom: meetingIsBreakout(),
}))(LeaveMeetingButtonContainer);
